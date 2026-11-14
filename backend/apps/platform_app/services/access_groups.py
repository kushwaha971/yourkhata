"""Access groups and each member's access in one app (owner, 14 Nov 2026).

Design: docs/revamp/design/access-groups.html (approved 14 Nov 2026). Team
follows the business AND the app that is open: Branch 1 › Business sets who can
use Business there and how, Library is set from Library's own Team page, each
branch keeps its own groups.

A PART is a set of permission codenames inside one app, split into what lets a
member SEE it and what lets them MAKE OR CHANGE it. A level turns into codenames
the member does not hold:

    off  → neither the see nor the change codenames
    view → not the change codenames
    full → nothing taken

A member's level for a part is their exception if they have one, else their
group's, else full. `access_denies` is subtracted in `permissions_for` after
everything else, so a level never gives more than the role and the server
refuses what is taken however the request is made. The owner and admins are
never narrowed: admins are not put in groups (owner's answer to the design's
question).

Reports is deliberately not a part: the Business Dashboard reads the same
`reports.basic.read`, so hiding Reports would take the member's home away.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import Count, F

from apps.common.audit import AuditAction, write_audit
from apps.common.context import Ctx
from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed

OFF, VIEW, FULL = "off", "view", "full"


@dataclass(frozen=True, slots=True)
class Part:
    code: str
    see: tuple[str, ...]
    change: tuple[str, ...]

    @property
    def levels(self) -> tuple[str, ...]:
        # A part that is only an action (take fees, give loans) has no "view".
        return (OFF, VIEW, FULL) if self.see else (OFF, FULL)


#: app code -> its parts, in the order the screen shows them.
PARTS: dict[str, tuple[Part, ...]] = {
    "shop": (
        Part(
            "sales",
            ("sales.invoice.read", "sales.estimate.read"),
            ("sales.invoice.write", "sales.estimate.write", "sales.credit_note.write", "sales.invoice.void"),
        ),
        Part(
            "purchases",
            ("purchases.bill.read",),
            ("purchases.bill.write", "purchases.order.write", "purchases.bill.void"),
        ),
        Part("stock", ("inventory.stock.read",), ("inventory.stock.adjust",)),
        Part(
            "payments",
            ("payments.payment.read",),
            ("payments.payment.write", "payments.request.write", "payments.payment.void"),
        ),
        Part("expenses", ("expenses.expense.read",), ("expenses.expense.write", "expenses.expense.void")),
    ),
    "library": (
        Part("library_students", (), ("library.member.write",)),
        Part("library_fees", (), ("library.fee.create",)),
    ),
    "lending": (
        Part("lending_lend", (), ("lending.loan.create",)),
        Part("lending_collect", (), ("lending.collection.create",)),
    ),
}

#: The ready-made group the empty tab offers, per app (owner's answer to the design).
SUGGESTED: dict[str, tuple[str, dict[str, str]]] = {
    "shop": ("Counter staff", {"sales": FULL, "purchases": OFF, "stock": VIEW, "payments": FULL, "expenses": OFF}),
    "library": ("Library desk", {"library_students": FULL, "library_fees": OFF}),
    "lending": ("Collection agent", {"lending_lend": OFF, "lending_collect": FULL}),
}

NOT_NARROWED = frozenset({"owner", "admin"})


def _part(app: str, code: str) -> Part | None:
    return next((p for p in PARTS.get(app, ()) if p.code == code), None)


def _clean_levels(app: str, levels: Any, *, field: str, keep_full: bool = False) -> dict[str, str]:
    """Only this app's parts, only levels the part offers. In a group, full is the
    absence of a row; in a member's exceptions full is kept, because it can
    differ from the group's view or off."""
    if levels is None:
        return {}
    if not isinstance(levels, dict):
        raise ValidationFailed({field: ["Send a level for each part."]})
    clean: dict[str, str] = {}
    for code, level in levels.items():
        part = _part(app, str(code))
        if part is None:
            raise ValidationFailed({field: [f"'{code}' is not a part of this app."]})
        if level not in part.levels:
            raise ValidationFailed({field: [f"{code}: choose one of {', '.join(part.levels)}."]})
        if level != FULL or keep_full:
            clean[part.code] = level
    return clean


def _taken(part: Part, level: str) -> set[str]:
    if level == OFF:
        return set(part.see) | set(part.change)
    if level == VIEW:
        return set(part.change)
    return set()


def effective_levels(access: Any) -> dict[str, str]:
    """`{part: level}` for one MemberAppAccess row: group, then the member's exceptions."""
    levels = dict(access.group.levels if access.group_id else {})
    levels.update(access.levels or {})
    return levels


def access_denies(membership: Any) -> frozenset[str]:
    """The codenames this member's groups and exceptions take away, every app."""
    cached = getattr(membership, "_ub_access_denies", None)
    if cached is not None:
        return cached
    from apps.platform_app.models import MemberAppAccess

    denied: set[str] = set()
    role_code = getattr(getattr(membership, "role", None), "code", None)
    if getattr(membership, "pk", None) is not None and role_code not in NOT_NARROWED:
        rows = MemberAppAccess.objects.filter(membership_id=membership.pk).select_related("group")
        for row in rows:
            for code, level in effective_levels(row).items():
                part = _part(row.app, code)
                if part is not None:
                    denied |= _taken(part, level)
    result = frozenset(denied)
    try:
        membership._ub_access_denies = result
    except AttributeError:  # a frozen stand-in
        pass
    return result


def _forget(membership: Any) -> None:
    for attr in ("_ub_access_denies", "_ub_app_grants"):
        if hasattr(membership, attr):
            delattr(membership, attr)


def _running_app(tenant: Any, app: Any) -> str:
    from apps.platform_app import apps_registry

    code = str(app or "")
    if code not in PARTS or code not in {a.code for a in apps_registry.apps_of_business(tenant)}:
        raise ValidationFailed({"app": ["This business does not run that app here."]})
    return code


def _bump(membership_ids: list[Any]) -> None:
    from apps.platform_app.models import Membership

    if membership_ids:
        Membership.objects.filter(pk__in=membership_ids).update(
            permissions_version=F("permissions_version") + 1
        )


# ── groups ───────────────────────────────────────────────────────────────────


def group_json(group: Any, members: int | None = None) -> dict:
    return {
        "id": str(group.id),
        "app": group.app,
        "name": group.name,
        "is_default": group.is_default,
        "levels": {p.code: group.levels.get(p.code, FULL) for p in PARTS.get(group.app, ())},
        "members": members if members is not None else group.members.count(),
    }


def parts_json(app: str) -> list[dict]:
    return [{"part": p.code, "levels": list(p.levels)} for p in PARTS.get(app, ())]


def groups_payload(tenant: Any, app: Any) -> dict:
    """`GET /access-groups?app=` — this app's groups here, its parts, and the example."""
    from apps.platform_app.models import AccessGroup

    code = _running_app(tenant, app)
    groups = (
        AccessGroup.objects.filter(tenant=tenant, app=code)
        .annotate(member_count=Count("members"))
        .order_by("-is_default", "name")
    )
    name, levels = SUGGESTED[code]
    return {
        "app": code,
        "parts": parts_json(code),
        "groups": [group_json(g, g.member_count) for g in groups],
        "suggested": {"name": name, "levels": {p.code: levels.get(p.code, FULL) for p in PARTS[code]}},
    }


def _group_of(tenant: Any, group_id: Any) -> Any:
    from apps.platform_app.models import AccessGroup

    try:
        group = AccessGroup.objects.select_for_update().filter(tenant=tenant, pk=group_id).first()
    except (ValueError, TypeError, Exception):  # a malformed id is not a 500
        group = None
    if group is None:
        raise NotFound()
    return group


def _name(raw: Any) -> str:
    name = str(raw or "").strip()
    if not name:
        raise ValidationFailed({"name": ["Give the group a name."]})
    if len(name) > 60:
        raise ValidationFailed({"name": ["Keep the name under 60 letters."]})
    return name


def _member_ids(group: Any) -> list[Any]:
    return list(group.members.values_list("membership_id", flat=True))


@transaction.atomic
def create_group(*, tenant: Any, data: Any, ctx: Ctx) -> dict:
    from apps.platform_app.models import AccessGroup

    data = data if isinstance(data, dict) else {}
    code = _running_app(tenant, data.get("app"))
    name = _name(data.get("name"))
    levels = _clean_levels(code, data.get("levels"), field="levels")
    is_default = bool(data.get("is_default") is True)
    if is_default:
        AccessGroup.objects.filter(tenant=tenant, app=code, is_default=True).update(is_default=False)
    try:
        with transaction.atomic():
            group = AccessGroup.objects.create(
                tenant=tenant, app=code, name=name, levels=levels, is_default=is_default
            )
    except IntegrityError:
        raise ValidationFailed({"name": ["There is already a group with this name here."]}) from None
    write_audit(
        ctx=ctx,
        action=AuditAction.ACCESS_GROUP_CHANGED,
        entity_type="platform_access_group",
        entity_id=group.id,
        after={"app": code, "name": name, "levels": levels, "is_default": is_default},
    )
    return group_json(group, 0)


@transaction.atomic
def update_group(*, tenant: Any, group_id: Any, data: Any, ctx: Ctx) -> dict:
    """Changes every member in the group at once; their sessions re-read."""
    from apps.platform_app.models import AccessGroup

    data = data if isinstance(data, dict) else {}
    group = _group_of(tenant, group_id)
    before = {"name": group.name, "levels": dict(group.levels), "is_default": group.is_default}
    if "name" in data:
        group.name = _name(data.get("name"))
    if "levels" in data:
        group.levels = _clean_levels(group.app, data.get("levels"), field="levels")
    if "is_default" in data:
        if data.get("is_default") is True and not group.is_default:
            AccessGroup.objects.filter(tenant=tenant, app=group.app, is_default=True).update(is_default=False)
        group.is_default = data.get("is_default") is True
    try:
        with transaction.atomic():
            group.save()
    except IntegrityError:
        raise ValidationFailed({"name": ["There is already a group with this name here."]}) from None
    members = _member_ids(group)
    if before["levels"] != group.levels:
        _bump(members)
    write_audit(
        ctx=ctx,
        action=AuditAction.ACCESS_GROUP_CHANGED,
        entity_type="platform_access_group",
        entity_id=group.id,
        before=before,
        after={"name": group.name, "levels": group.levels, "is_default": group.is_default},
    )
    return group_json(group, len(members))


@transaction.atomic
def delete_group(*, tenant: Any, group_id: Any, ctx: Ctx) -> None:
    """Only an empty group goes (owner's answer): its members are moved first."""
    group = _group_of(tenant, group_id)
    count = group.members.count()
    if count:
        raise BusinessRuleViolation(
            "group_has_members",
            f"{count} member(s) are in this group. Move them to another group first.",
            details={"members": count},
        )
    write_audit(
        ctx=ctx,
        action=AuditAction.ACCESS_GROUP_CHANGED,
        entity_type="platform_access_group",
        entity_id=group.id,
        before={"name": group.name, "app": group.app},
        after={"deleted": True},
    )
    group.delete()


# ── one member, one app ──────────────────────────────────────────────────────


def _target(tenant: Any, membership_id: Any) -> Any:
    from apps.platform_app.models import Membership

    target = (
        Membership.objects.select_related("role", "tenant")
        .select_for_update(of=("self",))
        .filter(tenant=tenant, pk=membership_id)
        .first()
    )
    if target is None:
        raise NotFound()
    return target


def _opens(membership: Any) -> list[str]:
    from apps.common.permissions_registry import permissions_for
    from apps.platform_app import apps_registry

    _forget(membership)
    return [a.code for a in apps_registry.accessible_apps(membership, permissions_for(membership))]


def member_access_json(membership: Any, app: str) -> dict:
    """`GET /members/{id}/access?app=` — can they use it here, their group, their exceptions."""
    from apps.common.permissions_registry import _role_codenames
    from apps.platform_app import apps_registry
    from apps.platform_app.models import MemberAppAccess

    row = MemberAppAccess.objects.filter(membership=membership, app=app).select_related("group").first()
    grants = apps_registry.grants_of(membership)
    role = grants.get(app) or membership.role
    held = _role_codenames(role) | set((membership.permissions_override or {}).get("allow", []))
    group_levels = dict(row.group.levels) if row and row.group_id else {}
    exceptions = dict(row.levels or {}) if row else {}
    parts = []
    for p in PARTS.get(app, ()):
        if not (set(p.see) | set(p.change)) & held:
            continue  # the role never held it: no switch that would be a lie
        parts.append(
            {
                "part": p.code,
                "levels": [lvl for lvl in p.levels if lvl != VIEW or set(p.see) & held],
                "group_level": group_levels.get(p.code, FULL),
                "level": exceptions.get(p.code, group_levels.get(p.code, FULL)),
            }
        )
    return {
        "app": app,
        "can_use": app in _opens(membership),
        "narrowed": membership.role.code not in NOT_NARROWED,
        "group_id": str(row.group_id) if row and row.group_id else None,
        "group_name": row.group.name if row and row.group_id else None,
        "parts": parts,
        "changes": sum(1 for p in parts if p["level"] != p["group_level"]),
    }


def _set_can_use(target: Any, app: str, can_use: bool, *, actor: Any, ctx: Ctx) -> None:
    """Add or remove ONE app for this member, leaving their other apps as they are."""
    from apps.platform_app import apps_registry
    from apps.common.permissions_registry import module_role
    from apps.platform_app.services.memberships import set_app_grants

    now = _opens(target)
    if (app in now) == can_use:
        return
    wanted = [c for c in now if c != app] + ([app] if can_use else [])
    shared = [c for c in wanted if c not in {"khata"}]
    if not shared:
        raise ValidationFailed({"can_use": ["Keep at least one app on. To stop them working here, use Block instead."]})
    grants = apps_registry.grants_of(target)

    def role_for(code: str) -> str:
        if code in grants:
            return grants[code].code
        spec = module_role(target.role.code)
        return "staff" if spec is not None and spec.module != code else target.role.code

    set_app_grants(
        tenant=target.tenant,
        membership_id=target.pk,
        grants=[{"app": c, "role": role_for(c)} for c in wanted],
        actor=actor,
        ctx=ctx,
    )


@transaction.atomic
def set_member_access(*, tenant: Any, membership_id: Any, app: Any, data: Any, actor: Any, ctx: Ctx) -> Any:
    """`PUT /members/{id}/access?app=` — can_use, group, exceptions, for this app only."""
    from apps.platform_app.models import MemberAppAccess

    data = data if isinstance(data, dict) else {}
    code = _running_app(tenant, app)
    target = _target(tenant, membership_id)
    if target.role.code in NOT_NARROWED:
        raise ValidationFailed({"group_id": ["The owner and admins can use every part. Groups are for other members."]})
    if "can_use" in data:
        if not isinstance(data["can_use"], bool):
            raise ValidationFailed({"can_use": ["Send true or false."]})
        _set_can_use(target, code, data["can_use"], actor=actor, ctx=ctx)
    row, _ = MemberAppAccess.objects.get_or_create(membership=target, app=code)
    before = {"group": str(row.group_id) if row.group_id else None, "levels": dict(row.levels)}
    if "group_id" in data:
        gid = data.get("group_id")
        if gid in (None, ""):
            row.group = None
        else:
            group = _group_of(tenant, gid)
            if group.app != code:
                raise ValidationFailed({"group_id": ["That group is for another app."]})
            row.group = group
    if "exceptions" in data:
        # An exception equal to the group's level is no exception: drop it, so
        # "1 change" counts only real differences.
        group_levels = dict(row.group.levels) if row.group_id else {}
        row.levels = {
            k: v
            for k, v in _clean_levels(code, data.get("exceptions"), field="exceptions", keep_full=True).items()
            if group_levels.get(k, FULL) != v
        }
    row.save()
    after = {"group": str(row.group_id) if row.group_id else None, "levels": dict(row.levels)}
    if after != before or "can_use" in data:
        _bump([target.pk])
    write_audit(
        ctx=ctx,
        action=AuditAction.MEMBER_APPS_CHANGED,
        entity_type="platform_membership",
        entity_id=target.id,
        before={"app": code, **before},
        after={"app": code, **after, "can_use": data.get("can_use")},
    )
    target.refresh_from_db()
    _forget(target)
    return target


def default_group(tenant: Any, app: str) -> Any:
    from apps.platform_app.models import AccessGroup

    return AccessGroup.objects.filter(tenant=tenant, app=app, is_default=True).first()


def list_access(memberships: list[Any], app: str) -> dict[str, dict]:
    """For the Members list of one app: each member's group and how many parts differ."""
    from apps.platform_app.models import MemberAppAccess

    rows = {
        r.membership_id: r
        for r in MemberAppAccess.objects.filter(membership__in=memberships, app=app).select_related("group")
    }
    out: dict[str, dict] = {}
    for m in memberships:
        row = rows.get(m.pk)
        group_levels = dict(row.group.levels) if row and row.group_id else {}
        exceptions = dict(row.levels or {}) if row else {}
        out[str(m.pk)] = {
            "can_use": app in _opens(m),
            "group_id": str(row.group_id) if row and row.group_id else None,
            "group_name": row.group.name if row and row.group_id else None,
            "changes": sum(1 for k, v in exceptions.items() if group_levels.get(k, FULL) != v),
        }
    return out


def member_by_mobile(tenant: Any, mobile: Any) -> Any:
    """An ACTIVE member of this business with this number, or None."""
    from apps.platform_app.constants import MembershipStatus
    from apps.platform_app.models import Membership

    if not mobile:
        return None
    return (
        Membership.objects.select_related("role", "tenant", "user")
        .filter(tenant=tenant, user__mobile=mobile, status=MembershipStatus.ACTIVE)
        .first()
    )


def start_in_app(*, tenant: Any, membership: Any, app: str, group_id: Any, actor: Any, ctx: Ctx) -> None:
    """A member added from inside `app`: that app and their own Money book, in a group."""
    from apps.platform_app import apps_registry
    from apps.platform_app.models import MemberAppAccess
    from apps.platform_app.services.memberships import set_app_grants

    if membership.role.code in NOT_NARROWED:
        return  # an admin is in every app, as before
    running = {a.code for a in apps_registry.apps_of_business(tenant)}
    codes = [app] + [c for c in ("khata",) if c in running and c != app]
    set_app_grants(
        tenant=tenant,
        membership_id=membership.pk,
        grants=[{"app": c, "role": membership.role.code} for c in codes],
        actor=actor,
        ctx=ctx,
    )
    group = _group_of(tenant, group_id) if group_id else default_group(tenant, app)
    if group is not None and group.app != app:
        raise ValidationFailed({"group_id": ["That group is for another app."]})
    MemberAppAccess.objects.update_or_create(
        membership=membership, app=app, defaults={"group": group, "levels": {}}
    )
