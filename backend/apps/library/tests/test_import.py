"""Students from the paper register (QA F10, rebuilt with the Library 12 Nov 2026)."""

from __future__ import annotations

import datetime as dt
from typing import Any

import pytest
from django.urls import reverse

from apps.common.dates import tenant_today
from apps.imports.tests.helpers import detail, upload
from apps.library.models import Payment, Shift, Student
from apps.library.services import seed_library, set_seat_count
from apps.library.tests.test_library import entitle

pytestmark = pytest.mark.django_db
HEADER = "name,mobile,shift,seat,monthly_fee,joined,paid_till"


def _d(day: dt.date) -> str:
    return day.strftime("%d/%m/%Y")


@pytest.fixture
def room(tenant: Any, api_as: Any) -> Any:
    entitle(tenant)
    tenant.enabled_modules = sorted({*tenant.enabled_modules, "import_export"})
    tenant.save(update_fields=["enabled_modules"])
    seed_library(None, tenant)
    Shift.objects.filter(tenant=tenant, name="Morning").update(monthly_fee=800)
    client, member = api_as(tenant, role="owner")
    set_seat_count(tenant=tenant, user=member.user, count=20)
    return client


def _commit(client: Any, job_id: str, capture: Any) -> Any:
    with capture(execute=True):
        return client.post(reverse("v1:import-commit", args=[job_id]), {}, format="json")


def test_the_register_comes_in_with_its_dates_and_no_money_today(room, tenant, django_capture_on_commit_callbacks):
    """Paid till a date in the register is the student's "paid to"; no payment is made."""
    today = tenant_today(tenant)
    joined, paid = today - dt.timedelta(days=60), today + dt.timedelta(days=20)
    text = "\n".join([
        HEADER,
        f"Asha Kumari,9876500011,Morning,12,,{_d(joined)},{_d(paid)}",
        f"Ravi Kumar,9876500012,morning,,900,{_d(joined)},",
    ])
    job = detail(room, upload(room, "students", text, capture=django_capture_on_commit_callbacks).json()["data"]["id"])
    assert job["status"] == "ready", job["errors"]
    assert _commit(room, job["id"], django_capture_on_commit_callbacks).status_code == 202
    asha = Student.objects.get(name="Asha Kumari")
    assert (asha.joined_on, asha.paid_to, asha.seat.number, str(asha.monthly_fee)) == (joined, paid, 12, "800.00")
    assert Student.objects.get(name="Ravi Kumar").paid_to is None
    assert not Payment.objects.exists()


def test_unknown_shift_taken_seat_and_known_mobile_are_named(room, tenant, django_capture_on_commit_callbacks):
    today = _d(tenant_today(tenant))
    text = "\n".join([
        HEADER,
        f"Asha,9876500011,Morning,3,,{today},",
        f"Ravi,9876500012,Night,,,{today},",
        f"Mina,9876500013,Full day,3,1200,{today},",
        f"Asha again,9876500011,Evening,,600,{today},",
    ])
    job = detail(room, upload(room, "students", text, capture=django_capture_on_commit_callbacks).json()["data"]["id"])
    problems = {(e["row"], e["column"]) for e in job["errors"]}
    assert (3, "shift") in problems and (4, "seat") in problems
    assert any(e["column"] == "mobile" for e in job["errors"])
