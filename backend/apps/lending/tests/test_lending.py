"""Loans & Collections' rules, through its API, on fixed dates. Every expected
figure is worked out by hand in the comment beside it (owner, 12 Nov: "prefill
data on previous dates and check every calculation")."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from uuid import uuid4

import pytest
from django.db import IntegrityError, transaction

from apps.lending import book, selectors, services
from apps.lending.models import Collection, Due

pytestmark = pytest.mark.django_db
ROOT = "/api/v1/lending/"
D = dt.date
TODAY = D(2026, 11, 12)  # a Thursday


def entitle(tenant):
    for row, field in ((tenant.plan, "modules"), (tenant.partner, "allowed_modules")):
        setattr(row, field, sorted(set(getattr(row, field) or []) | {"lending"}))
        row.save(update_fields=[field])
    tenant.enabled_modules = sorted(set(tenant.enabled_modules or []) | {"lending"})
    tenant.save(update_fields=["enabled_modules"])
    tenant.refresh_from_db()


def post(client, path, data=None, key=None, ok=(200, 201)):
    r = client.post(ROOT + path, data or {}, format="json", HTTP_IDEMPOTENCY_KEY=key or str(uuid4()))
    if ok:
        assert r.status_code in ok, r.content
    return r


@pytest.fixture
def lender(tenant, api_as, monkeypatch):
    entitle(tenant)
    monkeypatch.setattr(services, "today", lambda _t: TODAY)
    monkeypatch.setattr(selectors, "today", lambda _t: TODAY)
    client, _ = api_as(tenant)
    client.patch(ROOT + "settings", {"sign_as": "Shiv Finance", "upi_id": "shiv@upi"}, format="json")
    route = post(client, "routes", {"name": "Market road"}).json()["data"]["id"]
    return client, tenant, route


def borrower(client, route, name="Sunil Mane", mobile="9822041178", work="Tea stall"):
    return post(client, "borrowers", {"name": name, "mobile": mobile, "work": work, "route_id": route}).json()["data"]["id"]


def loan(client, bid, **extra):
    data = {"borrower_id": bid, "lent": "20000", "frequency": "daily", "count": 40, "each": "500",
            "starts_on": "2026-11-02", **extra}
    return post(client, "loans", data).json()["data"]


# ── the schedule, with no database ──────────────────────────────────────────


def test_a_daily_schedule_skips_sundays():
    """Mon 2 Nov, 40 collections, Sundays skipped: 2–7, 9–14, 16–21, 23–28, 30 Nov–5 Dec,
    7–12 Dec, 14–17 Dec → the 40th is Thu 17 Dec (6 a week × 6 weeks = 36, + 4)."""
    days = book.schedule_dates(starts_on=D(2026, 11, 2), frequency="daily", count=40, skip_sundays=True)
    assert days[0] == D(2026, 11, 2) and days[-1] == D(2026, 12, 17)
    assert all(d.weekday() != 6 for d in days)


def test_weekly_and_monthly_keep_their_day():
    weekly = book.schedule_dates(starts_on=D(2026, 11, 5), frequency="weekly", count=3, skip_sundays=False)
    assert weekly == [D(2026, 11, 5), D(2026, 11, 12), D(2026, 11, 19)]
    monthly = book.schedule_dates(starts_on=D(2026, 1, 31), frequency="monthly", count=3, skip_sundays=False)
    assert monthly == [D(2026, 1, 31), D(2026, 2, 28), D(2026, 3, 31)]


def test_money_pays_the_oldest_day_first():
    """Dues of 500 on 2,3,4,5 Nov; ₹700 collected; on 5 Nov: 2 Nov paid, 3 Nov half,
    → late = 300 (3 Nov) + 500 (4 Nov) = 800 over 2 days since 3 Nov; due today 500."""
    dues = [(i + 1, D(2026, 11, 2 + i), Decimal("500")) for i in range(4)]
    p = book.position(dues=dues, collected=Decimal("700"), day=D(2026, 11, 5))
    assert (p.late, p.late_days, p.late_since, p.due_today, p.left, p.paid_count) == (
        Decimal("800"), 2, D(2026, 11, 3), Decimal("500"), Decimal("1300"), 1)


# ── through the API, on a fixed day ─────────────────────────────────────────


def test_a_new_loan_shows_its_whole_schedule_before_save(lender):
    """I10: ₹20,000 lent, 40 × ₹500 from Mon 2 Nov → to collect ₹20,000, last day 17 Dec;
    with ₹1,000 taken at the start the borrower gets ₹19,000 in hand and the lender earns ₹1,000."""
    client, _t, route = lender
    bid = borrower(client, route)
    p = post(client, "loans?preview=true", {"borrower_id": bid, "lent": "20000", "count": 40, "each": "500",
                                            "starts_on": "2026-11-02", "charges": "1000"}).json()["data"]
    assert (p["to_collect"], p["in_hand"], p["earns"], p["last_day"]) == ("20000.00", "19000.00", "1000.00", "2026-12-17")
    assert len(p["schedule"]) == 40


def test_the_round_late_due_and_collect(lender):
    """Sunil: 40 × 500 from 2 Nov. By Thu 12 Nov the days are 2,3,4,5,6,7,9,10,11 (9 days
    before today, Sunday 8 skipped) and 12 (today). He paid 3,500 (7 days) on 9 Nov →
    late = 2 days (10, 11 Nov) = ₹1,000 since 10 Nov; due today ₹500; "today + late" ₹1,500;
    left 20,000 − 3,500 = ₹16,500."""
    client, _t, route = lender
    l = loan(client, borrower(client, route))
    post(client, f"loans/{l['id']}/collections", {"amount": "3500", "collected_on": "2026-11-09"})
    now = client.get(ROOT + f"loans/{l['id']}").json()["data"]
    assert (now["late"], now["late_days"], now["late_since"], now["due_today"], now["left"]) == (
        "1000.00", 2, "2026-11-10", "500.00", "16500.00")
    # The round: one stop, ₹1,500 due, nothing collected yet, ₹1,500 short.
    r = client.get(ROOT + f"today?route={route}").json()["data"]
    assert (r["due"], r["collected"], r["short"], r["stops_total"], r["stops"][0]["state"]) == (
        "1500.00", "0.00", "1500.00", 1, "late")
    # The sheet: "After this: nothing late · ₹15,000 left · 31 days to go" — 40 days less the
    # 9 before today (2–7 and 9–11 Nov); today itself still counts.
    after = post(client, f"loans/{l['id']}/collections?preview=true", {"amount": "1500"}).json()["data"]
    assert (after["late"], after["due_today"], after["left"], after["days_to_go"]) == ("0.00", "0.00", "15000.00", 31)
    saved = post(client, f"loans/{l['id']}/collections", {"amount": "1500", "mode": "upi"}).json()
    assert saved["meta"]["loan"]["left"] == "15000.00"
    assert "Shiv Finance" in saved["meta"]["receipt"] and "₹15,000 left" in saved["meta"]["receipt"]
    r = client.get(ROOT + f"today?route={route}").json()["data"]
    assert (r["collected"], r["short"], r["stops_done"], r["stops"][0]["state"]) == ("1500.00", "0.00", 1, "done")


def test_not_paid_is_said_and_cleared_by_a_collection(lender):
    client, _t, route = lender
    l = loan(client, borrower(client, route), starts_on="2026-11-12")
    post(client, f"loans/{l['id']}/not-paid", {"reason": "Shop closed", "promised_on": "2026-11-13"})
    r = client.get(ROOT + "today").json()["data"]
    assert r["stops"][0]["state"] == "not" and r["not_paid"] == 1 and r["stops"][0]["promised_on"] == "2026-11-13"
    post(client, f"loans/{l['id']}/collections", {"amount": "500"})
    assert client.get(ROOT + "today").json()["data"]["stops"][0]["state"] == "done"


def test_more_than_is_left_is_refused_and_the_last_collection_closes_the_loan(lender):
    client, _t, route = lender
    l = loan(client, borrower(client, route), lent="1000", count=2, each="500", starts_on="2026-11-11")
    r = post(client, f"loans/{l['id']}/collections", {"amount": "1500"}, ok=None)
    assert r.status_code == 409 and r.json()["error"]["code"] == "more_than_left"
    post(client, f"loans/{l['id']}/collections", {"amount": "1000"})
    done = client.get(ROOT + f"loans/{l['id']}").json()["data"]
    assert (done["status"], done["close_reason"], done["left"]) == ("closed", "paid", "0.00")
    # Removing that money opens the loan again, with ₹1,000 left.
    cid = done["collections"][0]["id"]
    again = post(client, f"collections/{cid}/remove", {"reason": "Counted twice"}).json()["data"]
    assert (again["status"], again["left"]) == ("active", "1000.00")


def test_a_collection_and_a_schedule_are_history_in_the_database(lender):
    client, _t, route = lender
    l = loan(client, borrower(client, route))
    post(client, f"loans/{l['id']}/collections", {"amount": "500"})
    with pytest.raises(IntegrityError), transaction.atomic():
        Collection.objects.filter(loan_id=l["id"]).update(amount=1)
    with pytest.raises(IntegrityError), transaction.atomic():
        Due.objects.filter(loan_id=l["id"]).delete()


@pytest.mark.parametrize("amount", ["0", "-5", "abc", "99999999999", ""])
def test_a_bad_amount_is_refused_and_stores_nothing(lender, amount):
    client, _t, route = lender
    l = loan(client, borrower(client, route))
    assert post(client, f"loans/{l['id']}/collections", {"amount": amount}, ok=None).status_code == 400
    assert not Collection.objects.filter(loan_id=l["id"]).exists()


def test_a_schedule_that_brings_back_less_than_lent_is_refused(lender):
    client, _t, route = lender
    bid = borrower(client, route)
    r = post(client, "loans", {"borrower_id": bid, "lent": "20000", "count": 30, "each": "500"}, ok=None)
    assert r.status_code == 400 and "each" in r.json()["error"]["details"]


def test_a_retry_with_the_same_key_collects_once(lender):
    client, _t, route = lender
    l = loan(client, borrower(client, route))
    key = str(uuid4())
    post(client, f"loans/{l['id']}/collections", {"amount": "500"}, key=key)
    post(client, f"loans/{l['id']}/collections", {"amount": "500"}, key=key)
    assert Collection.objects.filter(loan_id=l["id"]).count() == 1


def test_a_book_with_a_past_adds_up_by_hand(lender):
    """Four loans on Market road, as of Thu 12 Nov:
       A 40×500 from 2 Nov, paid 4,500 (9 days: 2–7, 9–11 Nov) → late 0, due today 500.
       B 40×500 from 2 Nov, paid 2,500 (5 days, up to 6 Nov) → late 7,9,10,11 = ₹2,000 since 7 Nov.
       C weekly 10×1,000 from Thu 15 Oct, paid 3,000 → 15,22,29 Oct paid; 5 Nov late ₹1,000;
         12 Nov due ₹1,000.
       D 10×500 from 13 Nov (tomorrow) → not in today's round; due tomorrow.
     Round: due = A 500 + B (2,000 late + 500 today) + C (1,000 + 1,000) = ₹5,000;
     Late across the book ₹3,000 over 2 borrowers."""
    client, _t, route = lender
    a = loan(client, borrower(client, route, "Asha", "9800000001"))
    b = loan(client, borrower(client, route, "Bala", "9800000002"))
    c = loan(client, borrower(client, route, "Chetan", "9800000003"), lent="10000", frequency="weekly", count=10,
             each="1000", starts_on="2026-10-15")
    d = loan(client, borrower(client, route, "Divya", "9800000004"), lent="5000", count=10, each="500", starts_on="2026-11-13")
    post(client, f"loans/{a['id']}/collections", {"amount": "4500", "collected_on": "2026-11-11"})
    post(client, f"loans/{b['id']}/collections", {"amount": "2500", "collected_on": "2026-11-06"})
    post(client, f"loans/{c['id']}/collections", {"amount": "3000", "collected_on": "2026-10-29"})
    r = client.get(ROOT + f"today?route={route}").json()["data"]
    assert r["due"] == "5000.00" and r["stops_total"] == 3
    by = {s["borrower"]: s for s in r["stops"]}
    assert (by["Bala"]["late"], by["Bala"]["late_days"], by["Bala"]["late_since"]) == ("2000.00", 4, "2026-11-07")
    assert (by["Chetan"]["late"], by["Chetan"]["due_today"]) == ("1000.00", "1000.00")
    assert "Divya" not in by
    book_fig = r["book"]
    assert (book_fig["late"], book_fig["late_borrowers"]) == ("3000.00", 2)
    # I11 lists: Late = Bala (4 days) then Chetan (1 day); Due today = A, B, C; Due tomorrow = A, B, D.
    late = client.get(ROOT + "remind?kind=late").json()
    assert [x["borrower"] for x in late["data"]] == ["Bala", "Chetan"]
    assert late["meta"]["counts"] == {"late": 2, "due_today": 3, "due_tomorrow": 3}
    text = client.get(ROOT + f"messages/text?loan={b['id']}&kind=late&lang=en").json()["data"]["text"]
    assert "₹2,000 from 7 Nov" in text and b["number"] in text and "Shiv Finance" in text
    hi = client.get(ROOT + f"messages/text?loan={b['id']}&kind=late&lang=hi").json()["data"]["text"]
    assert "₹2,000" in hi and "7 Nov" in hi
    _ = d


def test_the_morning_bell_names_loans_that_became_late_today(lender, tenant):
    """Late since yesterday (11 Nov) = a bell; late for days already = not "today"."""
    from apps.lending import tasks
    from apps.notifications.models import Notification

    client, _t, route = lender
    fresh = loan(client, borrower(client, route, "Fresh", "9800000011"), starts_on="2026-11-11")
    loan(client, borrower(client, route, "Old", "9800000012"), starts_on="2026-11-02")
    assert [l.number for l in tasks.became_late(tenant, TODAY)] == [fresh["number"]]
    assert tasks.notify_late_today(tenant, TODAY) is True
    assert Notification.objects.get(tenant=tenant, type=tasks.LATE_TODAY).title == "Loans late today: 1"


def test_collector_collects_but_cannot_lend_or_set_up(lender, api_as):
    client, tenant, route = lender
    l = loan(client, borrower(client, route))
    staff, _ = api_as(tenant, role="staff")
    assert post(staff, f"loans/{l['id']}/collections", {"amount": "500"}, ok=None).status_code == 201
    assert post(staff, "loans", {"borrower_id": l["borrower_id"], "lent": "100", "count": 1, "each": "100"}, ok=None).status_code == 403
    assert post(staff, "routes", {"name": "x"}, ok=None).status_code == 403


def test_another_business_sees_none_of_it(lender, other_tenant, api_as):
    client, _t, route = lender
    l = loan(client, borrower(client, route))
    entitle(other_tenant)
    stranger, _ = api_as(other_tenant)
    assert stranger.get(ROOT + f"loans/{l['id']}").status_code in (403, 404)


def test_lending_writes_no_shop_table(lender):
    """Owner, 11 Nov: no relation with the Shop."""
    from apps.ledger.models import LedgerEntry
    from apps.parties.models import Party

    client, _t, route = lender
    before = (Party.objects.count(), LedgerEntry.objects.count())
    l = loan(client, borrower(client, route))
    post(client, f"loans/{l['id']}/collections", {"amount": "500"})
    assert (Party.objects.count(), LedgerEntry.objects.count()) == before
