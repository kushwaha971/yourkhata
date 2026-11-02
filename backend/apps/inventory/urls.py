"""Inventory routes (canon §0.8, Part 22 §22.6)."""

from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.inventory.views.items import (
    CategoryViewSet,
    ItemViewSet,
    LowStockView,
    StockAdjustmentViewSet,
    ExpiryView,
    HomeStripView,
    SerialView,
    StockSummaryView,
    UnitViewSet,
)
from apps.inventory.views.metal_rates import RateHistoryView, TodayRateView
from apps.inventory.views.price_lists import PriceListViewSet
from apps.inventory.views.tags import ItemTagsView, TagLookupView, TagSummaryView
from apps.inventory.views.stock_counts import StockCountViewSet
from apps.inventory.views.transfers import LocationViewSet, StockTransferViewSet

router = DefaultRouter(trailing_slash=False)
router.register("items", ItemViewSet, basename="item")
router.register("categories", CategoryViewSet, basename="category")
router.register("units", UnitViewSet, basename="unit")
router.register("price-lists", PriceListViewSet, basename="price-list")
router.register("stock-adjustments", StockAdjustmentViewSet, basename="stock-adjustment")
router.register("stock-counts", StockCountViewSet, basename="stock-count")
router.register("locations", LocationViewSet, basename="location")
router.register("stock-transfers", StockTransferViewSet, basename="stock-transfer")

urlpatterns = [
    path("stock/summary", StockSummaryView.as_view(), name="stock-summary"),
    path("stock/low", LowStockView.as_view(), name="stock-low"),
    path("serials/<str:code>", SerialView.as_view(), name="serial-detail"),
    path("stock/expiry", ExpiryView.as_view(), name="stock-expiry"),
    # G2a — a jeweller's tags (before the router, whose items/<pk>/ owns the rest).
    path("items/<uuid:pk>/tags", ItemTagsView.as_view(), name="item-tags"),
    path("jewel-tags/summary", TagSummaryView.as_view(), name="jewel-tag-summary"),
    path("jewel-tags/lookup", TagLookupView.as_view(), name="jewel-tag-lookup"),
    path("metal-rates/today", TodayRateView.as_view(), name="metal-rate-today"),
    path("metal-rates", RateHistoryView.as_view(), name="metal-rate-history"),
    path("stock/home-strip", HomeStripView.as_view(), name="stock-home-strip"),
    *router.urls,
]
