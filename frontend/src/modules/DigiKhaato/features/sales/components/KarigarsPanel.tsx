'use client';

import {
  UbActionLink,
  UbButton,
  UbDisclosure,
  UbPanel,
  UbStack,
  UbStatusBadge,
  UbText,
  type UbDataGridColumn,
} from 'src/design-system';
import { UbDataGrid, useGridTier } from 'src/design-system/UbDataGrid';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';

import { PURITY_SHORT } from '../../inventory/constants/purity';
import { inventoryGridLabels } from '../../inventory/view-model/gridLabels';

import type { Karigar, KarigarList, KarigarLot } from '../api/karigarService';

const wastageText = (k: Karigar, t: TranslateFn): string | null =>
  k.wastage_pct === null
    ? null
    : t(k.over_limit ? 'sales.karigar.over' : 'sales.karigar.within', {
        pct: k.wastage_pct,
        limit: Number(k.wastage_limit_pct).toString(),
      });

/** More lots than this start folded, so the panel stays short on a phone. */
const LOTS_OPEN_UP_TO = 5;

const columns = (
  t: TranslateFn,
  canWrite: boolean,
  onEdit: (k: Karigar) => void
): UbDataGridColumn<Karigar>[] => [
  {
    id: 'name',
    header: t('sales.karigar.who'),
    priority: 1,
    cardSlot: 'title',
    widthShare: 3,
    cell: (k) => k.name,
  },
  {
    id: 'issued',
    header: t('sales.karigar.colIssued'),
    priority: 1,
    align: 'end',
    cardSlot: 'meta',
    widthShare: 2,
    cell: (k) => `${k.issued_g} g`,
  },
  {
    id: 'received',
    header: t('sales.karigar.colReceived'),
    priority: 1,
    align: 'end',
    cardSlot: 'meta',
    widthShare: 2,
    cell: (k) => `${k.received_g} g`,
  },
  {
    id: 'with',
    header: t('sales.karigar.colWith'),
    priority: 1,
    align: 'end',
    cardSlot: 'meta',
    widthShare: 2,
    cell: (k) => `${k.with_g} g`,
  },
  {
    id: 'wastage',
    header: t('sales.karigar.colWastage'),
    priority: 1,
    cardSlot: 'trailing',
    widthShare: 3,
    cell: (k) => {
      const text = wastageText(k, t);
      return text ? (
        <UbStatusBadge tone={k.over_limit ? 'warning' : 'success'} label={text} />
      ) : (
        '—'
      );
    },
  },
  {
    id: 'edit',
    header: t('sales.karigar.edit'),
    priority: 1,
    cardSlot: 'none',
    widthShare: 1,
    cell: (k) =>
      canWrite ? (
        <UbButton variant="ghost" size="sm" onClick={() => onEdit(k)} data-testid="karigar-edit">
          {t('sales.karigar.edit')}
        </UbButton>
      ) : null,
  },
];

/**
 * G3b — design G3 dJOrders' "Karigars" panel: gold given and received back, what
 * is with each, and wastage against the limit (over it is shown, never refused).
 * A table on a desktop, as drawn; rows that wrap on a phone.
 */
export function KarigarsPanel({
  data,
  canWrite,
  onAdd,
  onReceive,
  onMakeTag,
  onTagsDone,
  onCorrect,
  onEdit,
}: Readonly<{
  data: KarigarList;
  canWrite: boolean;
  onAdd: () => void;
  onReceive: (lot: KarigarLot) => void;
  onMakeTag: (lot: KarigarLot) => void;
  onTagsDone: (lot: KarigarLot) => void;
  onCorrect: (lot: KarigarLot) => void;
  onEdit: (k: Karigar) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const cards = useGridTier() === 'cards';
  return (
    <UbPanel className="p-4" data-testid="karigars">
      <UbStack gap={3}>
        <UbStack direction="row" justify="between" align="center" className="flex-wrap gap-2">
          <UbStack gap={0}>
            <UbText variant="body-sm-medium">{t('sales.karigar.title')}</UbText>
            <UbText variant="caption" tone="tertiary">
              {t('sales.karigar.subtitle')}
            </UbText>
          </UbStack>
          {canWrite && (
            <UbButton variant="secondary" size="sm" onClick={onAdd} data-testid="karigar-add">
              {t('sales.karigar.add')}
            </UbButton>
          )}
        </UbStack>
        {data.rows.length === 0 && (
          <UbText variant="body-sm" tone="secondary">
            {t('sales.karigar.empty')}
          </UbText>
        )}
        {!cards && data.rows.length > 0 && (
          <UbDataGrid
            rows={data.rows}
            columns={columns(t, canWrite, onEdit)}
            rowId={(k) => k.id}
            rowName={(k) => k.name}
            state="rows"
            labels={inventoryGridLabels(t, {
              loading: 'sales.karigar.title',
              open: 'sales.karigar.title',
              selectAll: 'sales.karigar.title',
              selectRow: 'sales.karigar.title',
            })}
            emptyStates={{
              firstUse: { title: '', description: '' },
              filtered: { title: '', description: '' },
              error: { title: '', description: '', requestId: null, requestIdLabel: '' },
            }}
            caption={t('sales.karigar.title')}
            cardAvatar={false}
            tier="full"
            page={{ page: 1, pageSize: data.rows.length, total: data.rows.length, totalPages: 1 }}
            onPageChange={() => undefined}
          />
        )}
        {cards &&
          data.rows.map((k) => {
            const wastage = wastageText(k, t);
            return (
              <UbStack
                key={k.id}
                gap={1}
                className="border-t border-border-hairline pt-3"
                data-testid="karigar-row"
              >
                <UbStack
                  direction="row"
                  justify="between"
                  align="center"
                  className="flex-wrap gap-2"
                >
                  <UbText variant="body-sm-medium" className="break-words">
                    {k.name}
                  </UbText>
                  <UbStack direction="row" gap={2} align="center" className="flex-wrap">
                    {wastage && (
                      <UbStatusBadge tone={k.over_limit ? 'warning' : 'success'} label={wastage} />
                    )}
                    {canWrite && (
                      <UbButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(k)}
                        data-testid="karigar-edit"
                      >
                        {t('sales.karigar.edit')}
                      </UbButton>
                    )}
                  </UbStack>
                </UbStack>
                <UbText variant="body-sm" tone="secondary" className="ds-num">
                  {t('sales.karigar.figures', {
                    issued: k.issued_g,
                    received: k.received_g,
                    with: k.with_g,
                  })}
                </UbText>
              </UbStack>
            );
          })}
        {data.open_lots.length > 0 && (
          <UbDisclosure
            label={t('sales.karigar.goldOut', { count: data.open_lots.length })}
            defaultOpen={data.open_lots.length <= LOTS_OPEN_UP_TO}
          >
            <UbStack gap={2}>
              {data.open_lots.map((lot) => (
                <UbStack
                  key={lot.id}
                  direction="row"
                  justify="between"
                  align="center"
                  className="flex-wrap gap-2 rounded-lg bg-surface-sunken p-3"
                  data-testid="karigar-lot"
                >
                  <UbText variant="body-sm" className="ds-num min-w-0 break-words">
                    {[
                      lot.karigar.name,
                      `${lot.issued_g} g`,
                      PURITY_SHORT[lot.purity] ?? lot.purity,
                      lot.order_number,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </UbText>
                  {canWrite && (
                    <UbStack direction="row" gap={1} className="flex-wrap">
                      <UbButton variant="secondary" size="sm" onClick={() => onReceive(lot)}>
                        {t('sales.karigar.receive')}
                      </UbButton>
                      <UbButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onCorrect(lot)}
                        data-testid="karigar-lot-correct"
                      >
                        {t('sales.karigar.correct')}
                      </UbButton>
                    </UbStack>
                  )}
                </UbStack>
              ))}
            </UbStack>
          </UbDisclosure>
        )}
        {data.to_tag.map((lot) => (
          <UbStack
            key={lot.id}
            gap={2}
            className="rounded-lg border border-dashed border-border-subtle p-3"
            data-testid="karigar-to-tag"
          >
            <UbText variant="body-sm" className="ds-num break-words">
              {t('sales.karigar.toTag', {
                name: lot.karigar.name,
                back: lot.received_g ?? '0',
                tagged: lot.tagged_g,
                count: lot.tag_count,
              })}
            </UbText>
            {canWrite && (
              <UbStack direction="row" gap={2} className="flex-wrap">
                <UbButton size="sm" onClick={() => onMakeTag(lot)} data-testid="karigar-make-tag">
                  {t('sales.karigar.makeTag')}
                </UbButton>
                {lot.last_item_id && (
                  <UbActionLink
                    size="sm"
                    href={`${ROUTES.ITEM_LABELS}?item=${lot.last_item_id}`}
                    data-testid="karigar-labels"
                  >
                    {t('sales.karigar.printLabels')}
                  </UbActionLink>
                )}
                <UbButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onCorrect(lot)}
                  data-testid="karigar-lot-correct"
                >
                  {t('sales.karigar.correct')}
                </UbButton>
                <UbButton variant="ghost" size="sm" onClick={() => onTagsDone(lot)}>
                  {t('sales.karigar.tagsDone')}
                </UbButton>
              </UbStack>
            )}
          </UbStack>
        ))}
      </UbStack>
    </UbPanel>
  );
}
