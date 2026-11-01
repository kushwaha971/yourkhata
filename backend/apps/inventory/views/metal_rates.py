"""G1 — today's metal rate (design §G1). Only a business with the `rates`
feature on sees it: any other answers 404, as a page that does not exist for
that kind (Part G: "no other kind ever sees it")."""

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
from apps.inventory.services import metal_rates

_READ = HasPermission("inventory.item.read")
#: Setting the day's rate is pricing authority, the item WRITE right: staff
#: bill at the rate and never set it.
_WRITE = HasPermission("inventory.item.write")


class _RatesView(APIView):
    def get_permissions(self) -> list[Any]:
        gate = _WRITE if self.request.method == "PUT" else _READ
        return [IsAuthenticated(), ModuleEnabled(ModuleCode.INVENTORY)(), gate()]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "rates" not in features_of(get_effective_tenant(request)):
            raise NotFound("Today's rate is not used by this business.")


class TodayRateView(_RatesView):
    def get(self, request: Any) -> Any:
        return StandardResponse.ok(metal_rates.today_view(tenant=get_effective_tenant(request)))

    def put(self, request: Any) -> Any:
        return StandardResponse.ok(metal_rates.save_today(ctx=Ctx.from_request(request), data=request.data))


class RateHistoryView(_RatesView):
    def get(self, request: Any) -> Any:
        return StandardResponse.ok(
            metal_rates.month_rows(tenant=get_effective_tenant(request), month=request.query_params.get("month"))
        )
