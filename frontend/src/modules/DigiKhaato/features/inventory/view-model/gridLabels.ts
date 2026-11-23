import type { UbDataGridLabels } from 'src/design-system/UbDataGrid';
import type { TranslateFn } from 'src/hooks/useTranslation';

/** The per-screen message ids; everything else is the shell's common grid copy. */
export interface InventoryGridLabelIds {
  readonly loading: string;
  readonly open: string;
  /**
   * Passed in rather than named here, so a screen pays only for the
   * catalogue it renders: the price lists do not load the items catalogue
   * for two selection labels they never show.
   */
  readonly selectAll: string;
  readonly selectRow: string;
}

/**
 * The grid's chrome labels for the inventory screens — written once instead of
 * five times. The placeholders (`{page}`, `{name}` …) are filled by the grid
 * itself.
 */
export const inventoryGridLabels = (
  t: TranslateFn,
  ids: InventoryGridLabelIds
): UbDataGridLabels => ({
  loading: t(ids.loading),
  pageOf: t('common.grid.pageOf', { page: '{page}', pages: '{pages}' }),
  previousPage: t('common.grid.previousPage'),
  nextPage: t('common.grid.nextPage'),
  pageSize: t('common.grid.pageSize'),
  goToPage: t('common.grid.goToPage', { page: '{page}' }),
  ofTotal: t('common.grid.ofTotal', { total: '{total}' }),
  selectedCount: t('common.grid.selectedCount', { count: 0 }),
  selectAll: t(ids.selectAll),
  selectRow: t(ids.selectRow, { name: '{name}' }),
  showing: t('common.grid.showing'),
  columns: t('common.grid.columns'),
  showAllColumns: t('common.grid.showAllColumns'),
  sortBy: t('common.grid.sortBy', { column: '{column}' }),
  sortedAscending: t('common.grid.sortedAscending'),
  sortedDescending: t('common.grid.sortedDescending'),
  openRow: t(ids.open, { name: '{name}' }),
});
