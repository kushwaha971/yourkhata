"""G2a — a jeweller's tags (design D3/D5). Only a business with the
`jewellery` feature on sees them; any other answers 404."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.constants import ModuleCode
from apps.common.context import Ctx
from apps.common.exceptions import NotFound
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.tenancy import get_effective_tenant
from apps.inventory.models import Item
from apps.inventory.services import tags

_READ = HasPermission("inventory.item.read")
#: Adding a tag puts a piece into stock: the stock-adjust right, as a manual
#: stock adjustment needs.
_ADD = HasPermission("inventory.stock.adjust")


class _TagsView(APIView):
    def get_permissions(self) -> list[Any]:
        gate = _ADD if self.request.method == "POST" else _READ
        return [IsAuthenticated(), ModuleEnabled(ModuleCode.INVENTORY)(), gate()]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "jewellery" not in features_of(get_effective_tenant(request)):
            raise NotFound("Tags are not used by this business.")


class ItemTagsView(_TagsView):
    def _item(self, request: Any, pk: Any) -> Item:
        item = Item.objects.filter(tenant=get_effective_tenant(request), pk=pk).first()
        if item is None:
            raise NotFound("No such item.")
        return item

    def get(self, request: Any, pk: Any) -> Any:
        tenant = get_effective_tenant(request)
        return StandardResponse.ok(tags.item_tags(tenant=tenant, item=self._item(request, pk)))

    def post(self, request: Any, pk: Any) -> Any:
        return StandardResponse.created(
            tags.add_tag(ctx=Ctx.from_request(request), item=self._item(request, pk), data=request.data)
        )


class TagSummaryView(_TagsView):
    def get(self, request: Any) -> Any:
        return StandardResponse.ok({"in_stock": tags.in_stock_count(tenant=get_effective_tenant(request))})


class TagLookupView(_TagsView):
    """G2b — the bill's "Scan tag or search": a tag in stock and its line at
    today's rate. A sold or unknown tag is a 404 the counter can say aloud."""

    def get(self, request: Any) -> Any:
        found = tags.lookup(tenant=get_effective_tenant(request), tag_no=request.query_params.get("tag", ""))
        if found is None:
            raise NotFound("No tag in stock with this number.")
        return StandardResponse.ok(found)
