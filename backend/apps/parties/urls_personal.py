"""Explicit personal API: no Shop, Lending, Library or business-admin routes."""

from django.urls import path
from rest_framework.exceptions import PermissionDenied
from rest_framework.routers import SimpleRouter

from apps.common.permissions import _authenticated_membership
from apps.common.tenancy import _current_tenant, get_effective_tenant
from apps.parties.services.personal_book import personal_tenant
from apps.parties.views.party import PartyViewSet
from apps.ledger.views.entry import LedgerEntryViewSet, PartyLedgerEntryViewSet
from apps.ledger.views.statement import PartyStatementView
from apps.ledger.views.reminder import (
    ReminderPreviewView,
    ReminderSendView,
    ReminderListCreateView,
    ReminderDueView,
    ReminderDetailView,
    ReminderSettingsView,
    ReminderBulkView,
)
from apps.ledger.views.aging import LedgerSummaryView, LedgerAgingView
from apps.parties.views.tag import TagViewSet


class PersonalScope:
    """Bind to the verified user's book before existing permissions/selectors run."""

    def initial(self, request, *args, **kwargs):
        self.perform_authentication(request)
        if not request.user.is_authenticated or not request.user.is_active:
            raise PermissionDenied("Sign in to open your book.")
        if (getattr(request, "auth_claims", {}) or {}).get("imp"):
            raise PermissionDenied("Personal books are private.")
        business = get_effective_tenant(request)
        if business is not None:
            _authenticated_membership(request)  # keep stale business-token checks
        self.business_id = str(business.pk) if business else None
        claims = getattr(request, "auth_claims", {}) or {}
        storage = personal_tenant(
            user=request.user, business=business, version=claims.get("ver", 1)
        )
        request._request._ub_tenant = storage
        _current_tenant.set(storage)
        super().initial(request, *args, **kwargs)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        # Echo the authenticated business session for the existing stale-tab guard;
        # the storage scope is private and cannot be selected using this header.
        if getattr(self, "business_id", None):
            response["X-Tenant-Id"] = self.business_id
        return response


class PersonalPeople(PersonalScope, PartyViewSet):
    def authorize_book(self, request, codename):
        if self.action in ("archive", "restore", "bulk_archive"):
            from apps.common.book_access import require_book

            require_book(request, "main", codename)
            return True
        return super().authorize_book(request, codename)


class PersonalEntries(PersonalScope, PartyLedgerEntryViewSet):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        from django.shortcuts import get_object_or_404
        from apps.parties.models import Party

        get_object_or_404(
            Party.objects.for_tenant(get_effective_tenant(request)), pk=kwargs["party_pk"]
        )


class PersonalEntry(PersonalScope, LedgerEntryViewSet):
    pass


class PersonalStatement(PersonalScope, PartyStatementView):
    pass


class PersonalReminderPreview(PersonalScope, ReminderPreviewView):
    pass


class PersonalReminderSend(PersonalScope, ReminderSendView):
    pass


router = SimpleRouter(trailing_slash=False)
router.register(
    "parties/tags", type("PersonalTags", (PersonalScope, TagViewSet), {}), basename="personal-tag"
)
router.register("parties", PersonalPeople, basename="personal-party")
router.register("ledger-entries", PersonalEntry, basename="personal-entry")
urlpatterns = [
    path(
        "ledger/summary", type("PersonalSummary", (PersonalScope, LedgerSummaryView), {}).as_view()
    ),
    path("ledger/aging", type("PersonalAging", (PersonalScope, LedgerAgingView), {}).as_view()),
    path(
        "parties/<uuid:party_pk>/ledger-entries",
        PersonalEntries.as_view({"get": "list", "post": "create"}),
    ),
    path("parties/<uuid:party_pk>/statement", PersonalStatement.as_view()),
    path("reminders/preview", PersonalReminderPreview.as_view()),
    path(
        "reminders",
        type("PersonalReminders", (PersonalScope, ReminderListCreateView), {}).as_view(),
    ),
    path("reminders/due", type("PersonalDue", (PersonalScope, ReminderDueView), {}).as_view()),
    path(
        "reminders/settings",
        type("PersonalSettings", (PersonalScope, ReminderSettingsView), {}).as_view(),
    ),
    path("reminders/bulk", type("PersonalBulk", (PersonalScope, ReminderBulkView), {}).as_view()),
    path(
        "reminders/<uuid:pk>",
        type("PersonalReminder", (PersonalScope, ReminderDetailView), {}).as_view(),
    ),
    path("reminders/<uuid:pk>/send", PersonalReminderSend.as_view()),
    *router.urls,
]
