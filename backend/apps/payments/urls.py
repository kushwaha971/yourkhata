"""URL routes for the payments app (canon §0.8).

The two fixed paths are declared BEFORE the router's: `upi-intent` would
otherwise be offered to the detail route as a payment id (the lookup is a
UUID pattern now, but the order is the guarantee).
"""

from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.payments.views.deposits import DepositViewSet
from apps.payments.views.pay_link import PayLinkView
from apps.payments.views.payment import PaymentViewSet, UpiIntentView
from apps.payments.views.qr import QrSvgView
from apps.payments.views.shop_settlement import (
    ShopSettlementCandidatesView,
    ShopSettlementShareView,
    ShopSettlementView,
)

router = DefaultRouter(trailing_slash=False)
router.register("payments", PaymentViewSet, basename="payment")
router.register("deposits", DepositViewSet, basename="deposit")  # ── A4b ──

urlpatterns: list = [
    path("payments/qr.svg", QrSvgView.as_view(), name="payments-qr-svg"),
    path("payments/upi-intent", UpiIntentView.as_view(), name="payments-upi-intent"),
    path("payments/pay-links", PayLinkView.as_view(), name="payments-pay-links"),
    # ── BP-08 ── explicit customer–supplier settlement (R-DEC-26).
    path(
        "payments/shop-settlements",
        ShopSettlementView.as_view(),
        name="payments-shop-settlements",
    ),
    path(
        "payments/shop-settlements/candidates",
        ShopSettlementCandidatesView.as_view(),
        name="payments-shop-settlement-candidates",
    ),
    path(
        "payments/shop-settlements/<uuid:pk>/share",
        ShopSettlementShareView.as_view(),
        name="payments-shop-settlement-share",
    ),
    *router.urls,
]
