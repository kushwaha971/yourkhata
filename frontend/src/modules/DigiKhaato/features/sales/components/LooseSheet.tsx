'use client';

import { useState } from 'react';

import {
  UbButton,
  UbChoiceChips,
  UbDialog,
  UbInfoRow,
  UbMoneyInput,
  UbQuantityInput,
  UbSegmentedControl,
  UbStack,
  UbText,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import { LOOSE_AMOUNTS, looseLineAmount, looseWeight } from '../view-model/looseAmount';

import type { ItemListRow } from '../../inventory/types/item.types';

type Mode = 'weight' | 'amount';

/**
 * G11 (design `pLoose`) — a loose item sold by weight or by amount. A customer
 * asks for "₹50 of sugar": the sheet works out 1.136 kg at the item's rate, and
 * the line carries that weight, so stock goes down by it and the bill reads
 * "Sugar 1.136 kg × ₹44". Opens only for a kirana's item sold in kg or litres.
 */
export function LooseSheet({
  item,
  onAdd,
  onClose,
}: Readonly<{
  item: ItemListRow;
  onAdd: (qty: string) => void;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('amount');
  const [amount, setAmount] = useState('50');
  const [weight, setWeight] = useState('1');
  const rate = item.sellingPrice || '0';
  const unit = item.unit.code.toLowerCase().replace(/s$/, '');
  const qty = mode === 'amount' ? looseWeight(amount, rate) : Number(weight) > 0 ? weight : null;
  const lineAmount = qty ? looseLineAmount(qty, rate) : null;
  return (
    <UbDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={item.name}
      closeLabel={t('common.action.close')}
      footer={
        <>
          <UbButton variant="secondary" onClick={onClose}>
            {t('common.action.cancel')}
          </UbButton>
          <UbButton variant="primary" disabled={!qty} onClick={() => qty && onAdd(qty)} data-testid="loose-add">
            {t('sales.loose.add', { amount: formatInr(lineAmount ?? '0') })}
          </UbButton>
        </>
      }
    >
      <UbStack gap={3} data-testid="loose-sheet">
        <UbSegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          ariaLabel={t('sales.loose.how')}
          options={[
            { value: 'weight', label: t('sales.loose.byWeight') },
            { value: 'amount', label: t('sales.loose.byAmount') },
          ]}
        />
        {mode === 'amount' ? (
          <UbStack gap={1}>
            <UbText as="label" variant="label" htmlFor="loose-amount">
              {t('sales.loose.amount')}
            </UbText>
            <UbMoneyInput id="loose-amount" value={amount} onChange={setAmount} autoFocus data-testid="loose-amount" />
          </UbStack>
        ) : (
          <UbStack gap={1}>
            <UbText as="label" variant="label" htmlFor="loose-weight">
              {t('sales.loose.weight')}
            </UbText>
            <UbQuantityInput id="loose-weight" value={weight} onChange={setWeight} decimals={3} unit={unit} />
          </UbStack>
        )}
        <UbStack gap={1}>
          <UbInfoRow label={t('sales.loose.rate')} value={t('sales.loose.ratePer', { rate: formatInr(rate), unit })} />
          <UbInfoRow
            label={mode === 'amount' ? t('sales.loose.weight') : t('sales.loose.amount')}
            value={
              <UbText variant="body" className="font-semibold tabular-nums" data-testid="loose-result">
                {qty ? (mode === 'amount' ? `${qty} ${unit}` : formatInr(lineAmount)) : '—'}
              </UbText>
            }
          />
        </UbStack>
        {mode === 'amount' && (
          <UbChoiceChips<string>
            // The amount box writes "100.00"; the chip that lights is the one of the same value.
            value={LOOSE_AMOUNTS.find((value) => Number(value) === Number(amount)) ?? ''}
            onChange={setAmount}
            ariaLabel={t('sales.loose.quick')}
            options={LOOSE_AMOUNTS.map((value) => ({ value, label: `₹${value}` }))}
          />
        )}
        <UbText variant="caption" tone="secondary">
          {qty
            ? t('sales.loose.note', { name: item.name, weight: `${qty} ${unit}`, rate: formatInr(rate), amount: formatInr(lineAmount) })
            : t('sales.loose.needAmount')}
        </UbText>
      </UbStack>
    </UbDialog>
  );
}
