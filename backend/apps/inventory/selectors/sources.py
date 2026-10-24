"""§8.2 — which document each stock movement came from, named and linkable.

An item's movement list reads "Sold on INV/26-27/0418", "Bought on PB/26-27/0012"
and opens that document. Inventory cannot look those numbers up itself: the
import matrix puts `sales` and `purchases` ABOVE `inventory`. So each document
app registers a resolver for its `source_type` in `AppConfig.ready()` — the same
port the khata uses (`apps.ledger.selectors.sources`), and the same resolver
functions — and this module calls whatever is registered, one query per source
type per page.

A resolver takes a set of ids and returns `{id: {"number", "status", "kind"}}`
for the ones it found. An id it cannot find is absent, and the row falls back
to its movement type rather than inventing a number. Money never travels here.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Iterable
from typing import Any

Resolver = Callable[[set[str]], dict[str, dict]]

_RESOLVERS: dict[str, Resolver] = {}


def register_movement_source_resolver(source_type: str, resolver: Resolver) -> None:
    """Called once per app at start-up; the last registration for a type wins."""
    _RESOLVERS[source_type] = resolver


def resolve_documents(rows: Iterable[Any]) -> dict[str, dict]:
    """`{source_id: summary}` for every document-sourced movement in `rows`."""
    wanted: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        if row.source_id is not None and row.source_type in _RESOLVERS:
            wanted[row.source_type].add(str(row.source_id))
    found: dict[str, dict] = {}
    for source_type, ids in wanted.items():
        for source_id, summary in _RESOLVERS[source_type](ids).items():
            found[source_id] = summary
    return found
