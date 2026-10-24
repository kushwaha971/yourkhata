'use client';

import type { ReactNode } from 'react';

import {
  UbButton,
  UbDivider,
  UbEmptyState,
  UbLink,
  UbPanel,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import type { RequestStatus } from 'src/types/api.types';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';

import { formatSignedQuantity, isInbound, movementLabelId } from '../view-model/itemDisplay';
import { movementView } from '../view-model/movementDisplay';

import type { StockMovement } from '../types/item.types';

/**
 * INV-03 FR-2 — the movement ledger, newest ARRIVAL first, so each row's
 * running figures (on hand after, average after) read consistently down the
 * page (CR-2026-09-24-INV-A). Inbound is success-toned, outbound error-toned,
 * and the words "In"/"Out" are always there beside the colour. A row dated
 * before an earlier arrival carries "Backdated".
 *
 * 09 §8.2 — each row says what moved the stock in words ("Sold on INV/…",
 * "Adjusted: Damage", "PB/… cancelled", `movementView`) and the WHOLE row opens
 * it: a document's page when the viewer may read that module, an adjustment's
 * dialog; an opening opens nothing. A row whose document was later cancelled
 * says so. On a phone the running figure moves under the date, because beside
 * the title it squeezed "Reversal · …" to half a line.
 *
 * The row's title owns its line (the khata's rule): badges sit on the caption
 * underneath, never beside the title where they would squeeze it.
 */
export function ItemMovementList({
  movements,
  unitCode,
  status,
  hasMore,
  onLoadMore,
  onOpenSource,
  canOpenModule,
  onRetry,
  emptyAction,
}: Readonly<{
  movements: readonly StockMovement[];
  unitCode: string;
  status: RequestStatus;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpenSource: (sourceId: string) => void;
  /** Whether the viewer may open a sale's or a purchase's page. */
  canOpenModule?: (module: 'sales' | 'purchases') => boolean;
  /** Shown on a failed first page, so the tab recovers by itself. */
  onRetry?: () => void;
  emptyAction?: ReactNode;
}>): React.JSX.Element {
  const { t } = useTranslation();

  if (status === 'loading' && movements.length === 0) {
    return <UbSkeleton variant="list" />;
  }
  if (status === 'failed' && movements.length === 0) {
    return (
      <UbEmptyState
        variant="error"
        title={t('items.movements.error')}
        action={
          onRetry ? (
            <UbButton variant="secondary" onClick={onRetry}>
              {t('common.action.retry')}
            </UbButton>
          ) : undefined
        }
      />
    );
  }
  if (movements.length === 0) {
    return (
      <UbEmptyState
        variant="firstUse"
        title={t('items.movements.empty.title')}
        description={t('items.movements.empty.body')}
        action={emptyAction}
      />
    );
  }

  return (
    <UbPanel>
      <UbStack as="ul" gap={0} data-testid="item-movements">
        {movements.map((movement, index) => {
          const inbound = isInbound(movement.qty);
          const view = movementView(movement);
          const href =
            view.href && view.module && (canOpenModule?.(view.module) ?? false) ? view.href : null;
          const adjustmentId = view.adjustmentId;
          const opens = href !== null || adjustmentId !== null;
          const title = t(view.titleId, {
            number: view.number ?? '',
            reason: view.reasonId ? t(view.reasonId) : '',
            type: t(movementLabelId(movement.movementType)),
          });
          const after =
            /* Without `reports.financial.read` the server omits the running
               average; the quantity alone is still useful. */
            movement.avgCostAfter === null
              ? t('items.movements.afterQty', {
                  qty: formatQuantity(movement.onHandAfter, unitCode),
                })
              : t('items.movements.after', {
                  qty: formatQuantity(movement.onHandAfter, unitCode),
                  cost: formatInr(movement.avgCostAfter),
                });
          const cancelled =
            movement.source.status === 'void' && movement.movementType !== 'reversal';
          const row = (
            <UbStack direction="row" gap={3} justify="between" className="min-h-11 px-4 py-3">
              <UbStack gap={1} className="min-w-0 flex-1">
                <UbText
                  variant="body-sm-medium"
                  tone={opens ? 'accent' : 'primary'}
                  className={opens ? 'line-clamp-2 underline' : 'line-clamp-2'}
                >
                  {title}
                </UbText>
                <UbStack direction="row" gap={2} wrap align="center">
                  <UbText as="span" variant="caption" tone="tertiary">
                    {formatBusinessDate(movement.movementDate)}
                    {movement.createdBy ? ` · ${movement.createdBy.name}` : ''}
                  </UbText>
                  {cancelled && (
                    <UbStatusBadge tone="neutral" label={t('items.movements.cancelled')} />
                  )}
                  {movement.isBackdated && (
                    <UbStatusBadge tone="info" label={t('items.movements.backdated')} />
                  )}
                </UbStack>
                <UbText as="span" variant="caption" tone="tertiary" className="ds-num md:hidden">
                  {after}
                </UbText>
              </UbStack>
              <UbStack gap={0} align="end" className="shrink-0">
                <UbText
                  as="span"
                  variant="body-sm-medium"
                  tone={inbound ? 'success' : 'error'}
                  className="ds-num whitespace-nowrap"
                  aria-label={t(inbound ? 'items.movements.inLabel' : 'items.movements.outLabel', {
                    qty: formatQuantity(movement.qty.replace('-', ''), unitCode),
                  })}
                >
                  {formatSignedQuantity(movement.qty, unitCode)}
                </UbText>
                <UbText
                  as="span"
                  variant="caption"
                  tone="tertiary"
                  className="ds-num whitespace-nowrap max-md:hidden"
                >
                  {after}
                </UbText>
              </UbStack>
            </UbStack>
          );
          return (
            <UbStack as="li" key={movement.id} gap={0}>
              {index > 0 && <UbDivider />}
              {opens ? (
                <UbLink
                  href={href ?? '#'}
                  tone="primary"
                  underline={false}
                  className="block hover:bg-surface-hover"
                  data-testid="item-movement-open"
                  onClick={
                    href
                      ? undefined
                      : (event: React.MouseEvent) => {
                          event.preventDefault();
                          onOpenSource(adjustmentId ?? '');
                        }
                  }
                >
                  {row}
                </UbLink>
              ) : (
                row
              )}
            </UbStack>
          );
        })}
      </UbStack>
      {status === 'failed' && onRetry && (
        <UbStack className="px-4 py-3" gap={2} align="center" data-testid="item-movements-failed">
          <UbText variant="caption" tone="error">
            {t('items.movements.error')}
          </UbText>
          <UbButton variant="secondary" size="sm" onClick={onRetry}>
            {t('common.action.retry')}
          </UbButton>
        </UbStack>
      )}
      {hasMore && status !== 'failed' && (
        <UbStack className="px-4 py-3" align="center">
          <UbButton
            variant="secondary"
            size="sm"
            onClick={onLoadMore}
            busy={status === 'loading'}
            busyLabel={t('common.loading')}
          >
            {t('items.movements.loadMore')}
          </UbButton>
        </UbStack>
      )}
    </UbPanel>
  );
}
