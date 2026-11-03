'use client';

import { useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';


import {
  UbButton,
  UbDataGrid,
  UbDialogLoading,
  UbStack,
  UbText,
  UbStatusBadge,
  useMediaQuery,
  type UbDataGridColumn,
} from 'src/design-system';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';

import { listItemTags, PURITY_SHORT, type Tag } from '../api/tagService';
import { toTola } from '../constants/purity';
import { inventoryGridLabels } from '../view-model/gridLabels';
import { ITEM_SELECT_IDS } from '../view-model/itemGridIds';

// A form belongs in the chunk that opens it (CLAUDE.md), with its own shape (A8).
const AddTagDialogLazy = dynamic(() => import('./AddTagDialog').then((m) => m.AddTagDialog), {
  ssr: false,
  loading: () => <UbDialogLoading />,
});

/** Design D5: a table at every width. A phone shows Tag, Net wt and Purity;
 * from lg the tab spans the page and adds HUID and Status; below 360 px
 * Purity goes too. */
const columns = (
  t: TranslateFn,
  wide: boolean,
  roomy: boolean,
  addWeights: ((tag: Tag) => void) | null
): UbDataGridColumn<Tag>[] => [
  {
    id: 'tag',
    header: t('items.tags.col.tag'),
    priority: 1,
    cardSlot: 'title',
    widthShare: 1,
    cell: (r) => r.tagNo,
  },
  {
    id: 'net',
    header: t('items.tags.col.net'),
    priority: 1,
    align: 'end',
    cardSlot: 'meta',
    widthShare: 1,
    cell: (r) =>
      r.netG ? (
        <UbStack gap={0} className="items-end">
          <UbText as="span" variant="inherit" className="ds-num">{`${Number(r.netG).toFixed(3)} g`}</UbText>
          <UbText as="span" variant="caption" tone="tertiary" className="ds-num">
            {`${toTola(r.netG)} ${t('items.tags.tolaShort')}`}
          </UbText>
        </UbStack>
      ) : addWeights && r.status === 'in_stock' ? (
        <UbButton
          variant="secondary"
          size="sm"
          onClick={() => addWeights(r)}
          data-testid="tag-add-weights"
        >
          {t('items.tags.addWeights')}
        </UbButton>
      ) : (
        '—'
      ),
  },
  ...(roomy
    ? ([
        {
          id: 'purity',
          header: t('items.tags.col.purity'),
          priority: 2,
          cardSlot: 'meta',
          widthShare: 1,
          cell: (r) => (r.purity ? PURITY_SHORT[r.purity] : '—'),
        },
      ] as UbDataGridColumn<Tag>[])
    : []),

  ...(wide
    ? ([
        {
          id: 'huid',
          header: 'HUID',
          priority: 3,
          cardSlot: 'none',
          widthShare: 1,
          cell: (r) => r.huid || '—',
        },
      ] as UbDataGridColumn<Tag>[])
    : []),
  ...(wide
    ? ([
        {
          id: 'status',
          header: t('items.tags.col.status'),
          priority: 1,
          cardSlot: 'trailing',
          widthShare: 1,
          cell: (r) => (
            <UbStatusBadge
              tone={r.status === 'in_stock' ? 'success' : 'neutral'}
              label={
                r.status === 'in_stock'
                  ? t('items.tags.inStock')
                  : r.status === 'sold' && r.soldOn
                    ? t('items.tags.soldOn', { date: formatBusinessDate(r.soldOn) })
                    : t('items.tags.returned')
              }
            />
          ),
        },
      ] as UbDataGridColumn<Tag>[])
    : []),
];

/** G2a — design D5 for a jeweller: the item page's "Weight and rate" tab. */
export function ItemTagsPanel({
  itemId,
  canAdd,
  onChanged,
}: Readonly<{ itemId: string; canAdd: boolean; onChanged: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const [rows, setRows] = useState<readonly Tag[] | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void listItemTags(itemId, controller.signal)
      .then(setRows)
      .catch(() => setRows([]));
    return () => controller.abort();
  }, [itemId]);

  const wide = useMediaQuery('(min-width: 1024px)');
  // Below 360 px a third column cuts the weights: Purity waits for room.
  const roomy = useMediaQuery('(min-width: 360px)');
  const [weighing, setWeighing] = useState<string | null>(null);
  const cols = useMemo(
    () => columns(t, wide, roomy, canAdd ? (tag) => setWeighing(tag.tagNo) : null),
    [t, wide, roomy, canAdd]
  );
  const labels = useMemo(
    () =>
      inventoryGridLabels(t, {
        loading: 'items.tags.loading',
        open: 'items.tags.title',
        ...ITEM_SELECT_IDS,
      }),
    [t]
  );
  return (
    <UbStack gap={3} data-testid="item-tags">
      {canAdd && (
        <UbButton
          variant="secondary"
          className="self-start"
          onClick={() => setAdding(true)}
          data-testid="tag-add"
        >
          {t('items.tags.add')}
        </UbButton>
      )}
      <UbDataGrid
        rows={rows ?? []}
        columns={cols}
        rowId={(r) => r.id}
        rowName={(r) => r.tagNo}
        state={rows === null ? 'loading' : rows.length === 0 ? 'empty' : 'rows'}
        labels={labels}
        emptyStates={{
          firstUse: { title: t('items.tags.empty'), description: t('items.tags.emptyBody') },
          filtered: { title: t('items.tags.empty'), description: t('items.tags.emptyBody') },
          error: { title: '', description: '', requestId: null, requestIdLabel: '' },
        }}
        caption={t('items.tags.title')}
        cardAvatar={false}
        tier="full"
        page={{
          page: 1,
          pageSize: Math.max(rows?.length ?? 0, 1),
          total: rows?.length ?? 0,
          totalPages: 1,
        }}
        onPageChange={() => undefined}
      />
      {weighing && (
        <AddTagDialogLazy
          itemId={itemId}
          tagNo={weighing}
          onClose={() => setWeighing(null)}
          onAdded={(tag) => {
            setRows((prev) => (prev ?? []).map((row) => (row.tagNo === tag.tagNo ? tag : row)));
            setWeighing(null);
            onChanged();
          }}
        />
      )}
      {adding && (
        <AddTagDialogLazy
          itemId={itemId}
          onClose={() => setAdding(false)}
          onAdded={(tag) => {
            setRows((prev) => [tag, ...(prev ?? [])]);
            setAdding(false);
            onChanged();
          }}
        />
      )}
    </UbStack>
  );
}
