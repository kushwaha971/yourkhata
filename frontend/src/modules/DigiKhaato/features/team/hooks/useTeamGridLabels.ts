'use client';

import { useMemo } from 'react';

import type { UbDataGridLabels } from 'src/design-system/UbDataGrid';
import { useTranslation } from 'src/hooks/useTranslation';

/** The grid's words for every list on the Team page (members, access groups). */
export function useTeamGridLabels(loadingId: string): UbDataGridLabels {
  const { t } = useTranslation();
  return useMemo<UbDataGridLabels>(
    () => ({
      loading: t(loadingId),
      // `{page}` and `{pages}` pass through as literal text: the grid
      // substitutes them itself, because it is the only thing that knows them.
      pageOf: t('common.grid.pageOf', { page: '{page}', pages: '{pages}' }),
      previousPage: t('common.grid.previousPage'),
      nextPage: t('common.grid.nextPage'),
      pageSize: t('common.grid.pageSize'),
      // `{page}` and `{total}` pass through as literal text, like `pageOf`
      // above: the pagination bar substitutes them, because it is the only
      // thing that knows which page a button points at.
      goToPage: t('common.grid.goToPage', { page: '{page}' }),
      ofTotal: t('common.grid.ofTotal', { total: '{total}' }),
      // This grid has no selection — `selectable` is never passed, because a
      // team is read down a list rather than acted on in bulk — so nothing ever
      // paints this. It is a required part of the grid's contract and is given
      // an honest zero rather than a placeholder: `selectedCount` is an ICU
      // PLURAL, and a plural resolved against the string `'{count}'` renders
      // "NaN selected", which is what the party list was showing.
      selectedCount: t('common.grid.selectedCount', { count: 0 }),

      selectAll: t('team.list.select.all'),
      selectRow: t('team.list.select.row', { name: '{name}' }),
      showing: t('common.grid.showing'),
      columns: t('common.grid.columns'),
      showAllColumns: t('common.grid.showAllColumns'),
      sortBy: t('common.grid.sortBy', { column: '{column}' }),
      sortedAscending: t('common.grid.sortedAscending'),
      sortedDescending: t('common.grid.sortedDescending'),
      openRow: t('team.list.open', { name: '{name}' }),
    }),
    [t, loadingId]
  );
}
