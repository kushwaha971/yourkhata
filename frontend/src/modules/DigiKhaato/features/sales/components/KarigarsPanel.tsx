'use client';

import { UbActionLink, UbButton, UbPanel, UbStack, UbStatusBadge, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';

import { PURITY_SHORT } from '../../inventory/api/tagService';

import type { Karigar, KarigarList, KarigarLot } from '../api/karigarService';

const wastageText = (k: Karigar, t: ReturnType<typeof useTranslation>['t']): string | null =>
  k.wastage_pct === null
    ? null
    : t(k.over_limit ? 'sales.karigar.over' : 'sales.karigar.within', {
        pct: k.wastage_pct,
        limit: Number(k.wastage_limit_pct).toString(),
      });

/**
 * G3b — design G3 dJOrders' "Karigars" panel: gold given and received back, what
 * is with each, and wastage against the limit (over it is shown, never refused).
 * Rows that wrap rather than a table, so a phone reads the same figures.
 */
export function KarigarsPanel({
  data,
  canWrite,
  onAdd,
  onReceive,
  onMakeTag,
  onTagsDone,
}: Readonly<{
  data: KarigarList;
  canWrite: boolean;
  onAdd: () => void;
  onReceive: (lot: KarigarLot) => void;
  onMakeTag: (lot: KarigarLot) => void;
  onTagsDone: (lot: KarigarLot) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
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
        {data.rows.map((k) => {
          const wastage = wastageText(k, t);
          return (
            <UbStack
              key={k.id}
              gap={1}
              className="border-t border-border-hairline pt-3"
              data-testid="karigar-row"
            >
              <UbStack direction="row" justify="between" align="center" className="flex-wrap gap-2">
                <UbText variant="body-sm-medium" className="break-words">
                  {k.name}
                </UbText>
                {wastage && (
                  <UbStatusBadge tone={k.over_limit ? 'warning' : 'success'} label={wastage} />
                )}
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
              <UbButton variant="secondary" size="sm" onClick={() => onReceive(lot)}>
                {t('sales.karigar.receive')}
              </UbButton>
            )}
          </UbStack>
        ))}
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
