"""What a business owns in `reports` — read by PLT-10's export and deletion.

An `Export` row is bookkeeping for a file the member already downloaded, not a
record of the business, so it is deleted but not written to the full export.
Its file is a `files.Attachment` (PROTECT), which orders this table first.

A `Snapshot` is a cache (RPT-01): deleted with the business, never exported,
because every row in it can be recomputed from the tables that are.

A `CashCount` (BP-17) IS a record of the business — what the owner found in
the drawer and when — so it is exported. It refuses DELETE by trigger
(migration 0003); the deletion job disables exactly that trigger, as for the
ledger.
"""

from __future__ import annotations

from apps.common.tenant_data import TenantTable, register

register(
    TenantTable("reports.Export"),
    TenantTable("reports.Snapshot"),
    TenantTable(
        "reports.CashCount",
        export_name="cash_counts.csv",
        triggers=("reports_cash_count_forbid_update_delete",),
    ),
)
