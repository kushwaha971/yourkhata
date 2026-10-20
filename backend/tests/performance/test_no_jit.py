"""PostgreSQL's JIT is off on the application's connections.

Found 20 Oct 2026 on the Shop Customers tab: `GET /parties?book=shop&type=customer`
took 1.5-1.9 s on a 2,000-contact tenant while the query itself executed in
about 40 ms. `EXPLAIN ANALYZE` put the rest in JIT — "Functions: 502 ... Emission
553 ms, Total 638 ms" — because the Shop-facts annotations are thirty-odd
correlated subqueries whose ESTIMATED cost (1.6 M) is far above
`jit_above_cost` (100 k), although each one is an index probe that returns in
microseconds. The list, its totals and its chip counts each paid the compile,
so one tap cost three of them. An OLTP page never runs long enough for compiled
expressions to repay the compile; the setting goes on the connection, so it is
true wherever the app runs, whatever the server's own default.
"""

from __future__ import annotations

import importlib

import pytest
from django.db import connection

pytestmark = [pytest.mark.django_db]


def test_the_application_connection_never_jit_compiles() -> None:
    with connection.cursor() as cursor:
        cursor.execute("SHOW jit")
        assert cursor.fetchone()[0] == "off"


def test_every_environment_inherits_jit_off_from_base_settings() -> None:
    """`local` and `prod` take OPTIONS from `base`; the test run's own override
    must not be the only place the line exists."""
    base = importlib.import_module("config.settings.base")
    assert "-c jit=off" in base.DATABASES["default"]["OPTIONS"]["options"]
