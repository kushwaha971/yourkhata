"""Owner, 14 Nov 2026 — hide one PART of an app from one team member.

A part is a named set of permissions inside one app. Hiding it writes those
codenames into the member's `permissions_override["deny"]`, which
`permissions_for` subtracts after everything else, so the server refuses the
part however a request is made, the menu (gated by the same codenames) drops
it, and nothing else about the member, the app, the business or its data
changes. Showing it again removes exactly those codenames: a deny the parts
never wrote (canon §0.9's per-member stock adjust) is left alone.

Reports is not a part on purpose: the Business home (Dashboard) is gated by
`reports.basic.read` too, so hiding Reports would take the member's home screen
away with it.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.common.audit import AuditAction, write_audit
from apps.common.context import Ctx
from apps.common.exceptions import NotFound, ValidationFailed

#: app code -> ((part code, codename prefixes), ...), in the order the screen shows them.
PARTS: dict[str, tuple[tuple[str, tuple[str, ...]], ...]] = {
    "library": (
        ("library_students", ("library.member.write",)),
        ("library_fees", ("library.fee.create",)),
    ),
    "lending": (
        ("lending_lend", ("lending.loan.create",)),
        ("lending_collect", ("lending.collection.create",)),
    ),
    "shop": (
        ("sales", ("sales.",)),
        ("purchases", ("purchases.",)),
        ("stock", ("inventory.stock.",)),
        ("payments", ("payments.",)),
        ("expenses", ("expenses.",)),
    ),
}


def _codenames(prefixes: tuple[str, ...]) -> frozenset[str]:
    from apps.common.permissions_registry import PERMISSIONS

    return frozenset(
        p for p in PERMISSIONS if any(p == x or (x.endswith(".") and p.startswith(x)) for x in prefixes)
    )


def _part_codenames() -> dict[str, frozenset[str]]:
    return {code: _codenames(prefixes) for parts in PARTS.values() for code, prefixes in parts}


def _all_part_codenames() -> frozenset[str]:
    return frozenset().union(*_part_codenames().values())


def parts_json(membership: Any) -> list[dict]:
    """Each part of each app the business runs that the member's role for that
    app could use, and whether it is hidden. A part the role never held (an
    accountant taking fees) is not listed: a switch for it would be a lie."""
    from apps.common.permissions_registry import _role_codenames
    from apps.platform_app import apps_registry

    if apps_registry.is_business_owner(membership):
        return []
    grants = apps_registry.grants_of(membership)
    override = membership.permissions_override or {}
    denied = set(override.get("deny", []))
    allowed = set(override.get("allow", []))
    by_code = _part_codenames()
    rows: list[dict] = []
    for app in apps_registry.apps_of_business(membership.tenant):
        role = grants.get(app.code) or membership.role
        held = _role_codenames(role) | allowed
        for code, _ in PARTS.get(app.code, ()):
            mine = by_code[code] & held
            if mine:
                rows.append({"app": app.code, "part": code, "hidden": mine <= denied})
    return rows


@transaction.atomic
def set_hidden_parts(*, tenant: Any, membership_id: Any, hidden: Any, ctx: Ctx) -> Any:
    """`PUT /members/{id}/apps {hidden: [part, ...]}` — replaces the hidden set."""
    from apps.platform_app.models import Membership

    target = (
        Membership.objects.select_related("role", "tenant")
        .select_for_update(of=("self",))
        .filter(tenant=tenant, pk=membership_id)
        .first()
    )
    if target is None:
        raise NotFound()
    if target.role.code == "owner":
        raise ValidationFailed({"hidden": ["The owner sees every part of the business."]})
    by_code = _part_codenames()
    if not isinstance(hidden, list) or not all(isinstance(h, str) for h in hidden):
        raise ValidationFailed({"hidden": ["Send a list of parts."]})
    unknown = sorted(set(hidden) - set(by_code))
    if unknown:
        raise ValidationFailed({"hidden": [f"'{unknown[0]}' is not a part that can be hidden."]})
    override = dict(target.permissions_override or {})
    before = sorted(set(override.get("deny", [])) & _all_part_codenames())
    kept = [c for c in override.get("deny", []) if c not in _all_part_codenames()]
    wanted = sorted(set().union(*(by_code[h] for h in hidden))) if hidden else []
    if sorted(wanted) == before:
        return target
    override["deny"] = kept + wanted
    if not override["deny"]:
        override.pop("deny")
    Membership.objects.filter(pk=target.pk).update(
        permissions_override=override, permissions_version=target.permissions_version + 1
    )
    target.permissions_override = override
    target.permissions_version += 1
    write_audit(
        ctx=ctx,
        action=AuditAction.MEMBER_APPS_CHANGED,
        entity_type="platform_membership",
        entity_id=target.id,
        before={"hidden_parts": before},
        after={"hidden_parts": sorted(hidden)},
    )
    return target
