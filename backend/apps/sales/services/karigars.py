"""G3b — karigars: gold weighed out and weighed back, wastage against each
karigar's limit (design G3 `dJOrders`). See `models.Karigar`, `models.KarigarLot`."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.common.audit import AuditAction, write_audit
from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed
from apps.sales.models import CustomOrder, Karigar, KarigarLot

ZERO = Decimal("0")


def _g(value: Decimal) -> str:
    return f"{value:.3f}"


def lot_view(lot: KarigarLot) -> dict:
    return {
        "id": str(lot.id),
        "karigar": {"id": str(lot.karigar_id), "name": lot.karigar.name},
        "order_number": lot.order.number if lot.order_id else None,
        "purity": lot.purity,
        "issued_g": _g(lot.issued_g),
        "issued_on": lot.issued_on.isoformat(),
        "received_g": _g(lot.received_g) if lot.received_g is not None else None,
        "tagged_g": _g(lot.tagged_g),
        "tag_count": lot.tag_count,
        "last_item_id": str(lot.last_item_id) if lot.last_item_id else None,
    }


def karigar_view(karigar: Karigar, lots: list[KarigarLot]) -> dict:
    issued = sum((x.issued_g for x in lots), ZERO)
    back = [x for x in lots if x.received_g is not None]
    received = sum((x.received_g for x in back), ZERO)
    out = sum((x.issued_g for x in back), ZERO)
    wastage = ((out - received) * 100 / out).quantize(Decimal("0.1")) if out else None
    return {
        "id": str(karigar.id),
        "name": karigar.name,
        "mobile": karigar.mobile,
        "wastage_limit_pct": f"{karigar.wastage_limit_pct:.2f}",
        "issued_g": _g(issued),
        "received_g": _g(received),
        "with_g": _g(issued - out),
        "wastage_pct": f"{wastage:.1f}" if wastage is not None else None,
        "over_limit": wastage is not None and wastage > karigar.wastage_limit_pct,
    }


def list_karigars(*, tenant: Any) -> dict:
    lots = list(KarigarLot.objects.filter(tenant=tenant).select_related("karigar", "order"))
    rows = [
        karigar_view(k, [x for x in lots if x.karigar_id == k.id])
        for k in Karigar.objects.filter(tenant=tenant).order_by("name")
    ]
    return {
        "rows": rows,
        "open_lots": [lot_view(x) for x in lots if x.received_g is None],
        "to_tag": [lot_view(x) for x in lots if x.received_g is not None and not x.tags_done],
        "gold_with_karigars": _g(sum((x.issued_g for x in lots if x.received_g is None), ZERO)),
    }


def create_karigar(*, ctx: Ctx, data: dict) -> dict:
    from apps.inventory.services.tags import _dec

    errors: dict[str, list[str]] = {}
    name = " ".join(str(data.get("name") or "").split())
    if not name:
        errors["name"] = ["Enter the karigar's name."]
    elif len(name) > 120:
        errors["name"] = ["Keep the name under 120 characters."]
    elif Karigar.objects.filter(tenant=ctx.tenant, name__iexact=name).exists():
        errors["name"] = ["You already have a karigar with this name."]
    limit = _dec(data.get("wastage_limit_pct"), "wastage_limit_pct", errors, required=False, places=2, minimum=ZERO) or ZERO
    if limit > 100 and "wastage_limit_pct" not in errors:
        errors["wastage_limit_pct"] = ["The limit is a percentage up to 100."]
    if errors:
        raise ValidationFailed(errors, "Check the karigar.")
    row = Karigar.objects.create(
        tenant=ctx.tenant, name=name, mobile=str(data.get("mobile") or "").strip()[:15], wastage_limit_pct=limit
    )
    return karigar_view(row, [])


@transaction.atomic
def issue_gold(*, ctx: Ctx, karigar_id: Any, data: dict) -> tuple[KarigarLot, bool]:
    from apps.inventory.services.metal_rates import PURITIES
    from apps.inventory.services.tags import _dec

    karigar = Karigar.objects.select_for_update().filter(tenant=ctx.tenant, pk=karigar_id).first()
    if karigar is None:
        raise NotFound("No such karigar.")
    errors: dict[str, list[str]] = {}
    weight = _dec(data.get("weight_g"), "weight_g", errors, required=True, places=3, minimum=Decimal("0.001"))
    purity = data.get("purity")
    if purity not in PURITIES:
        errors["purity"] = ["Choose the purity."]
    order = None
    if data.get("order_id"):
        try:
            order = CustomOrder.objects.filter(tenant=ctx.tenant, pk=data["order_id"]).first()
        except (ValueError, TypeError, ValidationError):
            order = None
        if order is None:
            errors["order_id"] = ["Choose an order from the list."]
    if errors:
        raise ValidationFailed(errors, "Check the gold issued.")
    try:
        client_key = uuid.UUID(str(data.get("client_key")))
    except ValueError:
        client_key = uuid.uuid4()
    same = KarigarLot.objects.filter(tenant=ctx.tenant, client_key=client_key).select_related("karigar", "order").first()
    if same is not None:
        return same, False
    lot = KarigarLot.objects.create(
        tenant=ctx.tenant,
        karigar=karigar,
        order=order,
        client_key=client_key,
        purity=purity,
        issued_g=weight,
        issued_on=tenant_today(ctx.tenant),
    )
    return lot, True


@transaction.atomic
def receive_gold(*, ctx: Ctx, lot_id: Any, data: dict) -> KarigarLot:
    from apps.inventory.services.tags import _dec

    lot = (
        KarigarLot.objects.select_for_update(of=("self",))
        .select_related("karigar", "order")
        .filter(tenant=ctx.tenant, pk=lot_id)
        .first()
    )
    if lot is None:
        raise NotFound("No such lot.")
    if lot.received_g is not None:
        raise BusinessRuleViolation("karigar_lot_received", "This gold is already received back.", details={})
    errors: dict[str, list[str]] = {}
    received = _dec(data.get("received_g"), "received_g", errors, required=True, places=3, minimum=ZERO)
    if received is not None and "received_g" not in errors and received > lot.issued_g:
        errors["received_g"] = [f"More than the {lot.issued_g:.3f} g given. Check the weight."]
    if errors:
        raise ValidationFailed(errors, "Check the weight.")
    if data.get("more_to_come") and received < lot.issued_g:
        # Part back: this lot closes at what came, the rest stays out as its own
        # lot, so no wastage is counted until the last of it is back.
        KarigarLot.objects.create(
            tenant=ctx.tenant,
            karigar=lot.karigar,
            order=lot.order,
            client_key=uuid.uuid4(),
            purity=lot.purity,
            issued_g=lot.issued_g - received,
            issued_on=lot.issued_on,
        )
        lot.issued_g = received
    lot.received_g = received
    lot.received_on = tenant_today(ctx.tenant)
    lot.save(update_fields=["issued_g", "received_g", "received_on"])
    return lot


@transaction.atomic
def make_tag(*, ctx: Ctx, lot_id: Any, data: dict) -> dict:
    """G3c (design D6): one piece from gold received back: its tag goes into
    stock, costed at the metal plus the labour. A net weight beyond what came
    back is the counter's call (the piece may use other gold), so it is allowed."""
    from apps.inventory.models import Item
    from apps.inventory.services.tags import _dec, add_tag

    lot = _received_lot(ctx=ctx, lot_id=lot_id)
    errors: dict[str, list[str]] = {}
    try:
        item = Item.objects.filter(tenant=ctx.tenant, pk=data.get("item_id")).first()
    except (ValueError, TypeError, ValidationError):
        item = None
    if item is None:
        errors["item_id"] = ["Choose the item."]
    labour = _dec(data.get("labour_per_g"), "labour_per_g", errors, required=False, places=2, minimum=ZERO) or ZERO
    if errors:
        raise ValidationFailed(errors, "Check the tag details.")
    tag = add_tag(ctx=ctx, item=item, data=data.get("tag") or {}, labour_per_g=labour)
    lot.tagged_g += Decimal(tag["net_g"])
    lot.tag_count += 1
    lot.last_item_id = item.id
    lot.save(update_fields=["tagged_g", "tag_count", "last_item_id"])
    return {"tag": tag, "lot": lot_view(lot)}


@transaction.atomic
def finish_tagging(*, ctx: Ctx, lot_id: Any) -> dict:
    lot = _received_lot(ctx=ctx, lot_id=lot_id)
    lot.tags_done = True
    lot.save(update_fields=["tags_done"])
    return lot_view(lot)


def _received_lot(*, ctx: Ctx, lot_id: Any) -> KarigarLot:
    lot = (
        KarigarLot.objects.select_for_update(of=("self",))
        .select_related("karigar", "order")
        .filter(tenant=ctx.tenant, pk=lot_id)
        .first()
    )
    if lot is None:
        raise NotFound("No such lot.")
    if lot.received_g is None:
        raise BusinessRuleViolation("karigar_lot_not_back", "Receive this gold back first.", details={})
    return lot


def _lot_figures(lot: KarigarLot) -> dict:
    return {
        "purity": lot.purity,
        "issued_g": _g(lot.issued_g),
        "received_g": _g(lot.received_g) if lot.received_g is not None else None,
    }


def _locked_lot(*, ctx: Ctx, lot_id: Any) -> KarigarLot:
    lot = (
        KarigarLot.objects.select_for_update(of=("self",))
        .select_related("karigar", "order")
        .filter(tenant=ctx.tenant, pk=lot_id)
        .first()
    )
    if lot is None:
        raise NotFound("No such lot.")
    return lot


@transaction.atomic
def correct_lot(*, ctx: Ctx, lot_id: Any, data: dict) -> dict:
    """A mistyped weight or purity. Wastage follows from the new figures; tags
    already made keep their own weights; the audit row keeps the old figures."""
    from apps.inventory.services.metal_rates import PURITIES
    from apps.inventory.services.tags import _dec

    lot = _locked_lot(ctx=ctx, lot_id=lot_id)
    before = _lot_figures(lot)
    errors: dict[str, list[str]] = {}
    issued = lot.issued_g
    if "issued_g" in data:
        issued = _dec(data.get("issued_g"), "issued_g", errors, required=True, places=3, minimum=Decimal("0.001")) or issued
    received = lot.received_g
    if "received_g" in data:
        if lot.received_g is None:
            errors["received_g"] = ["This gold is not back yet."]
        else:
            got = _dec(data.get("received_g"), "received_g", errors, required=True, places=3, minimum=ZERO)
            received = got if got is not None else received
    purity = data.get("purity", lot.purity)
    if purity not in PURITIES:
        errors["purity"] = ["Choose the purity."]
    if received is not None and "received_g" not in errors and "issued_g" not in errors and received > issued:
        errors["received_g"] = [f"More than the {issued:.3f} g given. Check the weight."]
    if errors:
        raise ValidationFailed(errors, "Check the weight.")
    lot.issued_g, lot.received_g, lot.purity = issued, received, purity
    lot.save(update_fields=["issued_g", "received_g", "purity"])
    write_audit(
        ctx=ctx,
        action=AuditAction.KARIGAR_LOT_CORRECTED,
        entity_type="karigar_lot",
        entity_id=lot.id,
        before=before,
        after=_lot_figures(lot),
    )
    return lot_view(lot)


@transaction.atomic
def remove_lot(*, ctx: Ctx, lot_id: Any) -> None:
    """A lot entered by mistake. Once pieces are tagged from it, it stays."""
    lot = _locked_lot(ctx=ctx, lot_id=lot_id)
    if lot.tag_count:
        raise BusinessRuleViolation(
            "karigar_lot_has_tags", "Tags were made from this gold, so it cannot be removed.", details={}
        )
    write_audit(
        ctx=ctx,
        action=AuditAction.KARIGAR_LOT_REMOVED,
        entity_type="karigar_lot",
        entity_id=lot.id,
        before={**_lot_figures(lot), "karigar": lot.karigar.name},
    )
    lot.delete()


@transaction.atomic
def update_karigar(*, ctx: Ctx, karigar_id: Any, data: dict) -> dict:
    from apps.inventory.services.tags import _dec

    karigar = Karigar.objects.select_for_update().filter(tenant=ctx.tenant, pk=karigar_id).first()
    if karigar is None:
        raise NotFound("No such karigar.")
    before = {"name": karigar.name, "wastage_limit_pct": f"{karigar.wastage_limit_pct:.2f}"}
    errors: dict[str, list[str]] = {}
    name = " ".join(str(data.get("name", karigar.name) or "").split())
    if not name:
        errors["name"] = ["Enter the karigar's name."]
    elif len(name) > 120:
        errors["name"] = ["Keep the name under 120 characters."]
    elif Karigar.objects.filter(tenant=ctx.tenant, name__iexact=name).exclude(pk=karigar.pk).exists():
        errors["name"] = ["You already have a karigar with this name."]
    limit = _dec(data.get("wastage_limit_pct"), "wastage_limit_pct", errors, required=False, places=2, minimum=ZERO) or ZERO
    if limit > 100 and "wastage_limit_pct" not in errors:
        errors["wastage_limit_pct"] = ["The limit is a percentage up to 100."]
    if errors:
        raise ValidationFailed(errors, "Check the karigar.")
    karigar.name, karigar.wastage_limit_pct = name, limit
    karigar.save(update_fields=["name", "wastage_limit_pct"])
    write_audit(
        ctx=ctx,
        action=AuditAction.KARIGAR_UPDATED,
        entity_type="karigar",
        entity_id=karigar.id,
        before=before,
        after={"name": name, "wastage_limit_pct": f"{limit:.2f}"},
    )
    return karigar_view(karigar, list(karigar.lots.all()))
