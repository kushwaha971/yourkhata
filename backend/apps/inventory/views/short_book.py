"""G4 — the medical store's short book and same-salt substitutes (design dShortBook, pSubst)."""

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
from apps.inventory.services import short_book

#: Anyone who bills may READ the book and write an ask into it: the counter is
#: where a medicine is found missing. Closing rows is the buyer's act.
_READ = HasPermission("inventory.item.read")
_WRITE = HasPermission("inventory.item.write")


class _MedicineView(APIView):
    write_methods: tuple[str, ...] = ()

    def get_permissions(self) -> list[Any]:
        gate = _WRITE if self.request.method in self.write_methods else _READ
        return [IsAuthenticated(), ModuleEnabled(ModuleCode.INVENTORY)(), gate()]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        # A medicine's batches are what make a business a medical store here.
        if "batches" not in features_of(get_effective_tenant(request)):
            raise NotFound("The short book is used by medical stores.")


class ShortBookView(_MedicineView):
    def get(self, request: Any) -> Any:
        book = short_book.short_book(tenant=get_effective_tenant(request))
        return StandardResponse.ok(book["rows"], meta={"counts": book["counts"]})

    def post(self, request: Any) -> Any:
        body = request.data if isinstance(request.data, dict) else {}
        result = short_book.add(
            ctx=Ctx.from_request(request),
            item_id=body.get("item_id"),
            reason=body.get("reason") or "asked",
            qty=body.get("qty"),
        )
        return StandardResponse.created(result) if result["created"] else StandardResponse.ok(result)


class ShortBookOrderedView(_MedicineView):
    write_methods = ("POST",)

    def post(self, request: Any) -> Any:
        body = request.data if isinstance(request.data, dict) else {}
        closed = short_book.mark_ordered(ctx=Ctx.from_request(request), item_ids=body.get("item_ids"))
        return StandardResponse.ok({"closed": closed})


class SubstitutesView(_MedicineView):
    def get(self, request: Any, pk: str) -> Any:
        return StandardResponse.ok(
            short_book.substitutes(tenant=get_effective_tenant(request), item_id=pk)
        )
