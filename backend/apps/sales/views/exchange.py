"""G6 — exchange at the counter. Only a business that sells in sizes and colours
(a clothes or shoe shop by default) has it; any other answers 404."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.constants import ModuleCode
from apps.common.context import Ctx
from apps.common.exceptions import NotFound
from apps.common.idempotency import idempotent
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.tenancy import get_effective_tenant
from apps.sales.services import exchange


class ExchangeView(APIView):
    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            ModuleEnabled(ModuleCode.SALES)(),
            HasPermission("sales.invoice.write")(),
            HasPermission("sales.credit_note.write")(),
        ]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "variants" not in features_of(get_effective_tenant(request)):
            raise NotFound("Exchange is kept by shops that sell in sizes.")

    @idempotent("sales_exchange")
    def post(self, request: Any) -> Any:
        result = exchange.make_exchange(ctx=Ctx.from_request(request), data=request.data)
        return StandardResponse.created(exchange.view(result))
