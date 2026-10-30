"""`/stock-counts` — C3 stock count (R-DEC-67).

Counting is `inventory.stock.read`; saving is `inventory.stock.adjust`, the
same right a stock adjustment needs, because saving moves stock. Value figures
follow the inventory cost gate (`reports.financial.read`) and are left out of
the response, not zeroed, for anybody without it.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Exists, OuterRef, Q, Subquery
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.common.constants import ModuleCode
from apps.common.money import q2, q3
from apps.common.pagination import PagePagination
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.inventory.constants import ItemStatus, ItemType
from apps.inventory.models import Item, ItemStock, StockCount, StockCountLine
from apps.inventory.services import stock_counts as svc
from apps.inventory.views.items import _body, _InventoryView, _valuation_visible

StockCountPermissions = HasPermission(
    {
        "open": "inventory.stock.read",
        "retrieve": "inventory.stock.read",
        "lines": "inventory.stock.read",
        "count": "inventory.stock.read",
        "save": "inventory.stock.adjust",
    }
)


def _countable(tenant: Any):
    return Item.objects.filter(
        tenant=tenant, item_type=ItemType.GOODS, track_stock=True, status=ItemStatus.ACTIVE
    )


class StockCountViewSet(_InventoryView, viewsets.ViewSet):
    permission_classes = [
        IsAuthenticated,
        ModuleEnabled(ModuleCode.INVENTORY),
        StockCountPermissions,
    ]

    def _summary(self, count: StockCount) -> dict:
        lines = list(StockCountLine.objects.filter(count=count).select_related("item"))
        differing = [line for line in lines if line.counted_qty != line.books_qty]
        data = {
            "id": str(count.id),
            "status": count.status,
            "started_at": count.created_at.isoformat(),
            "saved_at": count.saved_at.isoformat() if count.saved_at else None,
            "counted": len(lines),
            "differ": len(differing),
            "items_total": _countable(self.get_tenant()).count(),
        }
        if _valuation_visible(self.request):
            avg = dict(
                ItemStock.objects.filter(
                    tenant=count.tenant,
                    location=count.location,
                    item_id__in=[line.item_id for line in differing],
                ).values_list("item_id", "avg_cost")
            )
            total = sum(
                (
                    (line.counted_qty - line.books_qty) * avg.get(line.item_id, Decimal("0"))
                    for line in differing
                ),
                Decimal("0"),
            )
            data["value_change"] = str(q2(total))
        return data

    @action(detail=False, methods=["post"])
    def open(self, request: Any) -> Any:
        """Start a count, or join the one already open on another phone."""
        return StandardResponse.ok(self._summary(svc.open_count(ctx=self.ctx())))

    def retrieve(self, request: Any, pk: Any = None) -> Any:
        return StandardResponse.ok(self._summary(svc.get_count(ctx=self.ctx(), count_id=pk)))

    @action(detail=True, methods=["get"])
    def lines(self, request: Any, pk: Any = None) -> Any:
        """Every countable item with its count: counted first (newest first),
        then the rest by name, so what was just scanned is at the top."""
        count = svc.get_count(ctx=self.ctx(), count_id=pk)
        tenant = self.get_tenant()
        line = StockCountLine.objects.filter(count=count, item=OuterRef("pk"))
        stock = ItemStock.objects.filter(tenant=tenant, item=OuterRef("pk"), location=count.location)
        qs = (
            _countable(tenant)
            .select_related("unit")
            .annotate(
                is_counted=Exists(line),
                counted_qty=Subquery(line.values("counted_qty")[:1]),
                books_qty=Subquery(line.values("books_qty")[:1]),
                counted_at=Subquery(line.values("counted_at")[:1]),
                on_hand=Subquery(stock.values("on_hand")[:1]),
                avg_cost=Subquery(stock.values("avg_cost")[:1]),
            )
        )
        q = (request.query_params.get("q") or "").strip()[:80]
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(sku__icontains=q) | Q(barcode=q))
        show = request.query_params.get("show")
        if show == "counted":
            qs = qs.filter(is_counted=True)
        qs = qs.order_by("-is_counted", "-counted_at", "name", "id")
        valuation = _valuation_visible(request)
        paginator = PagePagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        rows = []
        for item in page:
            books = item.books_qty if item.is_counted else (item.on_hand or Decimal("0"))
            row = {
                "item_id": str(item.id),
                "name": item.name,
                "sku": item.sku,
                "barcode": item.barcode,
                "unit_code": item.unit.code,
                "allow_decimal": item.unit.allow_decimal,
                "books_qty": str(q3(books)),
                "counted_qty": str(item.counted_qty) if item.is_counted else None,
                "difference": str(q3(item.counted_qty - books)) if item.is_counted else None,
            }
            if valuation and item.is_counted:
                row["value_change"] = str(
                    q2((item.counted_qty - books) * (item.avg_cost or Decimal("0")))
                )
            rows.append(row)
        return paginator.get_paginated_response(rows)

    @action(detail=True, methods=["put", "delete"], url_path=r"lines/(?P<item_id>[^/]+)")
    def count(self, request: Any, pk: Any = None, item_id: Any = None) -> Any:
        """PUT `{qty}` sets what is on the shelf; `{add: 1}` is a scan."""
        count = svc.get_count(ctx=self.ctx(), count_id=pk)
        if request.method == "DELETE":
            svc.uncount(ctx=self.ctx(), count=count, item_id=item_id)
            return StandardResponse.ok(self._summary(count))
        body = _body(request)
        line = svc.set_counted(
            ctx=self.ctx(), count=count, item_id=item_id, qty=body.get("qty"), add=body.get("add")
        )
        return StandardResponse.ok(
            {
                "item_id": str(line.item_id),
                "counted_qty": str(line.counted_qty),
                "books_qty": str(line.books_qty),
                "difference": str(q3(line.counted_qty - line.books_qty)),
                "summary": self._summary(count),
            }
        )

    @action(detail=True, methods=["post"])
    def save(self, request: Any, pk: Any = None) -> Any:
        count = svc.save_count(ctx=self.ctx(), count=svc.get_count(ctx=self.ctx(), count_id=pk))
        return StandardResponse.ok(self._summary(count))
