"""AppConfig for the shared kernel (Part 20 §20.1.2)."""

from __future__ import annotations

import logging
import os

from django.apps import AppConfig

logger = logging.getLogger("ub.common")


class CommonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.common"
    label = "common"
    verbose_name = "Common"

    def ready(self) -> None:
        """Warn about unrecognised `UB_` variables (Part 20 §20.13.2)."""
        from django.utils.translation import gettext_lazy as _
        from rest_framework import serializers

        from apps.common.env_catalogue import KNOWN_UB_VARIABLES

        # Every id the app sends is a choice from a list; DRF's "Must be a valid
        # UUID." reached a shopkeeper under Supplier (16 Nov 2026). Plain words.
        serializers.UUIDField.default_error_messages["invalid"] = _("Choose one from the list.")

        unknown = sorted(
            key for key in os.environ if key.startswith("UB_") and key not in KNOWN_UB_VARIABLES
        )
        if unknown:
            logger.warning("settings.unknown_env_vars", extra={"variables": unknown})
