"""G9 — company schemes on a distributor's bill (design `dSchemes`, `pScheme`).

A running scheme applies on the bill by itself. `apply` is pure and has a twin,
`view-model/schemes.ts`, that the bill screen runs for its preview; both are
held to `schemeCases.json`. The server always re-applies on save, so a bill can
never carry a scheme line the client invented, and a line the merchant
discounted by hand keeps the merchant's discount.
"""

from __future__ import annotations

import uuid
from decimal import ROUND_DOWN, Decimal, InvalidOperation
from typing import Any

from django.db.models import Q, Sum

from apps.common.dates import tenant_today
from apps.common.exceptions import NotFound, ValidationFailed

CENT = Decimal("0.01")


def _d(raw: Any) -> Decimal:
    try:
        return Decimal(str(raw if raw not in (None, "") else "0"))
    except InvalidOperation:
        return Decimal("0")


def apply(lines: list[dict], schemes: list[dict]) -> tuple[list[dict | None], list[dict]]:
    """`(discounts, free)`: per line `{type, value, scheme}` or None, and the free lines."""
    discounts: list[dict | None] = [None] * len(lines)
    free: list[dict] = []
    ordered = sorted(schemes, key=lambda s: s["code"])
    for scheme in ordered:
        item = scheme.get("item_id")
        mine = [i for i, line in enumerate(lines) if item is None or str(line.get("item_id")) == str(item)]
        rule = scheme["rule"]
        if rule == "free":
            buy, give = _d(scheme.get("buy_qty")), _d(scheme.get("free_qty"))
            if not item or buy <= 0 or give <= 0 or not mine:
                continue
            total = sum((_d(lines[i].get("qty")) for i in mine), Decimal("0"))
            qty = (total / buy).to_integral_value(rounding=ROUND_DOWN) * give
            if qty > 0:
                free.append(
                    {"item_id": str(item), "qty": _q(qty), "unit_code": lines[mine[0]].get("unit_code"), "scheme": scheme["code"]}
                )
            continue
        open_lines = [i for i in mine if discounts[i] is None and not lines[i].get("discount_type")]
        if rule == "per_unit":
            off = _d(scheme.get("amount"))
            for i in open_lines:
                qty, price = _d(lines[i].get("qty")), _d(lines[i].get("unit_price"))
                value = min(off * qty, qty * price).quantize(CENT)
                if value > 0:
                    discounts[i] = {"type": "amount", "value": str(value), "scheme": scheme["code"]}
        elif rule == "percent":
            pct = _d(scheme.get("amount"))
            base = sum((_d(lines[i].get("qty")) * _d(lines[i].get("unit_price")) for i in open_lines), Decimal("0"))
            if pct > 0 and open_lines and base >= _d(scheme.get("min_bill")):
                for i in open_lines:
                    discounts[i] = {"type": "percent", "value": str(pct.quantize(CENT)), "scheme": scheme["code"]}
    return discounts, free


def _q(value: Decimal) -> str:
    text = format(value.normalize(), "f")
    return text


# ── the bill hook ────────────────────────────────────────────────────────────


def running(tenant: Any, on: Any) -> list[dict]:
    from apps.sales.models import Scheme

    rows = Scheme.objects.filter(tenant=tenant, active=True, valid_from__lte=on, valid_till__gte=on)
    return [
        {
            "code": s.code,
            "rule": s.rule,
            "item_id": str(s.item_id) if s.item_id else None,
            "buy_qty": s.buy_qty,
            "free_qty": s.free_qty,
            "amount": s.amount,
            "min_bill": s.min_bill,
        }
        for s in rows
    ]


def expand_lines(*, tenant: Any, on: Any, raw_lines: list[dict]) -> list[dict]:
    """The bill's own lines with scheme discounts set, then the free lines.
    Lines a scheme made earlier are dropped first and made again."""
    from apps.inventory.models import Item

    own = [dict(line) for line in raw_lines if not line.get("scheme_free")]
    for line in own:
        # A scheme's discount is worked out again; the merchant's own stays.
        if line.pop("scheme_code", None):
            line["discount_type"] = None
            line["discount_value"] = None
    schemes = running(tenant, on)
    if not schemes:
        return own
    # A line without a price takes the item's, as `build_lines` will.
    missing = {str(l["item_id"]) for l in own if l.get("item_id") and l.get("unit_price") in (None, "")}
    listed = (
        {str(pk): p for pk, p in Item.objects.filter(tenant=tenant, pk__in=missing).values_list("id", "selling_price")}
        if missing
        else {}
    )
    priced = [
        {**l, "unit_price": listed.get(str(l.get("item_id")), "0")} if l.get("unit_price") in (None, "") else l
        for l in own
    ]
    discounts, free = apply(priced, schemes)
    for line, discount in zip(own, discounts):
        if discount:
            line.update(discount_type=discount["type"], discount_value=discount["value"], scheme_code=discount["scheme"])
    names = dict(Item.objects.filter(tenant=tenant, pk__in=[f["item_id"] for f in free]).values_list("id", "name"))
    for row in free:
        name = names.get(uuid.UUID(row["item_id"]), "")
        own.append(
            {
                "item_id": row["item_id"],
                "qty": row["qty"],
                "unit_code": row["unit_code"],
                "unit_price": "0",
                "description": f"{name} · free",
                "scheme_code": row["scheme"],
                "scheme_free": True,
            }
        )
    return own


def list_prices(tenant: Any, raws: list[dict]) -> dict[str, Decimal]:
    from apps.inventory.models import Item

    ids = {str(r["item_id"]) for r in raws if r.get("scheme_free") and r.get("item_id")}
    if not ids:
        return {}
    return {str(pk): Decimal(price) for pk, price in Item.objects.filter(tenant=tenant, pk__in=ids).values_list("id", "selling_price")}


def claim_for(raw: dict, line: Any, prices: dict) -> Decimal:
    """What the company owes back: a free line's worth at the item's price, or the discount given."""
    if not raw.get("scheme_code"):
        return Decimal("0.00")
    if raw.get("scheme_free"):
        return (_d(raw.get("qty")) * prices.get(str(raw.get("item_id")), Decimal("0"))).quantize(CENT)
    return Decimal(line.discount_amount).quantize(CENT)


# ── the schemes screen ───────────────────────────────────────────────────────

_RULES = ("free", "per_unit", "percent")


def create_scheme(*, ctx: Any, data: dict) -> tuple[Any, bool]:
    from apps.inventory.models import Item
    from apps.sales.models import Scheme

    key = data.get("client_key")
    try:
        key = uuid.UUID(str(key))
    except (TypeError, ValueError):
        raise ValidationFailed({"client_key": ["Missing key."]}) from None
    found = Scheme.objects.filter(tenant=ctx.tenant, client_key=key).first()
    if found:
        return found, False
    errors: dict[str, list[str]] = {}
    code = "".join(str(data.get("code") or "").split()).upper()[:24]
    company = " ".join(str(data.get("company") or "").split())[:120]
    rule = data.get("rule")
    if not code:
        errors["code"] = ["Enter a name for the scheme."]
    elif Scheme.objects.filter(tenant=ctx.tenant, code__iexact=code).exists():
        errors["code"] = ["A scheme has this name already."]
    if not company:
        errors["company"] = ["Enter the company."]
    if rule not in _RULES:
        errors["rule"] = ["Choose what the scheme gives."]
    item = None
    if data.get("item_id"):
        item = Item.objects.filter(tenant=ctx.tenant, pk=data["item_id"]).first()
        if item is None:
            errors["item_id"] = ["Choose an item."]
    elif rule in ("free", "per_unit"):
        errors["item_id"] = ["Choose the item."]
    fields: dict[str, Any] = {}
    for name in ("buy_qty", "free_qty", "amount", "min_bill"):
        raw = data.get(name)
        if raw in (None, ""):
            fields[name] = None
            continue
        value = _d(raw)
        if value < 0 or str(raw).strip() in ("", "-"):
            errors[name] = ["Enter a number."]
        fields[name] = value
    need = {"free": ("buy_qty", "free_qty"), "per_unit": ("amount",), "percent": ("amount", "min_bill")}.get(rule, ())
    for name in need:
        value = fields.get(name)
        if name not in errors and (value is None or (value <= 0 and name != "min_bill")):
            errors[name] = ["Enter more than 0."]
    if rule == "percent" and fields.get("amount") and fields["amount"] > 100:
        errors["amount"] = ["Enter up to 100 %."]
    from apps.sales.services.payload import _parse_date

    start = _parse_date(data.get("valid_from") or tenant_today(ctx.tenant).isoformat(), "valid_from", errors)
    end = _parse_date(data.get("valid_till"), "valid_till", errors) if data.get("valid_till") else None
    if end is None and "valid_till" not in errors:
        errors["valid_till"] = ["Choose the last day."]
    if start and end and end < start:
        errors["valid_till"] = ["The last day is before the first."]
    if errors:
        raise ValidationFailed(errors)
    scheme = Scheme.objects.create(
        tenant=ctx.tenant, client_key=key, code=code, company=company, rule=rule, item=item,
        valid_from=start, valid_till=end, **fields,
    )
    return scheme, True


def set_active(*, ctx: Any, scheme_id: Any, active: bool) -> Any:
    from apps.sales.models import Scheme

    scheme = Scheme.objects.filter(tenant=ctx.tenant, pk=scheme_id).first()
    if scheme is None:
        raise NotFound("Scheme not found.")
    scheme.active = bool(active)
    scheme.save(update_fields=["active", "updated_at"])
    return scheme


def _given(tenant: Any) -> dict[str, dict]:
    from apps.sales.constants import INVOICE_KINDS, DocumentStatus
    from apps.sales.models import SalesDocumentLine

    rows = (
        SalesDocumentLine.objects.filter(document__tenant=tenant, document__kind__in=INVOICE_KINDS, scheme_code__isnull=False)
        .exclude(document__status__in=[DocumentStatus.DRAFT, DocumentStatus.VOID])
        .values("scheme_code")
        .annotate(
            free_qty=Sum("qty", filter=Q(unit_price=0)),
            off=Sum("discount_amount", filter=Q(unit_price__gt=0)),
            claim=Sum("scheme_claim"),
        )
    )
    return {row["scheme_code"].upper(): row for row in rows}


def view(scheme: Any, given: dict, today: Any) -> dict:
    row = given.get(scheme.code.upper(), {})
    status = "stopped" if not scheme.active else "ended" if scheme.valid_till < today else "waiting" if scheme.valid_from > today else "running"
    return {
        "id": str(scheme.id),
        "code": scheme.code,
        "company": scheme.company,
        "rule": scheme.rule,
        "item_id": str(scheme.item_id) if scheme.item_id else None,
        "item": {"id": str(scheme.item_id), "name": scheme.item.name, "unit": scheme.item.unit.code} if scheme.item_id else None,
        "buy_qty": _s(scheme.buy_qty),
        "free_qty": _s(scheme.free_qty),
        "amount": _s(scheme.amount),
        "min_bill": _s(scheme.min_bill),
        "valid_from": scheme.valid_from.isoformat(),
        "valid_till": scheme.valid_till.isoformat(),
        "active": scheme.active,
        "status": status,
        "free_given": _s(row.get("free_qty") or Decimal("0")),
        "off_given": str((row.get("off") or Decimal("0")).quantize(CENT)),
        "claim": str((row.get("claim") or Decimal("0")).quantize(CENT)),
    }


def _s(value: Any) -> str | None:
    return None if value is None else format(Decimal(value).normalize(), "f")


def list_schemes(*, tenant: Any, q: str = "") -> dict:
    from apps.sales.models import Scheme

    rows = Scheme.objects.filter(tenant=tenant).select_related("item__unit")
    text = q.strip()
    if text:
        rows = rows.filter(Q(code__icontains=text) | Q(company__icontains=text))
    given, today = _given(tenant), tenant_today(tenant)
    schemes = [view(s, given, today) for s in rows]
    companies: dict[str, Decimal] = {}
    for s in schemes:
        companies[s["company"]] = companies.get(s["company"], Decimal("0")) + Decimal(s["claim"])
    return {
        "schemes": schemes,
        "claims": [{"company": name, "claim": str(total)} for name, total in sorted(companies.items(), key=lambda kv: -kv[1]) if total > 0],
    }


def running_for_bill(*, tenant: Any, on: Any) -> list[dict]:
    """The bill screen's copy of the running schemes, for its preview."""
    from apps.sales.models import Scheme

    rows = Scheme.objects.filter(tenant=tenant, active=True, valid_from__lte=on, valid_till__gte=on).select_related("item__unit")
    today = tenant_today(tenant)
    return [view(s, {}, today) for s in rows]
