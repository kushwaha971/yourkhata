import { ROUTES } from 'src/routes';
import type { ModuleCode, PermissionCode } from 'src/types/domain.types';

/**
 * The Reports hub's list — DATA, like the sidebar (Part 19 §19.6.2), and in
 * a module that imports nothing heavier than the route table.
 *
 * Only reports that are BUILT are listed (owner rule: no unbuilt features),
 * each gated on the module and every codename its screen needs, so a row is
 * never a door to a 403. Where a report's screen already existed before
 * Reports did — LED-09's aging, INV-08's stock summary, INV-07's low stock,
 * EXP-03's cashbook — the row opens THAT screen; RPT-05/06 are the same
 * selectors, and a second copy of a screen is a second thing to keep right.
 *
 * The registers and the GST summary (W4-B) are the `sales` group. Their
 * gates mirror `useRegisterReport` / `useGstSummary` exactly — the reports
 * module plus the document module, `reports.basic.read` plus the document
 * read; the GST summary is `reports.financial.read`, which staff lack.
 */
export type ReportGroup = 'money' | 'parties' | 'stock' | 'sales';

export interface ReportCatalogueEntry {
  /** Names the copy: `reports.shell.hub.<key>.title` / `.description`. */
  readonly key: string;
  readonly group: ReportGroup;
  readonly href: string;
  readonly modules: readonly ModuleCode[];
  readonly permissions: readonly PermissionCode[];
  /** G4 — listed only where the business has this feature (a medical store's `batches`). */
  readonly feature?: string;
  /** A lucide icon name the hub maps to a component (keeps icons out of this module). */
  readonly icon:
    | 'dayBook'
    | 'cashbook'
    | 'receivable'
    | 'payable'
    | 'stock'
    | 'lowStock'
    | 'salesRegister'
    | 'purchaseRegister'
    | 'gst'
    | 'profit'
    | 'expiry'
    | 'scheduleH';
}

export const REPORT_GROUPS: readonly ReportGroup[] = ['money', 'parties', 'stock', 'sales'];

export const REPORT_CATALOGUE: readonly ReportCatalogueEntry[] = [
  {
    key: 'dayBook',
    group: 'money',
    href: ROUTES.REPORT_DAY_BOOK,
    modules: ['reports'],
    permissions: ['reports.basic.read'],
    icon: 'dayBook',
  },
  {
    key: 'cashbook',
    group: 'money',
    href: ROUTES.CASHBOOK,
    modules: ['expenses'],
    permissions: ['expenses.expense.read'],
    icon: 'cashbook',
  },
  {
    key: 'receivablesAging',
    group: 'parties',
    href: ROUTES.REPORT_AGING,
    modules: ['ledger'],
    permissions: ['ledger.entry.read'],
    icon: 'receivable',
  },
  {
    key: 'payablesAging',
    group: 'parties',
    href: `${ROUTES.REPORT_AGING}?type=payable`,
    modules: ['ledger'],
    permissions: ['ledger.entry.read'],
    icon: 'payable',
  },
  {
    key: 'stockSummary',
    group: 'stock',
    href: ROUTES.STOCK_SUMMARY,
    modules: ['inventory'],
    permissions: ['inventory.stock.read'],
    icon: 'stock',
  },
  {
    key: 'lowStock',
    group: 'stock',
    href: ROUTES.STOCK_LOW,
    modules: ['inventory'],
    permissions: ['inventory.stock.read'],
    icon: 'lowStock',
  },
  {
    key: 'salesRegister',
    group: 'sales',
    href: ROUTES.REPORTS_SALES_REGISTER,
    modules: ['reports', 'sales'],
    permissions: ['reports.basic.read', 'sales.invoice.read'],
    icon: 'salesRegister',
  },
  {
    key: 'purchaseRegister',
    group: 'sales',
    href: ROUTES.REPORTS_PURCHASE_REGISTER,
    modules: ['reports', 'purchases'],
    permissions: ['reports.basic.read', 'purchases.bill.read'],
    icon: 'purchaseRegister',
  },
  {
    // Shop item 1 — every figure is a cost or a margin, so it is the financial read's.
    key: 'profit',
    group: 'sales',
    href: ROUTES.REPORTS_PROFIT,
    modules: ['reports', 'sales'],
    permissions: ['reports.basic.read', 'sales.invoice.read', 'reports.financial.read'],
    icon: 'profit',
  },
  {
    // G4 — a medical store's batches by expiry, and its Schedule H sales.
    key: 'nearExpiry',
    group: 'stock',
    href: ROUTES.STOCK_EXPIRY,
    modules: ['inventory'],
    permissions: ['inventory.stock.read'],
    feature: 'batches',
    icon: 'expiry',
  },
  {
    key: 'scheduleH',
    group: 'sales',
    href: ROUTES.REPORTS_SCHEDULE_H,
    modules: ['reports', 'sales'],
    permissions: ['reports.basic.read', 'sales.invoice.read'],
    feature: 'batches',
    icon: 'scheduleH',
  },
  {
    key: 'gstSummary',
    group: 'sales',
    href: ROUTES.REPORTS_GST_SUMMARY,
    modules: ['reports'],
    permissions: ['reports.financial.read'],
    icon: 'gst',
  },
];
/** The entries this reader can open, in catalogue order. */
export const visibleReports = (
  entries: readonly ReportCatalogueEntry[],
  can: (permission: PermissionCode) => boolean,
  hasModule: (module: ModuleCode) => boolean,
  features: readonly string[] = []
): readonly ReportCatalogueEntry[] =>
  entries.filter(
    (entry) =>
      entry.modules.every(hasModule) &&
      entry.permissions.every((code) => can(code)) &&
      (!entry.feature || features.includes(entry.feature))
  );
