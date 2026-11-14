"""The OTP wire shapes (PLT-01 §10; the way in since DEC-013/DEC-014)."""

from __future__ import annotations

import re

from rest_framework import serializers

from apps.platform_app.constants import OtpPurpose
from apps.platform_app.serializers.auth import MobileField

# Message Central sends four digits by default and allows up to eight; four
# to six is what this product accepts (DEC-014).
CODE_RE = re.compile(r"^\d{4,6}$")


class OtpRequestSerializer(serializers.Serializer):
    """`POST /auth/otp/request` — `{mobile, purpose}` (PLT-01 FR-2)."""

    mobile = MobileField(max_length=20)
    purpose = serializers.ChoiceField(choices=OtpPurpose.choices, default=OtpPurpose.LOGIN.value)
    device_hint = serializers.CharField(max_length=120, required=False, allow_blank=True)
    locale = serializers.ChoiceField(choices=["en", "hi"], required=False, default="en")

    # Owner, 14 Nov 2026: any country's mobile, India by default. `MobileField`
    # has normalised and validated it; the code goes by WhatsApp, which reaches
    # every country (the Indian-only SMS providers were removed the same day).


class OtpVerifySerializer(serializers.Serializer):
    """`POST /auth/otp/verify` — `{challenge_id, code, device_label}` (FR-4)."""

    challenge_id = serializers.UUIDField()
    code = serializers.RegexField(CODE_RE, help_text="Four to six digits.")
    device_label = serializers.CharField(max_length=120, required=False, allow_blank=True)
    locale = serializers.ChoiceField(choices=["en", "hi"], required=False)
