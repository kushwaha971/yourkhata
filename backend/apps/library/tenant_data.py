"""What a business owns in `library` — read by PLT-10's export and deletion.
The order follows the foreign keys: what points at a student goes first."""

from __future__ import annotations

from apps.common.tenant_data import TenantTable, register

register(
    TenantTable("library.Settings", export_name="library_settings.csv"),
    TenantTable("library.Shift", export_name="library_shifts.csv"),
    TenantTable("library.Seat", export_name="library_seats.csv"),
    TenantTable("library.Student", export_name="library_students.csv"),
    TenantTable("library.Payment", export_name="library_payments.csv"),
    TenantTable("library.Attendance", export_name="library_attendance.csv"),
    TenantTable("library.Message", export_name="library_messages.csv"),
    TenantTable("library.Expense", export_name="library_expenses.csv"),
    TenantTable("library.Book", export_name="library_books.csv"),
    TenantTable("library.BookIssue", export_name="library_book_issues.csv"),
)
