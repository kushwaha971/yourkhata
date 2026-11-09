"""Sales routes (canon §0.8) — mounted under `/sales/`."""

from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.sales.views.challans import DeliveryChallanViewSet
from apps.sales.views.credit_notes import CreditNoteViewSet
from apps.sales.views.estimates import EstimateViewSet
from apps.sales.views.custom_orders import (
    CustomOrderDetailView,
    CustomOrderPhotoView,
    CustomOrdersView,
    CustomOrderStatusView,
    JewelHomeView,
    KarigarDetailView,
    KarigarIssueView,
    KarigarLotView,
    KarigarMakeTagView,
    KarigarReceiveView,
    KarigarsView,
    OldGoldView,
    KarigarTagsDoneView,
)
from apps.sales.views.invoices import InvoiceViewSet
from apps.sales.views.exchange import ExchangeView
from apps.sales.views.repairs import RepairJobDetailView, RepairJobStageView, RepairJobsView
from apps.sales.views.schedule_h import ScheduleHRegisterView
from apps.sales.views.orders import SalesOrderViewSet

router = DefaultRouter(trailing_slash=False)
router.register("invoices", InvoiceViewSet, basename="sales-invoice")
router.register("estimates", EstimateViewSet, basename="sales-estimate")
router.register("orders", SalesOrderViewSet, basename="sales-order")
router.register("delivery-challans", DeliveryChallanViewSet, basename="sales-challan")
router.register("credit-notes", CreditNoteViewSet, basename="sales-credit-note")

urlpatterns = [
    # G3a — a jeweller's custom orders.
    # G4 — a medical store's Schedule H register.
    path("reports/schedule-h", ScheduleHRegisterView.as_view(), name="schedule-h-register"),
    # G5 — a mobile shop's repair jobs.
    path("exchanges", ExchangeView.as_view(), name="exchanges"),
    path("repairs", RepairJobsView.as_view(), name="repairs"),
    path("repairs/<uuid:pk>", RepairJobDetailView.as_view(), name="repair-detail"),
    path("repairs/<uuid:pk>/stage", RepairJobStageView.as_view(), name="repair-stage"),
    path("custom-orders", CustomOrdersView.as_view(), name="custom-orders"),
    path("custom-orders/<uuid:pk>", CustomOrderDetailView.as_view(), name="custom-order-detail"),
    path("custom-orders/<uuid:pk>/status", CustomOrderStatusView.as_view(), name="custom-order-status"),
    # G3b — karigars.
    path("karigars", KarigarsView.as_view(), name="karigars"),
    path("karigars/<uuid:pk>/issue", KarigarIssueView.as_view(), name="karigar-issue"),
    path("karigar-lots/<uuid:pk>/receive", KarigarReceiveView.as_view(), name="karigar-receive"),
    path("karigar-lots/<uuid:pk>/tags", KarigarMakeTagView.as_view(), name="karigar-make-tag"),
    path("karigar-lots/<uuid:pk>/tags-done", KarigarTagsDoneView.as_view(), name="karigar-tags-done"),
    path("karigars/<uuid:pk>", KarigarDetailView.as_view(), name="karigar-detail"),
    path("karigar-lots/<uuid:pk>", KarigarLotView.as_view(), name="karigar-lot"),
    path("jewel-home", JewelHomeView.as_view(), name="jewel-home"),
    path("old-gold", OldGoldView.as_view(), name="old-gold"),
    path("custom-orders/<uuid:pk>/photo", CustomOrderPhotoView.as_view(), name="custom-order-photo"),
    *router.urls,
]
