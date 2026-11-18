"""No screen shows a shopkeeper "Must be a valid UUID." (16 Nov 2026).

A purchase saved with its supplier box empty sent `party_id: ""`, and DRF's
default UUIDField message reached the screen under Supplier. Every id field
on the server is a choice the person made from a list, so the fallback says
that in plain words; a field that knows better still says its own.
"""

from __future__ import annotations

from rest_framework import serializers


class _Pick(serializers.Serializer):
    party_id = serializers.UUIDField()


def test_an_id_field_refuses_junk_in_plain_words() -> None:
    form = _Pick(data={"party_id": "not-an-id"})
    assert not form.is_valid()
    message = str(form.errors["party_id"][0])
    assert "UUID" not in message
    assert message == "Choose one from the list."
