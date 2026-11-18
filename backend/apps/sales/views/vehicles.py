"""G8 — vehicle history. Only a business that keeps part numbers (auto parts by
default) has it; any other answers 404."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.constants import ModuleCode
from apps.common.exceptions import NotFound
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.tenancy import get_effective_tenant
from apps.sales.services import vehicles


class _View(APIView):
    def get_permissions(self) -> list[Any]:
        return [IsAuthenticated(), ModuleEnabled(ModuleCode.SALES)(), HasPermission("sales.invoice.read")()]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "part_numbers" not in features_of(get_effective_tenant(request)):
            raise NotFound("Vehicles are kept by auto parts shops.")


class VehiclesView(_View):
    def get(self, request: Any) -> Any:
        return StandardResponse.ok(
            vehicles.list_vehicles(tenant=get_effective_tenant(request), q=request.query_params.get("q", ""))
        )


class VehicleDetailView(_View):
    def get(self, request: Any, number: str) -> Any:
        return StandardResponse.ok(vehicles.vehicle_detail(tenant=get_effective_tenant(request), number=number))
