"""What a business owns in `lending` — read by PLT-10's export and deletion.
Ordered by the foreign keys: what points at a loan goes first."""

from __future__ import annotations

from apps.common.tenant_data import TenantTable, register

register(
    TenantTable("lending.Settings", export_name="lending_settings.csv"),
    TenantTable("lending.Route", export_name="lending_routes.csv"),
    TenantTable("lending.Borrower", export_name="lending_borrowers.csv"),
    TenantTable("lending.Loan", export_name="lending_loans.csv"),
    TenantTable("lending.Due", export_name="lending_schedule.csv"),
    TenantTable("lending.Collection", export_name="lending_collections.csv"),
    TenantTable("lending.Visit", export_name="lending_not_paid.csv"),
    TenantTable("lending.Message", export_name="lending_messages.csv"),
)
