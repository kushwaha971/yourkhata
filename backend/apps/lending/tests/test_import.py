"""Running loans from the paper register (QA F10, rebuilt with Lending 12 Nov 2026)."""

from __future__ import annotations

from typing import Any

import pytest
from django.urls import reverse

from apps.imports.tests.helpers import detail, upload
from apps.lending import selectors, services
from apps.lending.models import Borrower, Collection, Loan
from apps.lending.tests.test_lending import TODAY, entitle

pytestmark = pytest.mark.django_db
HEADER = "name,mobile,work,route,lent,frequency,count,each,given_on,collected"


@pytest.fixture
def lender(tenant: Any, api_as: Any, monkeypatch: Any) -> Any:
    entitle(tenant)
    tenant.enabled_modules = sorted({*tenant.enabled_modules, "import_export"})
    tenant.save(update_fields=["enabled_modules"])
    monkeypatch.setattr(services, "today", lambda _t: TODAY)
    monkeypatch.setattr(selectors, "today", lambda _t: TODAY)
    client, _ = api_as(tenant, role="owner")
    return client


def _commit(client: Any, job_id: str, capture: Any) -> Any:
    with capture(execute=True):
        return client.post(reverse("v1:import-commit", args=[job_id]), {}, format="json")


def test_running_loans_come_in_with_what_was_collected_as_history(lender, tenant, django_capture_on_commit_callbacks):
    """Sunil: 40 × 500 from 2 Nov, ₹4,500 collected → one collection dated 11 Nov (the last
    collection day before 12 Nov), nothing late, left ₹15,500; the route is added."""
    text = "\n".join([HEADER, "Sunil Mane,9822041178,Tea stall,Market road,20000,daily,40,500,02/11/2026,4500"])
    job = detail(lender, upload(lender, "loans", text, capture=django_capture_on_commit_callbacks).json()["data"]["id"])
    assert job["status"] == "ready", job["errors"]
    assert _commit(lender, job["id"], django_capture_on_commit_callbacks).status_code == 202
    loan = Loan.objects.get(borrower__name="Sunil Mane")
    paid = Collection.objects.get(loan=loan)
    assert (str(paid.amount), paid.collected_on.isoformat()) == ("4500.00", "2026-11-11")
    data = lender.get(f"/api/v1/lending/loans/{loan.pk}").json()["data"]
    assert (data["late"], data["left"], data["route"]) == ("0.00", "15500.00", "Market road")


def test_a_row_that_cannot_be_a_loan_is_named(lender, tenant, django_capture_on_commit_callbacks):
    text = "\n".join([
        HEADER,
        "Short,9822041179,,,20000,daily,30,500,02/11/2026,",   # brings back 15,000 < 20,000
        "Odd,9822041180,,,1000,yearly,10,100,02/11/2026,",     # no such plan
        "TooMuch,9822041181,,,1000,daily,2,500,02/11/2026,2000",  # more collected than the loan
    ])
    job = detail(lender, upload(lender, "loans", text, capture=django_capture_on_commit_callbacks).json()["data"]["id"])
    assert {(e["row"], e["column"]) for e in job["errors"]} == {(2, "each"), (3, "frequency"), (4, "collected")}
    assert not Borrower.objects.filter(tenant=tenant).exists()
