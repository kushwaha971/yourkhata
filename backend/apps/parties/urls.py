"""Party routes (canon §0.8)."""

from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.parties.views.party import PartyViewSet
from apps.parties.views.shop_promise import (
    OpenShopPromisesView,
    PartyShopPromisesView,
    ShopPromiseCancelView,
    ShopPromiseCloseView,
    ShopPromiseView,
)
from apps.parties.views.tag import TagViewSet

router = DefaultRouter(trailing_slash=False)
# `parties/tags` BEFORE `parties`, and the order is load-bearing: the router
# turns the party route into `parties/<pk>`, and DRF matches in registration
# order — so with `parties` first, a GET of `/parties/tags` would be read as a
# retrieve of a party whose id is the string "tags" and answer 404.
router.register("parties/tags", TagViewSet, basename="party-tag")
router.register("parties", PartyViewSet, basename="party")

# BP-16 — before the router for the same reason as `parties/tags`.
urlpatterns = [
    path("parties/shop-promises", OpenShopPromisesView.as_view(), name="shop-promises-open"),
    path(
        "parties/shop-promises/<uuid:promise_id>",
        ShopPromiseView.as_view(),
        name="shop-promise-detail",
    ),
    path(
        "parties/shop-promises/<uuid:promise_id>/kept",
        ShopPromiseCloseView.as_view(),
        name="shop-promise-kept",
    ),
    path(
        "parties/shop-promises/<uuid:promise_id>/cancel",
        ShopPromiseCancelView.as_view(),
        name="shop-promise-cancel",
    ),
    path(
        "parties/<uuid:party_id>/shop-promises",
        PartyShopPromisesView.as_view(),
        name="party-shop-promises",
    ),
    *router.urls,
]
