"""What a hand-written view (`request.data.get(...)`, no serializer) may trust.

Lending, Library and the Money Book read their bodies directly. The QA audit of
12 Nov 2026 sent each of their routes junk and three kinds of it answered 500:
a body that is a list or a bare value (`.get` on a non-dict), a NUL character in
any text (PostgreSQL refuses it), and a number or a date too big to count with
(`?page=10**30`, `?month=9999-12-31`). All three are the caller's mistake, so
each is a 400 said once here, not once per view.
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Mapping
from typing import Any

from django.utils.translation import gettext_lazy as _
from rest_framework.permissions import SAFE_METHODS

from apps.common.exceptions import ValidationFailed

PAGE_NUMBER_MAX = 100_000
YEAR_MIN, YEAR_MAX = 1900, 2200


def _has_nul(value: Any) -> bool:
    if isinstance(value, str):
        return "\x00" in value
    if isinstance(value, Mapping):
        return any(_has_nul(k) or _has_nul(v) for k, v in value.items())
    if isinstance(value, (list, tuple)):
        return any(_has_nul(v) for v in value)
    return False


class PlainBodyMixin:
    """A write's body is one object of ordinary text; anything else is a 400."""

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)  # type: ignore[misc]
        if _has_nul(dict(request.query_params.lists())):
            raise ValidationFailed(details={"non_field_errors": [_("Remove the unusual characters and try again.")]})
        if request.method in SAFE_METHODS:
            return
        if not isinstance(request.data, Mapping):
            raise ValidationFailed(details={"non_field_errors": [_("Send the details as one form.")]})
        bad = [str(k) for k, v in request.data.items() if _has_nul(k) or _has_nul(v)]
        if bad:
            raise ValidationFailed(details={k: [_("Remove the unusual characters and try again.")] for k in bad})


def page_of(request: Any, *, size: int, size_max: int) -> tuple[int, int]:
    """`?page=&page_size=` as two safe numbers. A page past the end is an empty
    page; a page past counting is still a number the database can offset by."""
    try:
        page = min(PAGE_NUMBER_MAX, max(1, int(request.query_params.get("page", 1))))
        per = min(size_max, max(1, int(request.query_params.get("page_size", size))))
    except (TypeError, ValueError):
        raise ValidationFailed(details={"page": [_("Enter a page number.")]}) from None
    return page, per


def date_of(value: Any, field: str) -> dt.date | None:
    """An ISO date a calendar can do sums with (a month after it still exists)."""
    if not value:
        return None
    try:
        day = dt.date.fromisoformat(str(value))
    except ValueError:
        day = None
    if day is None or not YEAR_MIN <= day.year <= YEAR_MAX:
        raise ValidationFailed(details={field: [_("Choose a date.")]})
    return day


def switch_of(value: Any) -> bool:
    """A yes/no that may arrive as JSON or as form text (`bool("false")` is True)."""
    if isinstance(value, str):
        return value.strip().lower() not in ("", "0", "false", "no", "off")
    return bool(value)
