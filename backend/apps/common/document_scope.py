"""Read predicates for shared documents; another app's invoice is not a Shop sale."""

from django.db.models import Q


def shop_origin_q(prefix: str = "") -> Q:
    """Include legacy empty origins and ordinary Shop documents, including line queries."""
    return Q(**{f"{prefix}origin_module__isnull": True}) | Q(**{f"{prefix}origin_module": ""})
