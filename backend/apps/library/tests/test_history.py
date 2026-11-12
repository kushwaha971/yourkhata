"""A library with a past (owner, 12 Nov: "prefill data on previous dates, check
reminders, notifications and every calculation").

Students who joined months ago pay through the API on past days — on time,
late, in parts, months ahead, and on the 31st — and then "today" is fixed. Each
expected figure below is worked out BY HAND in its comment, not by the code
under test, and the server's fee status, due, days late, "paid to", the
reminder's words, and the Home and Fees totals must all agree with it.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from uuid import uuid4

import pytest

from apps.library import selectors, services
from apps.library.models import Shift
from apps.library.services import seed_library
from apps.library.tests.test_library import entitle

pytestmark = pytest.mark.django_db
ROOT = "/api/v1/library/"
TODAY = dt.date(2026, 11, 12)


@pytest.fixture
def room(tenant, api_as, monkeypatch):
    entitle(tenant)
    seed_library(None, tenant)
    for name, fee in (("Morning", 800), ("Evening", 600), ("Full day", 1200)):
        Shift.objects.filter(tenant=tenant, name=name).update(monthly_fee=fee)
    monkeypatch.setattr(services, "today", lambda _t: TODAY)
    monkeypatch.setattr(selectors, "today", lambda _t: TODAY)
    client, _ = api_as(tenant)
    client.put(ROOT + "seats", {"count": 30}, format="json")
    client.patch(ROOT + "settings", {"sign_as": "Gyan Study Library", "upi_id": "gyan@upi"}, format="json")
    shifts = {s.name: str(s.pk) for s in Shift.objects.filter(tenant=tenant)}
    return client, shifts


def post(client, path, data):
    r = client.post(ROOT + path, data, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()))
    assert r.status_code in (200, 201), r.content
    return r.json()


def student(client, shifts, name, seat, shift, joined, pays=()):
    s = post(client, "students", {"name": name, "mobile": f"98{seat:08d}", "seat": seat,
                                  "shift_id": shifts[shift], "joined_on": joined})["data"]
    for day, amount in pays:
        post(client, f"students/{s['id']}/payments", {"amount": amount, "paid_on": day})
    return client.get(ROOT + f"students/{s['id']}").json()["data"]


def test_a_library_with_a_past_adds_up_by_hand(room):
    client, shifts = room

    # On time every month since June (₹800): joined 15 Jun, paid 15 Jun, 15 Jul,
    # 15 Aug, 15 Sep, 15 Oct, 12 Nov → 6 months from 15 Jun = paid to 15 Dec. Not due
    # within 7 days (33 days away) → Paid, ₹0.
    a = student(client, shifts, "Asha OnTime", 1, "Morning", "2026-06-15",
                [("2026-06-15", "800"), ("2026-07-15", "800"), ("2026-08-15", "800"),
                 ("2026-09-15", "800"), ("2026-10-15", "800"), ("2026-11-12", "800")])
    assert (a["fee"], a["due"], a["paid_to"]) == ("paid", "0.00", "2026-12-15")

    # Stopped paying: joined 15 Jun, paid twice (→ paid to 15 Aug). Unpaid months
    # starting 15 Aug, 15 Sep, 15 Oct (15 Nov not yet) = 3 × ₹800 = ₹2,400; late since
    # 15 Aug = 89 days.
    b = student(client, shifts, "Bala Stopped", 2, "Morning", "2026-06-15",
                [("2026-06-15", "800"), ("2026-07-20", "800")])
    assert (b["fee"], b["due"], b["days_late"], b["paid_to"]) == ("over", "2400.00", 89, "2026-08-15")

    # Behind AND put down a part: as Bala, plus ₹300 on 2 Oct. Still 3 months unpaid;
    # ₹2,400 − ₹300 = ₹2,100, and the status is Overdue, never "Part paid".
    c = student(client, shifts, "Chetan PartLate", 3, "Morning", "2026-06-15",
                [("2026-06-15", "800"), ("2026-07-20", "800"), ("2026-10-02", "300")])
    assert (c["fee"], c["due"], c["credit"]) == ("over", "2100.00", "300.00")

    # Part paid and NOT late: Full day ₹1,200, joined 20 Oct, paid ₹1,200 (→ 20 Nov) and
    # ₹500 on 10 Nov → credit ₹500, rest of the next month ₹700; 8 days to 20 Nov.
    d = student(client, shifts, "Divya PartOnTime", 4, "Full day", "2026-10-20",
                [("2026-10-20", "1200"), ("2026-11-10", "500")])
    assert (d["fee"], d["due"], d["paid_to"]) == ("part", "700.00", "2026-11-20")

    # Paid three months ahead in one go: Evening ₹600, joined 1 Oct, ₹1,800 on 1 Oct →
    # paid to 1 Jan 2027 → Paid.
    e = student(client, shifts, "Esha Ahead", 5, "Evening", "2026-10-01", [("2026-10-01", "1800")])
    assert (e["fee"], e["paid_to"]) == ("paid", "2027-01-01")

    # Joined on the 31st: 31 Aug → 30 Sep → 31 Oct → 30 Nov (the day comes back, never
    # drifts to the 30th). Paid 3 months → paid to 30 Nov: 18 days → Paid.
    f = student(client, shifts, "Farhan ThirtyFirst", 6, "Morning", "2026-08-31",
                [("2026-08-31", "800"), ("2026-09-30", "800"), ("2026-10-31", "800")])
    assert f["paid_to"] == "2026-11-30"
    # …and one more month lands on 31 Dec, not 30 Dec.
    nxt = client.post(ROOT + f"students/{f['id']}/payments?preview=true", {"amount": "800"}, format="json").json()["data"]
    assert nxt["paid_to"] == "2026-12-31"

    # Due soon: Morning, joined 15 Oct, paid once → paid to 15 Nov, 3 days away → Due
    # soon, ₹800.
    g = student(client, shifts, "Gita DueSoon", 7, "Morning", "2026-10-15", [("2026-10-15", "800")])
    assert (g["fee"], g["due"]) == ("soon", "800.00")

    # Never paid since joining 1 Oct: due on 1 Oct and on 1 Nov → 2 × ₹800, 42 days late.
    h = student(client, shifts, "Hari NeverPaid", 8, "Morning", "2026-10-01")
    assert (h["fee"], h["due"], h["days_late"]) == ("over", "1600.00", 42)

    # Home and Fees agree with the people above, added by hand:
    #   Overdue = Bala 2,400 + Chetan 2,100 + Hari 1,600 = ₹6,100, 3 students
    #   Due this week = Divya 700 (20 Nov is within 7 days? 8 days → no) + Gita 800 = ₹800, 1 student
    #   Collected this month (Nov) = Asha 800 + Divya 500 = ₹1,300 in 2 payments
    home = client.get(ROOT + "home").json()["data"]
    assert (home["overdue"], home["overdue_students"]) == ("6100.00", 3)
    assert (home["due_week"], home["due_week_students"]) == ("800.00", 1)
    assert (home["collected"], home["payments"]) == ("1300.00", 2)
    fees = client.get(ROOT + "fees?fee=over").json()["data"]
    assert sorted(r["name"] for r in fees["rows"]) == ["Bala Stopped", "Chetan PartLate", "Hari NeverPaid"]
    assert sum(Decimal(r["due"]) for r in fees["rows"]) == Decimal("6100.00")
    assert fees["counts"]["over"] == 3 and fees["counts"]["part"] == 1 and fees["counts"]["soon"] == 1

    # Income & expenses for October: Bala/Chetan none, Chetan 300 (2 Oct), Divya 1,200,
    # Esha 1,800, Farhan 800 (31 Oct), Gita 800, Asha 800 (15 Oct) = ₹5,700.
    money = client.get(ROOT + "money?from=2026-10-01&to=2026-10-31").json()["data"]
    assert money["fees"] == "5700.00"

    # The reminder carries the same figures and dates, in the library's name.
    text = client.get(ROOT + f"messages/text?student={b['id']}&kind=fee_due&lang=en").json()["data"]["text"]
    assert "₹2,400" in text and "15 Aug" in text and "Gyan Study Library" in text and "gyan@upi" in text
    soon = client.get(ROOT + f"messages/text?student={g['id']}&kind=fee_due&lang=en").json()["data"]["text"]
    assert "is due on 15 Nov" in soon and "₹800" in soon
    hi = client.get(ROOT + f"messages/text?student={c['id']}&kind=fee_due&lang=hi").json()["data"]["text"]
    assert "₹2,100" in hi


def test_a_back_dated_payment_is_today_s_money_only_on_its_own_day(room):
    """Money collected is counted on the day it was paid, not the day it was typed."""
    client, shifts = room
    student(client, shifts, "Back Dated", 9, "Morning", "2026-10-01", [("2026-10-05", "800")])
    home = client.get(ROOT + "home").json()["data"]
    assert home["collected"] == "0.00"  # paid in October, entered now
    october = client.get(ROOT + "money?from=2026-10-01&to=2026-10-31").json()["data"]
    assert october["fees"] == "800.00"


def test_a_payment_cannot_be_dated_in_the_future(room):
    client, shifts = room
    s = student(client, shifts, "Future", 10, "Morning", "2026-10-01")
    r = client.post(ROOT + f"students/{s['id']}/payments", {"amount": "800", "paid_on": "2026-11-13"},
                    format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()))
    assert r.status_code == 400
