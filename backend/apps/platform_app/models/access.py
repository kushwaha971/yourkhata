"""Access groups (owner, 14 Nov 2026; design: docs/revamp/design/access-groups.html).

An access group belongs to ONE business and ONE app: "Counter staff" in Branch
1's Business, "Library desk" in its Library. It holds a level for each part of
that app — off, view or full — and every member put in it gets those levels in
that app there. A member may also carry exceptions for single parts. Neither
ever gives more than the member's role; `services/access_groups.py` turns them
into permissions the member does not hold.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from apps.common.db.fields import uuid7_pk
from apps.common.models import TimeStampedModel


class AccessGroup(TimeStampedModel):
    """A named set of part levels for one app of one business."""

    id = uuid7_pk()
    tenant = models.ForeignKey(
        "platform.Tenant", on_delete=models.RESTRICT, related_name="access_groups"
    )
    app = models.CharField(max_length=32)
    name = models.CharField(max_length=60)
    #: New members of this app here start in the default group.
    is_default = models.BooleanField(default=False)
    #: `{part: "off" | "view" | "full"}`; a part left out is full.
    levels = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "platform_access_group"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "app", "name"], name="uq_access_group_tenant_app_name"
            ),
            models.UniqueConstraint(
                fields=["tenant", "app"],
                condition=Q(is_default=True),
                name="uq_access_group_one_default",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.tenant_id}:{self.app}:{self.name}"


class MemberAppAccess(TimeStampedModel):
    """One member's group and exceptions in one app of one business."""

    id = uuid7_pk()
    membership = models.ForeignKey(
        "platform.Membership", on_delete=models.CASCADE, related_name="app_access"
    )
    app = models.CharField(max_length=32)
    #: RESTRICT: a group with members cannot be deleted (owner's rule).
    group = models.ForeignKey(
        AccessGroup, on_delete=models.RESTRICT, null=True, blank=True, related_name="members"
    )
    #: Exceptions for this member only, `{part: level}`, over the group's levels.
    levels = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "platform_member_app_access"
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "app"], name="uq_member_app_access_membership_app"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.membership_id}:{self.app}:{self.group_id}"
