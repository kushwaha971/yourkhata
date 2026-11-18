'use client';

import { useState } from 'react';

import { UbBox, UbMoneyInput, UbStack, UbText, UbTextInput } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

/** "09/2027" → the last day of that month ("2027-09-30"); a pack's expiry is a month. */
export const expiryFromMonth = (text: string): string => {
  const match = /^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/.exec(text.trim());
  if (!match) return '';
  const month = Number(match[1]);
  const raw = match[2] ?? '';
  const year = Number(raw.length === 2 ? `20${raw}` : raw);
  if (month < 1 || month > 12) return '';
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
};

const monthOf = (iso: string): string => (iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

export interface LineBatch {
  batchNo: string;
  expiry: string;
  mrp: string;
}

/**
 * D P4 — design D6: a medicine's purchase line takes its batch number, its
 * expiry and its MRP. A sale then takes the earliest-expiring batch first.
 */
export function LineBatchFields({
  value,
  onChange,
}: Readonly<{ value: LineBatch | undefined; onChange: (next: LineBatch) => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const current = value ?? { batchNo: '', expiry: '', mrp: '' };
  const [month, setMonth] = useState(monthOf(current.expiry));
  return (
    <UbBox className="grid grid-cols-3 gap-2" data-testid="line-batch-fields">
      <UbStack gap={1}>
        <UbText as="span" variant="label">
          {t('purchases.batch.no')}
        </UbText>
        <UbTextInput
          aria-label={t('purchases.batch.no')}
          value={current.batchNo}
          onChange={(next) => onChange({ ...current, batchNo: next.toUpperCase() })}
          maxLength={32}
          data-testid="line-batch-no"
        />
      </UbStack>
      <UbStack gap={1}>
        <UbText as="span" variant="label">
          {t('purchases.batch.expiry')}
        </UbText>
        {/* Design D6 types the month as on the pack: "09 / 2027". */}
        <UbTextInput
          aria-label={t('purchases.batch.expiry')}
          placeholder="MM/YYYY"
          inputMode="numeric"
          value={month}
          onChange={(next) => {
            setMonth(next);
            onChange({ ...current, expiry: expiryFromMonth(next) });
          }}
          maxLength={7}
          data-testid="line-batch-expiry"
        />
      </UbStack>
      <UbStack gap={1}>
        <UbText as="span" variant="label">
          {t('purchases.batch.mrp')}
        </UbText>
        <UbMoneyInput
          aria-label={t('purchases.batch.mrp')}
          value={current.mrp}
          onChange={(next) => onChange({ ...current, mrp: next ?? '' })}
        />
      </UbStack>
    </UbBox>
  );
}
