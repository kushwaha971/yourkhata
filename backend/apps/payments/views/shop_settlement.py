"""BP-08 (R-DEC-26) — settle a Shop contact's customer and supplier balances.

    GET  /payments/shop-settlements?party_id=…            this contact's two balances,
                                                           the most that can be settled,
                                                           and their settlements
    POST /payments/shop-settlements                       settle (idempotent)
    GET  /payments/shop-settlements/candidates            dual-role people to settle (Home)
    POST /payments/shop-settlements/{id}/share            the message, for the merchant to edit

Undoing one is `POST /payments/{id}/void` on either half: both go together.

Who: reading needs `payments.payment.read` AND `parties.party.read`, both in the
Shop book; settling needs `payments.payment.write` in the Shop book — it records
a receipt from the customer and a payment to the supplier, and that is the
codename both of those take — plus `parties.party.read`, because the dialog
shows both role balances. Sales and purchases must both be switched on: a
settlement settles an invoice against a bill. Never another app's grant (DEC-019).
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.book_access import require_book
from apps.common.constants import ModuleCode
from apps.common.context import Ctx
from apps.common.exceptions import NotFound, ValidationFailed
from apps.common.idempotency import idempotent
from apps.common.permissions import ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.throttling import ScopedUserRateThrottle
from apps.common.viewsets import TenantScopeMixin
from apps.payments.models import ShopSettlement
from apps.payments.selectors.shop_settlements import (
    party_settlements,
    settlement_candidates,
    settlement_view,
)
from apps.payments.services.shop_settlement import (
    money_text,
    role_balances,
    settle_shop_roles,
    settleable,
    settlement_documents,
    settlement_share_text,
)

READ = ("payments.payment.read", "parties.party.read")
WRITE = ("payments.payment.write", "parties.party.read")


class _SettlementBase(TenantScopeMixin, APIView):
    permission_classes = [
        IsAuthenticated,
        ModuleEnabled(ModuleCode.PAYMENTS),
        ModuleEnabled(ModuleCode.SALES),
        ModuleEnabled(ModuleCode.PURCHASES),
    ]

    def get_throttles(self) -> list[Any]:
        scope = "user" if self.request.method in ("GET", "HEAD", "OPTIONS") else "ledger_write"
        return [ScopedUserRateThrottle(scope)]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        codenames = READ if request.method in ("GET", "HEAD", "OPTIONS") else WRITE
        for codename in codenames:
            require_book(request, "shop", codename)  # 403 before any read or replay


def _party_id(raw: Any) -> str:
    try:
        return str(uuid.UUID(str(raw)))
    except (TypeError, ValueError):
        raise ValidationFailed({"party_id": ["Choose a contact."]}) from None


class SettleSerializer(serializers.Serializer):
    party_id = serializers.UUIDField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    note = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    expected = serializers.DictField(required=False)


class ShopSettlementView(_SettlementBase):
    def get(self, request: Any) -> Any:
        tenant = self.get_tenant()
        party_id = _party_id(request.query_params.get("party_id"))
        from apps.parties.models import Party

        party = Party.objects.for_tenant(tenant).filter(pk=party_id).first()
        balances = role_balances(tenant=tenant, party_id=party_id) if party else None
        if party is None or balances is None:
            raise NotFound("No such contact.")
        return StandardResponse.ok(
            {
                "party": {
                    "id": str(party.id),
                    "name": party.name,
                    "is_customer": party.is_customer,
                    "is_supplier": party.is_supplier,
                    "status": party.status,
                },
                **money_text(balances),
                "max_amount": f"{settleable(balances):.2f}",
                # Which bills a settlement reaches, oldest first, for the dialog to name.
                "documents": settlement_documents(tenant=tenant, party_id=party_id),
                "settlements": party_settlements(tenant=tenant, party_id=party_id),
            }
        )

    @idempotent("shop_settlement")
    def post(self, request: Any) -> Any:
        serializer = SettleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = settle_shop_roles(
            ctx=Ctx.from_request(request),
            party_id=data["party_id"],
            amount=data["amount"],
            note=data.get("note") or "",
            expected=data.get("expected"),
        )
        settlement = (
            ShopSettlement.objects.select_related("in_payment", "out_payment", "created_by")
            .filter(pk=result["settlement"].pk)
            .get()
        )
        return StandardResponse.created(
            settlement_view(settlement),
            meta={
                "max_amount": f"{settleable(result['after']):.2f}",
                "documents": result["documents"],
            },
        )


class ShopSettlementCandidatesView(_SettlementBase):
    def get(self, request: Any) -> Any:
        return StandardResponse.ok(settlement_candidates(tenant=self.get_tenant()))


class ShopSettlementShareView(_SettlementBase):
    def post(self, request: Any, pk: Any) -> Any:
        settlement = get_object_or_404(
            ShopSettlement.objects.filter(tenant=self.get_tenant()).select_related(
                "party", "tenant", "in_payment", "out_payment"
            ),
            pk=pk,
        )
        if settlement.voided_at is not None:
            raise NotFound("This settlement was undone.")
        text = settlement_share_text(settlement, locale=request.data.get("locale"))
        return StandardResponse.ok({"text": text, "mobile": settlement.party.mobile})
