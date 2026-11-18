"""`/locations` and `/stock-transfers` — D P1c godowns (design D10 "Move stock").

Listing places and stock in each is the stock READ right; adding a place and
moving stock is the stock ADJUST right, the same as an adjustment, because a
transfer moves stock.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import OuterRef, Q, Subquery
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.common.constants import ModuleCode
from apps.common.exceptions import ValidationFailed
from apps.common.idempotency import idempotent
from apps.common.money import q3
from apps.common.pagination import PagePagination
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.inventory.constants import ItemStatus, ItemType
from apps.inventory.models import Item, ItemStock, Location, StockMovement
from apps.inventory.services import transfers as svc
from apps.inventory.services.stock import default_location
from apps.inventory.views.items import _body, _InventoryView

LocationPermissions = HasPermission(
    {"list": "inventory.stock.read", "create": "inventory.stock.adjust"}
)
TransferPermissions = HasPermission(
    {"stock": "inventory.stock.read", "create": "inventory.stock.adjust"}
)


def location_dict(place: Location) -> dict:
    return {"id": str(place.id), "name": place.name, "code": place.code, "is_default": place.is_default}


class LocationViewSet(_InventoryView, viewsets.ViewSet):
    permission_classes = [IsAuthenticated, ModuleEnabled(ModuleCode.INVENTORY), LocationPermissions]

    def list(self, request: Any) -> Any:
        default_location(self.get_tenant())
        places = Location.objects.filter(tenant=self.get_tenant(), is_active=True).order_by(
            "-is_default", "created_at"
        )
        return StandardResponse.ok([location_dict(place) for place in places])

    def create(self, request: Any) -> Any:
        place = svc.add_location(ctx=self.ctx(), name=_body(request).get("name"))
        return StandardResponse.created(location_dict(place))


class StockTransferViewSet(_InventoryView, viewsets.ViewSet):
    permission_classes = [IsAuthenticated, ModuleEnabled(ModuleCode.INVENTORY), TransferPermissions]

    @action(detail=False, methods=["get"])
    def stock(self, request: Any) -> Any:
        """Items with what each of two places holds (`from`, `to`), for Move stock."""
        tenant = self.get_tenant()
        ids = [request.query_params.get("from"), request.query_params.get("to")]
        try:
            places = {str(p.id): p for p in Location.objects.filter(tenant=tenant, pk__in=[i for i in ids if i])}
        except (ValueError, TypeError):
            places = {}
        if not all(i in places for i in ids):
            raise ValidationFailed({"from": ["Choose two of your places."]})

        def held(location_id: str) -> Subquery:
            return Subquery(
                ItemStock.objects.filter(item=OuterRef("pk"), location_id=location_id).values("on_hand")[:1]
            )

        qs = Item.objects.filter(
            tenant=tenant, item_type=ItemType.GOODS, track_stock=True, status=ItemStatus.ACTIVE
        ).select_related("unit")
        q = (request.query_params.get("q") or "").strip()[:80]
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(sku__istartswith=q) | Q(barcode=q))
        only = request.query_params.get("ids")
        if only:
            qs = qs.filter(pk__in=[i for i in only.split(",") if i][:200])
        qs = qs.annotate(at_from=held(ids[0]), at_to=held(ids[1])).order_by("name", "id")
        paginator = PagePagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        zero = Decimal("0")
        return paginator.get_paginated_response(
            [
                {
                    "item_id": str(item.id),
                    "name": item.name,
                    "unit_code": item.unit.code,
                    "allow_decimal": item.unit.allow_decimal,
                    "at_from": str(q3(item.at_from or zero)),
                    "at_to": str(q3(item.at_to or zero)),
                }
                for item in page
            ]
        )

    def create(self, request: Any) -> Any:
        if not request.headers.get("Idempotency-Key"):
            raise ValidationFailed({"idempotency_key": ["Send an Idempotency-Key header."]})
        return self._create(request)

    @idempotent("stock_transfer_create")
    def _create(self, request: Any) -> Any:
        transfer = svc.post_transfer(ctx=self.ctx(), payload=_body(request))
        moves = StockMovement.objects.filter(
            tenant=self.get_tenant(), source_type="stock_transfer", source_id=transfer.id
        ).count()
        return StandardResponse.created(
            {
                "id": str(transfer.id),
                "number": transfer.number,
                "transfer_date": transfer.transfer_date.isoformat(),
                "from": location_dict(transfer.from_location),
                "to": location_dict(transfer.to_location),
                "movements": moves,
            }
        )
