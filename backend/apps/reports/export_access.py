"""Recheck a stored file against its source's current read and column policy.

R-DEC-18 review: queue-time merged export rights are not authorization for the
contents at download time. Reuse source permissions and column definitions;
never retain an old policy merely because the file predates new metadata.
"""

from __future__ import annotations

import copy
from typing import Any

from django.http import QueryDict
from django.urls import resolve
from rest_framework.exceptions import APIException
from rest_framework.request import Request

from apps.common.book_access import allowed_books
from apps.common.exceptions import NotFound
from apps.common.exports import export_list_view, request_has


def _report_view(reader: Any, slug: str, params: dict) -> Any:
    """Resolve the registered report's real view, without executing its query."""
    match = resolve(f"/api/v1/reports/{slug}")
    raw = copy.copy(reader._request)
    raw.method = "GET"
    query = QueryDict(mutable=True)
    for key, value in params.items():
        if value is not None:
            query[key] = value
    raw.GET = query
    request = Request(raw, authenticators=[])
    request.user = reader.user
    request.auth_claims = getattr(reader, "auth_claims", {})
    view = match.func.cls()
    view.request = request
    view.args, view.kwargs = (), match.kwargs
    return view


def authorize_stored_export(reader: Any, export: Any) -> None:
    """Refuse the entire immutable file if its rows/columns are no longer allowed.

    Rebuilding a redacted file under an existing id would change a document the
    merchant already requested. They can generate a new one with current rights.
    """
    params = export.params or {}
    try:
        if params.get("report"):
            from apps.reports.exporting import exporter_for

            exporter = exporter_for(params["report"])
            query = params.get("query") or {}
            view = _report_view(reader, exporter.slug, query)
            view.check_permissions(view.request)
            current = {
                **query,
                "cost_visible": bool(query.get("cost_visible"))
                and request_has(reader, "reports.financial.read"),
                "balances": bool(query.get("balances"))
                and request_has(reader, "reports.financial.read"),
            }
            before = {column.header for column in exporter.columns(query)}
            after = {column.header for column in exporter.columns(current)}
            if not before <= after:
                raise NotFound()
            if exporter.slug == "day-book":
                # Use the row source's own permission registry, never a copy.
                from apps.reports.selectors.day_book import SOURCE_PERMISSIONS

                for source in query.get("sources") or ():
                    code = SOURCE_PERMISSIONS.get(source)
                    if code is None or "shop" not in allowed_books(reader, code):
                        raise NotFound()
                if query.get("created_by") and not request_has(reader, "platform.audit.read"):
                    raise NotFound()
        else:
            view = export_list_view(export, reader)
            view.check_permissions(view.request)
            # BookAccessMixin applies the source's requested book, not every
            # unrelated grant the requester happened to have when they queued it.
            view.authorize_export_scope(view.request)
            wanted = set(params.get("columns") or ())
            permitted = {column.header for column in view.allowed_export_columns(view.request)}
            if not wanted or not wanted <= permitted:
                raise NotFound()
    except (APIException, ImportError, AttributeError, ValueError) as exc:
        raise NotFound("No such export. Generate a new file with your current access.") from exc
