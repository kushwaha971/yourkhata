'use client';

import { useState } from 'react';

import { UbButton, UbCheckbox, UbDrawer, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { lowStockWords } from '../view-model/itemDisplay';

import type { LowStockRow } from '../types/item.types';

/**
 * Owner, 16 Nov 2026: on a phone Low stock ordered only the whole list. A phone
 * card is one button (it opens the item), so a tick box cannot sit inside it;
 * the choice is made here instead — every loaded row with a tick, "Tick all",
 * and one purchase order for what is ticked (the desktop's "Order selected").
 */
export function LowStockChooseSheet({
  rows,
  onOrder,
  onClose,
}: Readonly<{
  rows: readonly LowStockRow[];
  onOrder: (picked: readonly LowStockRow[]) => void;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const all = rows.length > 0 && ticked.length === rows.length;
  const toggle = (id: string, on: boolean) =>
    setTicked((current) => (on ? [...current, id] : current.filter((x) => x !== id)));
  const picked = rows.filter((row) => ticked.includes(row.item.id));

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('stock.low.chooseTitle')}
      description={t('stock.low.chooseHint')}
      closeLabel={t('common.action.close')}
      footer={
        <>
          <UbButton variant="secondary" onClick={onClose}>
            {t('common.action.cancel')}
          </UbButton>
          <UbButton
            onClick={() => onOrder(picked)}
            disabled={picked.length === 0}
            data-testid="low-stock-choose-order"
          >
            {t('stock.low.orderCount', { count: picked.length })}
          </UbButton>
        </>
      }
    >
      <UbStack gap={1} data-testid="low-stock-choose-list">
        <UbCheckbox
          checked={all}
          indeterminate={ticked.length > 0 && !all}
          onChange={(on) => setTicked(on ? rows.map((row) => row.item.id) : [])}
          label={t('stock.low.tickAll')}
          className="min-h-11 border-b border-border-hairline pb-2"
        />
        {rows.map((row) => (
          <UbCheckbox
            key={row.item.id}
            checked={ticked.includes(row.item.id)}
            onChange={(on) => toggle(row.item.id, on)}
            className="min-h-11 py-1"
            label={
              <UbStack gap={0} className="min-w-0">
                <UbText as="span" variant="body-sm-medium" className="break-words">
                  {row.item.name}
                </UbText>
                <UbText
                  as="span"
                  variant="caption"
                  tone={row.stockStatus === 'out' ? 'error' : 'warning'}
                >
                  {lowStockWords(row, t)}
                </UbText>
              </UbStack>
            }
          />
        ))}
      </UbStack>
    </UbDrawer>
  );
}
