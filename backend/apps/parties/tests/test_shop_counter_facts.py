"""BP-09: Shop rows cannot net roles or borrow Udhaar money."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.common.dates import tenant_today
from apps.parties.selectors.shop import shop_party_facts
from apps.purchases.models import PurchaseDocument
from apps.sales.models import SalesDocument
from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db


def sale(
    tenant, party, *, amount="1000.00", days=42, kind="invoice", status="issued", number="INV-1"
):
    today = tenant_today(tenant)
    return SalesDocument.objects.create(
        tenant=tenant,
        party=party,
        kind=kind,
        status=status,
        number=None if status == "draft" else number,
        fy_label="26-27",
        document_date=today - dt.timedelta(days=50),
        due_on=today - dt.timedelta(days=days),
        place_of_supply_state="27",
        grand_total=Decimal(amount),
        amount_due=Decimal(amount),
        issued_at=None if status == "draft" else timezone.now(),
    )


def test_dual_role_lists_use_their_own_documents_not_the_signed_cache(tenant, api_as):
    """1000 customer due and 600 supplier due must never become 400."""
    party = PartyFactory(
        tenant=tenant,
        is_customer=True,
        is_supplier=True,
        balance=Decimal("9000"),
        shop_balance=Decimal("400"),
    )
    sale(tenant, party)
    PurchaseDocument.objects.create(
        tenant=tenant,
        party=party,
        kind="purchase_bill",
        status="recorded",
        number="PB-1",
        fy_label="26-27",
        document_date=timezone.localdate(),
        due_on=timezone.localdate(),
        place_of_supply_state="27",
        grand_total=Decimal("600"),
        amount_due=Decimal("600"),
    )
    client, _ = api_as(tenant)
    customer = client.get(reverse("v1:party-list"), {"book": "shop", "type": "customer"})
    supplier = client.get(reverse("v1:party-list"), {"book": "shop", "type": "supplier"})
    assert customer.status_code == supplier.status_code == 200
    assert customer.json()["data"][0]["balance"] == "1000.00"
    assert supplier.json()["data"][0]["balance"] == "-600.00"
    assert customer.json()["meta"]["totals"]["receivable"] == "1000.00"
    assert supplier.json()["meta"]["totals"]["payable"] == "600.00"
    assert customer.json()["data"][0]["shop"]["days_overdue"] == 42
    # The Shop home must reconcile to the same two lists, never its old 400 cache.
    from apps.reports.selectors.dashboard import party_tiles

    tiles = party_tiles(tenant=tenant, today=tenant_today(tenant))
    assert tiles["to_collect"]["amount"] == "1000.00"
    assert tiles["to_pay"]["amount"] == "600.00"
    main = client.get(reverse("v1:party-list"), {"type": "customer"})
    assert main.json()["data"][0]["balance"] == "9000.00"
    assert "shop" not in main.json()["data"][0]


def test_late_filter_uses_bill_due_date_and_ignores_drafts(tenant, api_as):
    """A promise date or Udhaar balance is not bill lateness."""
    late = PartyFactory(tenant=tenant, is_customer=True, balance=Decimal("0"))
    future = PartyFactory(tenant=tenant, is_customer=True, balance=Decimal("10000"))
    draft = PartyFactory(tenant=tenant, is_customer=True)
    sale(tenant, late)
    sale(tenant, future, days=-5, number="INV-2")
    sale(tenant, draft, status="draft", number="INV-3")
    client, _ = api_as(tenant)
    rows = client.get(
        reverse("v1:party-list"), {"book": "shop", "type": "customer", "late": "over_30"}
    ).json()["data"]
    assert [row["id"] for row in rows] == [str(late.id)]
    rows = client.get(
        reverse("v1:party-list"), {"book": "shop", "type": "customer", "ordering": "oldest_due_on"}
    ).json()["data"]
    assert rows[0]["id"] == str(late.id)
    assert next(row for row in rows if row["id"] == str(draft.id))["balance"] == "0.00"


def test_open_credit_is_only_a_credit_for_its_own_role(tenant):
    """A customer's credit note cannot reduce supplier payables."""
    party = PartyFactory(tenant=tenant, is_customer=True, is_supplier=True)
    sale(tenant, party)
    sale(tenant, party, amount="200", kind="credit_note", number="CN-1")
    facts = shop_party_facts(tenant=tenant, party_id=party.id)
    assert facts.shop_customer_balance == Decimal("800")
    assert facts.shop_supplier_balance == Decimal("0")


def test_shop_reminder_is_fresh_editable_and_does_not_use_udhaar(tenant, api_as):
    """Shop preview/send must not quote the unrelated 9000 Udhaar balance."""
    party = PartyFactory(
        tenant=tenant, is_customer=True, mobile="+919812345678", balance=Decimal("9000")
    )
    sale(tenant, party)
    client, _ = api_as(tenant)
    preview = client.post(
        reverse("v1:reminder-preview"), {"party_id": str(party.id), "book": "shop"}, format="json"
    )
    assert preview.status_code == 200
    assert preview.json()["data"]["balance"] == "1000.00"
    created = client.post(
        reverse("v1:reminder-list"),
        {"party_id": str(party.id), "book": "shop", "channel": "whatsapp_manual"},
        format="json",
    )
    assert created.status_code == 201
    from apps.ledger.models import Reminder
    from apps.notifications.models import MessageLog

    reminder = Reminder.objects.get(pk=created.json()["data"]["id"])
    assert reminder.module == "sales"
    sent = client.post(
        reverse("v1:reminder-send", args=[reminder.id]),
        {"text": "Please pay the remaining bill amount. Shanti Stores"},
        format="json",
    )
    assert sent.status_code == 200
    reminder.refresh_from_db()
    assert reminder.snapshot_balance == Decimal("1000")
    assert (
        MessageLog.objects.get(pk=reminder.message_log_id).payload["body"]
        == "Please pay the remaining bill amount. Shanti Stores"
    )
    old = client.post(reverse("v1:reminder-preview"), {"party_id": str(party.id)}, format="json")
    assert old.json()["data"]["balance"] == "9000.00"


def test_advances_are_scoped_by_role_bucket_and_refund_kind(tenant):
    """A supplier payment, loan advance or refund must not become customer advance."""
    from apps.payments.models import Payment

    party = PartyFactory(tenant=tenant, is_customer=True, is_supplier=True)
    sale(tenant, party)
    PurchaseDocument.objects.create(
        tenant=tenant,
        party=party,
        kind="purchase_bill",
        status="recorded",
        number="PB-A",
        fy_label="26-27",
        document_date=timezone.localdate(),
        place_of_supply_state="27",
        grand_total=Decimal("600"),
        amount_due=Decimal("600"),
    )
    for index, (direction, bucket, amount, meta) in enumerate(
        [
            ("in", "shop", "200", {}),
            ("out", "shop", "100", {}),
            ("in", "loan", "5000", {}),
            ("out", "shop", "300", {"credit_note_id": "a-refund"}),
        ]
    ):
        Payment.objects.create(
            tenant=tenant,
            party=party,
            number=f"TEST-{index}",
            direction=direction,
            bucket=bucket,
            payment_date=timezone.localdate(),
            amount=Decimal(amount),
            unallocated_amount=Decimal(amount),
            mode_breakup=[{"mode": "cash", "amount": amount}],
            primary_mode="cash",
            status="recorded",
            meta=meta,
        )
    facts = shop_party_facts(tenant=tenant, party_id=party.id)
    assert facts.shop_customer_balance == Decimal("800")
    assert facts.shop_supplier_balance == Decimal("500")


def test_paid_and_refunded_credit_documents_cannot_create_ghost_dues(tenant):
    """Use current open due/credit, not original invoice or return totals."""
    party = PartyFactory(tenant=tenant, is_customer=True)
    invoice = sale(tenant, party)
    SalesDocument.objects.filter(pk=invoice.id).update(
        status="paid", amount_paid=Decimal("1000"), amount_due=Decimal("0")
    )
    note = sale(tenant, party, kind="credit_note", number="CN-R", amount="200")
    SalesDocument.objects.filter(pk=note.id).update(amount_due=Decimal("0"))
    assert shop_party_facts(tenant=tenant, party_id=party.id).shop_customer_balance == Decimal("0")


def test_shop_reads_have_constant_query_count_and_stay_tenant_scoped(tenant):
    """Twenty parties still use one SQL query; another tenant contributes nothing."""
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    from apps.parties.models import Party
    from apps.parties.selectors.shop import with_shop_facts
    from tests.factories.platform import TenantFactory

    parties = [PartyFactory(tenant=tenant, is_customer=True) for _ in range(20)]
    for index, party in enumerate(parties):
        sale(tenant, party, number=f"INV-Q{index}")
    other = TenantFactory()
    foreign = PartyFactory(tenant=other, is_customer=True)
    sale(other, foreign, number="INV-OTHER", amount="9999")
    with CaptureQueriesContext(connection) as captured:
        rows = list(with_shop_facts(Party.objects.for_tenant(tenant), tenant=tenant))
    assert len(captured) == 1
    assert len(rows) == 20
    assert all(row.shop_customer_balance == Decimal("1000") for row in rows)


def test_detail_has_both_roles_and_reminder_history_keeps_its_book(tenant, api_as):
    """Opening a customer must not revert to the combined cached Shop balance."""
    party = PartyFactory(
        tenant=tenant, is_customer=True, balance=Decimal("9000"), shop_balance=Decimal("400")
    )
    sale(tenant, party)
    client, _ = api_as(tenant)
    details = client.get(reverse("v1:party-detail", args=[party.id]), {"book": "shop"})
    assert details.status_code == 200
    assert details.json()["data"]["shop"]["customer_balance"] == "1000.00"
    for book in ("main", "shop"):
        response = client.post(
            reverse("v1:reminder-list"),
            {"party_id": str(party.id), "book": book, "channel": "whatsapp_manual"},
            format="json",
        )
        assert response.status_code == 201
    for book, module in (("main", ""), ("shop", "sales")):
        response = client.get(
            reverse("v1:reminder-list"), {"party_id": str(party.id), "book": book}
        )
        assert response.json()["meta"]["total"] == 1
        assert response.json()["data"][0]["module"] == module


def test_shop_reminder_rechecks_payment_and_rejects_unknown_books(tenant, api_as):
    """The stored send snapshot must reflect payments after preview, not a stale screen."""
    from apps.ledger.models import Reminder

    party = PartyFactory(tenant=tenant, is_customer=True, mobile="+919812345678")
    invoice = sale(tenant, party)
    client, _ = api_as(tenant)
    response = client.post(
        reverse("v1:reminder-list"),
        {"party_id": str(party.id), "book": "shop", "channel": "whatsapp_manual"},
        format="json",
    )
    assert response.status_code == 201
    SalesDocument.objects.filter(pk=invoice.id).update(
        amount_due=Decimal("250"), amount_paid=Decimal("750"), status="partially_paid"
    )
    response = client.post(
        reverse("v1:reminder-send", args=[response.json()["data"]["id"]]), format="json"
    )
    assert response.status_code == 200
    assert Reminder.objects.get().snapshot_balance == Decimal("250")
    wrong = client.post(
        reverse("v1:reminder-preview"),
        {"party_id": str(party.id), "book": "not-a-book"},
        format="json",
    )
    assert wrong.status_code == 400
