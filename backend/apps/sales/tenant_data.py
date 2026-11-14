"""What a business owns in `sales` — read by PLT-10's export and deletion.

`SalesDocumentLine` has no tenant column; it reaches the tenant through its
document. It is registered anyway, because its RESTRICT foreign key to
`inventory.Item` is what orders sales before inventory in `deletion_order()` —
registering only the header would let the job reach the items while lines still
point at them.

`SalesCreditApplication` (SAL-04) references two documents with RESTRICT, so
the computed order drains applications before documents; no trigger refuses a
DELETE on it (a void deletes its rows).
"""

from __future__ import annotations

from apps.common.tenant_data import TenantTable, register

register(
    TenantTable("sales.SalesDocument", export_name="sales_documents.csv"),
    TenantTable(
        "sales.SalesDocumentLine",
        export_name="sales_document_lines.csv",
        tenant_path="document__tenant",
    ),
    TenantTable("sales.SalesCreditApplication", export_name="sales_credit_applications.csv"),
    TenantTable("sales.DraftCreation", export_name="sales_draft_creations.csv"),
    TenantTable("sales.CustomOrder", export_name="custom_orders.csv"),
    # G7 — a contractor's sites.
    TenantTable("sales.ContractorSite", export_name="contractor_sites.csv"),
    TenantTable("sales.Scheme", export_name="schemes.csv"),
    # G11 — a kirana's phone orders.
    TenantTable("sales.PhoneOrder", export_name="phone_orders.csv"),
    # G10 — a café's open and advance orders.
    TenantTable("sales.CafeOrder", export_name="cafe_orders.csv"),
    # G5 — a mobile shop's repair jobs.
    TenantTable("sales.RepairJob", export_name="repair_jobs.csv"),
    TenantTable("sales.Karigar", export_name="karigars.csv"),
    TenantTable("sales.KarigarLot", export_name="karigar_lots.csv"),
)
