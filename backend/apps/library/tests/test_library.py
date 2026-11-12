"""The Library's rules, through its API (docs/revamp/library/01-model-and-api.md)."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from uuid import uuid4

import pytest
from django.db import connection, transaction
from django.db import IntegrityError

from apps.library import fees
from apps.library.models import Payment, Shift, Student
from apps.library.services import recalc, seed_library

pytestmark = pytest.mark.django_db
ROOT = "/api/v1/library/"
D = dt.date


def post(client, path, data=None, key=None):
    return client.post(ROOT + path, data or {}, format="json", HTTP_IDEMPOTENCY_KEY=key or str(uuid4()))


def entitle(tenant):
    """The library on the tenant's plan, its partner and its own switches."""
    for row, field in ((tenant.plan, "modules"), (tenant.partner, "allowed_modules")):
        setattr(row, field, sorted(set(getattr(row, field) or []) | {"library"}))
        row.save(update_fields=[field])
    tenant.enabled_modules = sorted(set(tenant.enabled_modules or []) | {"library"})
    tenant.save(update_fields=["enabled_modules"])
    tenant.refresh_from_db()


@pytest.fixture
def lib(tenant, api_as):
    """A library with the three seeded shifts at ₹800/₹600/₹1,200 and 20 seats."""
    entitle(tenant)
    seed_library(None, tenant)
    for name, fee in (("Morning", 800), ("Evening", 600), ("Full day", 1200)):
        Shift.objects.filter(tenant=tenant, name=name).update(monthly_fee=fee)
    client, member = api_as(tenant)
    assert client.put(ROOT + "seats", {"count": 20}, format="json").status_code == 200
    shifts = {s.name: str(s.pk) for s in Shift.objects.filter(tenant=tenant)}
    return client, tenant, shifts


def enrol(client, shifts, name="Rahul Gaikwad", seat=14, shift="Morning", **extra):
    r = post(client, "students", {"name": name, "mobile": extra.pop("mobile", ""), "seat": seat,
                                  "shift_id": shifts[shift], **extra})
    assert r.status_code == 201, r.content
    return r.json()["data"]


# ── the fee rule, with no database ──────────────────────────────────────────


def test_a_month_moves_paid_to_on_the_joining_day_and_never_drifts():
    """31 Jan → 28 Feb → 31 Mar: clamping must not walk the date to the 28th."""
    joined = D(2026, 1, 31)  # the first fee is due on the joining day
    a = fees.apply_payment(paid_to=None, credit=Decimal(0), amount=Decimal(800), monthly_fee=Decimal(800), joined_on=joined)
    assert (a.paid_to, a.from_date, a.to_date) == (D(2026, 2, 28), D(2026, 1, 31), D(2026, 2, 27))
    b = fees.apply_payment(paid_to=a.paid_to, credit=Decimal(0), amount=Decimal(800), monthly_fee=Decimal(800), joined_on=joined)
    assert b.paid_to == D(2026, 3, 31)


def test_part_money_stays_as_credit_and_completes_the_next_month():
    a = fees.apply_payment(paid_to=D(2026, 10, 25), credit=Decimal(0), amount=Decimal(400),
                           monthly_fee=Decimal(800), joined_on=D(2026, 1, 25))
    assert (a.months, a.paid_to, a.credit) == (0, D(2026, 10, 25), Decimal(400))
    b = fees.apply_payment(paid_to=a.paid_to, credit=a.credit, amount=Decimal(1200),
                           monthly_fee=Decimal(800), joined_on=D(2026, 1, 25))
    assert (b.months, b.paid_to, b.credit) == (2, D(2026, 12, 25), Decimal(0))


@pytest.mark.parametrize(
    ("paid_to", "credit", "status", "due", "late"),
    [
        (D(2026, 10, 25), 0, "over", "1200.00", 5),   # I6: ended 25 Oct, 5 days late
        (D(2026, 11, 2), 0, "soon", "1200.00", 0),    # within 7 days
        (D(2026, 11, 30), 0, "paid", "0.00", 0),
        (D(2026, 11, 30), 400, "part", "800.00", 0),  # ₹400 of ₹1,200 paid
        (D(2026, 8, 25), 0, "over", "3600.00", 66),   # three months behind
    ],
)
def test_fee_status_and_due(paid_to, credit, status, due, late):
    state = fees.fee_state(status="active", paid_to=paid_to, credit=Decimal(credit), monthly_fee=Decimal(1200),
                           joined_on=D(2026, 1, 25), today=D(2026, 10, 30), due_soon_days=7)
    assert (state.status, f"{state.due:.2f}", state.days_late) == (status, due, late)


# ── through the API ─────────────────────────────────────────────────────────


def test_collect_moves_paid_to_and_the_preview_says_the_same(lib):
    """I6: "Paid to 25 Nov after this" before Save is the same rule Save uses."""
    client, _t, shifts = lib
    s = enrol(client, shifts, joined_on=(dt.date.today() - dt.timedelta(days=5)).isoformat())
    preview = post(client, f"students/{s['id']}/payments?preview=true", {"amount": "800"}).json()["data"]
    saved = post(client, f"students/{s['id']}/payments", {"amount": "800", "mode": "upi"})
    assert saved.status_code == 201, saved.content
    student = saved.json()["meta"]["student"]
    assert student["paid_to"] == preview["paid_to"]
    assert student["fee"] in ("paid", "soon")
    assert "Received" not in saved.json()["meta"]["receipt"]  # signed by the library, not the product
    assert "YourKhata" not in saved.json()["meta"]["receipt"]


def test_a_retry_with_the_same_key_collects_once(lib):
    client, _t, shifts = lib
    s = enrol(client, shifts)
    key = str(uuid4())
    a = post(client, f"students/{s['id']}/payments", {"amount": "800"}, key=key)
    b = post(client, f"students/{s['id']}/payments", {"amount": "800"}, key=key)
    assert a.status_code == b.status_code == 201
    assert Payment.objects.filter(student_id=s["id"]).count() == 1


@pytest.mark.parametrize("amount", ["0", "-5", "abc", "99999999999", ""])
def test_a_bad_amount_is_refused_and_stores_nothing(lib, amount):
    client, _t, shifts = lib
    s = enrol(client, shifts)
    r = post(client, f"students/{s['id']}/payments", {"amount": amount})
    assert r.status_code == 400
    assert not Payment.objects.filter(student_id=s["id"]).exists()


def test_removing_the_latest_payment_puts_paid_to_back_exactly(lib):
    client, _t, shifts = lib
    s = enrol(client, shifts)
    first = post(client, f"students/{s['id']}/payments", {"amount": "800"}).json()["meta"]["student"]
    second = post(client, f"students/{s['id']}/payments", {"amount": "1200"})
    pid = second.json()["data"]["id"]
    older = Payment.objects.filter(student_id=s["id"]).order_by("created_at").first()
    refused = post(client, f"payments/{older.pk}/remove", {"reason": "typo"})
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "not_latest_payment"
    assert post(client, f"payments/{pid}/remove", {"reason": ""}).status_code == 400
    back = post(client, f"payments/{pid}/remove", {"reason": "Wrong student"}).json()["data"]["student"]
    assert (back["paid_to"], back["credit"]) == (first["paid_to"], first["credit"])
    st = Student.objects.get(pk=s["id"])
    assert recalc(st) == (st.paid_to, st.credit)


def test_a_payment_is_history_in_the_database():
    """No code path may rewrite or delete what a student paid."""
    with connection.cursor() as cur:
        cur.execute("SELECT tgname FROM pg_trigger WHERE tgname='library_payment_is_history'")
        assert cur.fetchone()


def test_the_trigger_refuses_an_edit(lib):
    client, _t, shifts = lib
    s = enrol(client, shifts)
    post(client, f"students/{s['id']}/payments", {"amount": "800"})
    with pytest.raises(IntegrityError), transaction.atomic():
        Payment.objects.filter(student_id=s["id"]).update(amount=1)


def test_a_seat_is_one_students_per_shift_and_full_day_holds_every_shift(lib):
    client, _t, shifts = lib
    enrol(client, shifts, name="A", seat=3, shift="Morning")
    enrol(client, shifts, name="B", seat=3, shift="Evening")  # another shift: fine
    r = post(client, "students", {"name": "C", "seat": 3, "shift_id": shifts["Morning"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "seat_taken"
    r = post(client, "students", {"name": "D", "seat": 3, "shift_id": shifts["Full day"]})
    assert r.status_code == 409
    enrol(client, shifts, name="E", seat=4, shift="Full day")
    r = post(client, "students", {"name": "F", "seat": 4, "shift_id": shifts["Evening"]})
    assert r.status_code == 409


def test_leaving_frees_the_seat_and_keeps_the_due(lib):
    client, _t, shifts = lib
    s = enrol(client, shifts, seat=5, joined_on=(dt.date.today() - dt.timedelta(days=40)).isoformat())
    left = post(client, f"students/{s['id']}/leave").json()["data"]
    assert left["seat"] is None and left["status"] == "left" and Decimal(left["due"]) > 0
    enrol(client, shifts, name="Next", seat=5)


def test_seat_map_home_and_fees_agree_on_the_figures(lib):
    client, _t, shifts = lib
    old = (dt.date.today() - dt.timedelta(days=45)).isoformat()
    a = enrol(client, shifts, name="Late One", seat=1, joined_on=old)
    enrol(client, shifts, name="Paid One", seat=2, shift="Evening")
    post(client, f"students/{enrol(client, shifts, name='Paid One', seat=6)['id']}/payments", {"amount": "800"})
    home = client.get(ROOT + "home").json()["data"]
    fees_page = client.get(ROOT + "fees?fee=over").json()["data"]
    seats = client.get(ROOT + f"seats?shift={shifts['Morning']}").json()["data"]
    assert [r["id"] for r in fees_page["rows"]] == [a["id"]]
    assert home["overdue"] == fees_page["rows"][0]["due"]
    assert home["collected"] == "800.00" and home["payments"] == 1
    assert seats["filled"] == 2  # seats 1 and 6 in the morning
    assert next(x for x in seats["seats"] if x["number"] == 1)["student"]["fee"] == "over"


def test_counter_staff_collect_but_cannot_set_up(lib, api_as):
    client, tenant, shifts = lib
    s = enrol(client, shifts)
    staff, _m = api_as(tenant, role="staff")
    assert post(staff, f"students/{s['id']}/payments", {"amount": "800"}).status_code == 201
    assert staff.put(ROOT + "seats", {"count": 30}, format="json").status_code == 403
    assert staff.patch(ROOT + "settings", {"upi_id": "x@y"}, format="json").status_code == 403


def test_another_business_sees_none_of_it(lib, other_tenant, api_as):
    client, _t, shifts = lib
    s = enrol(client, shifts)
    entitle(other_tenant)
    stranger, _m = api_as(other_tenant)
    assert stranger.get(ROOT + f"students/{s['id']}").status_code in (403, 404)
    r = post(stranger, f"students/{s['id']}/payments", {"amount": "800"})
    assert r.status_code in (403, 404)


def test_the_library_writes_no_shop_table(lib):
    """Owner, 11 Nov: no relation with the Shop. Enrol and collect touch no party or ledger row."""
    from apps.ledger.models import LedgerEntry
    from apps.parties.models import Party

    client, tenant, shifts = lib
    parties, entries = Party.objects.count(), LedgerEntry.objects.count()
    s = enrol(client, shifts, mobile="9822041178")
    post(client, f"students/{s['id']}/payments", {"amount": "800"})
    assert (Party.objects.count(), LedgerEntry.objects.count()) == (parties, entries)


def test_the_reminder_is_signed_by_the_library_in_the_screens_language(lib):
    client, tenant, shifts = lib
    client.patch(ROOT + "settings", {"sign_as": "Gyan Study Library", "upi_id": "gyan@upi"}, format="json")
    s = enrol(client, shifts, seat=14, joined_on=(dt.date.today() - dt.timedelta(days=40)).isoformat())
    en = client.get(ROOT + f"messages/text?student={s['id']}&kind=fee_due&lang=en").json()["data"]["text"]
    hi = client.get(ROOT + f"messages/text?student={s['id']}&kind=fee_due&lang=hi").json()["data"]["text"]
    assert "Gyan Study Library" in en and "seat 14" in en and "gyan@upi" in en
    assert "फ़ीस" in hi


def test_books_cannot_go_out_more_than_the_copies(lib):
    client, _t, shifts = lib
    s = enrol(client, shifts)
    b = post(client, "books", {"title": "Lucent GK", "copies": 1}).json()["data"]["id"]
    assert post(client, f"books/{b}/give", {"student_id": s["id"]}).status_code == 201
    r = post(client, f"books/{b}/give", {"student_id": s["id"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "no_copy_left"
    issue = client.get(ROOT + "books").json()["data"][0]["out"][0]["id"]
    assert post(client, f"issues/{issue}/back").status_code == 200
    assert client.get(ROOT + "books").json()["data"][0]["left"] == 1


def test_money_is_fees_in_minus_expenses_out(lib):
    client, _t, shifts = lib
    s = enrol(client, shifts)
    post(client, f"students/{s['id']}/payments", {"amount": "800"})
    post(client, "expenses", {"head": "rent", "amount": "300"})
    e = post(client, "expenses", {"head": "other", "amount": "50"}).json()["data"]["id"]
    post(client, f"expenses/{e}/remove", {"reason": "typed twice"})
    m = client.get(ROOT + "money").json()["data"]
    assert (m["fees"], m["expenses"], m["net"]) == ("800.00", "300.00", "500.00")


def test_a_scan_finds_exactly_one_book_and_a_barcode_is_on_one_book(lib):
    """Books scanner: the counter scans the barcode to give or take back."""
    client, _t, _s = lib
    post(client, "books", {"title": "Lucent GK", "code": "9789384761540"})
    post(client, "books", {"title": "Lucent GK Hindi"})
    found = client.get(ROOT + "books?code=9789384761540").json()["data"]
    assert [b["title"] for b in found] == ["Lucent GK"]
    assert client.get(ROOT + "books?code=000").json()["data"] == []
    r = post(client, "books", {"title": "Other", "code": "9789384761540"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "code_in_use"


def test_the_fee_poster_has_the_shifts_and_a_upi_qr_only_with_a_upi_id(lib):
    client, _t, _s = lib
    assert client.get(ROOT + "fees/poster").json()["data"]["qr"] is None
    client.patch(ROOT + "settings", {"upi_id": "gyan@upi", "sign_as": "Gyan Study Library"}, format="json")
    poster = client.get(ROOT + "fees/poster").json()["data"]
    assert poster["name"] == "Gyan Study Library"
    assert [s["monthly_fee"] for s in poster["shifts"]] == ["800.00", "600.00", "1200.00"]
    assert poster["qr"]["size"] == len(poster["qr"]["modules"]) > 20
