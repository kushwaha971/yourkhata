'use client';

import { useEffect, useState } from 'react';

import {
  UbBox,
  UbChoiceChips,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr, sumMoney } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';

import { getExpiry, type ExpiryRow, type ExpiryWindow } from '../api/expiryService';

/**
 * D P4 — Expiry (design D7): batches that have expired or will soon, earliest
 * first, with how many are left and what they are worth, so a medical store
 * returns them to the distributor before they are a loss.
 */
export function ExpiryPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const [within, setWithin] = useState<ExpiryWindow>('30');
  const [data, setData] = useState<{
    rows: readonly ExpiryRow[];
    counts: Record<ExpiryWindow, number>;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getExpiry(within, controller.signal)
      .then(setData)
      .catch(() => undefined);
    return () => controller.abort();
  }, [within]);

  const counts = data?.counts;
  const label = (key: ExpiryWindow, words: string) =>
    counts ? `${words} · ${counts[key]}` : words;
  const value = data ? sumMoney(data.rows.map((row) => row.value ?? '0')) : null;
  const anyValue = data?.rows.some((row) => row.value !== null) ?? false;

  return (
    <UbPageShell>
      <UbPageHeader title={t('stock.expiry.title')} subtitle={t('stock.expiry.subtitle')} />
      <UbStack gap={3} data-testid="expiry-screen">
        <UbChoiceChips<ExpiryWindow>
          value={within}
          onChange={setWithin}
          options={[
            { value: 'expired', label: label('expired', t('stock.expiry.expired')) },
            { value: '30', label: label('30', t('stock.expiry.next30')) },
            { value: '60', label: label('60', t('stock.expiry.days', { n: 60 })) },
            { value: '90', label: label('90', t('stock.expiry.days', { n: 90 })) },
          ]}
          ariaLabel={t('stock.expiry.title')}
        />
        {anyValue && value && (
          <UbText as="p" variant="body-sm" tone="secondary" data-testid="expiry-value">
            {t('stock.expiry.value', { amount: formatInr(value) })}
          </UbText>
        )}
        {data && data.rows.length === 0 ? (
          <UbEmptyState
            variant="filtered"
            title={t('stock.expiry.empty.title')}
            description={t('stock.expiry.empty.body')}
          />
        ) : (
          <UbPanel className="p-0">
            {(data?.rows ?? []).map((row) => (
              <UbBox
                key={`${row.item.id}-${row.batchNo}`}
                className="flex items-center justify-between gap-3 border-b border-border-hairline px-4 py-3 last:border-b-0"
                data-testid="expiry-row"
              >
                <UbStack gap={0.5} className="min-w-0">
                  <UbText as="span" variant="body-sm-medium" className="truncate">
                    {row.item.name}
                  </UbText>
                  <UbText as="span" variant="caption" tone="secondary">
                    {[
                      t('stock.expiry.batch', { batch: row.batchNo }),
                      t('stock.expiry.left', { qty: formatQuantity(row.qty) }),
                      row.value !== null ? formatInr(row.value) : null,
                      row.supplier,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </UbText>
                </UbStack>
                <UbStatusBadge
                  tone={row.days < 0 ? 'error' : 'warning'}
                  label={
                    row.days < 0
                      ? t('stock.expiry.expiredOn', { date: formatBusinessDate(row.expiry) })
                      : t('stock.expiry.inDays', { n: row.days })
                  }
                />
              </UbBox>
            ))}
          </UbPanel>
        )}
      </UbStack>
    </UbPageShell>
  );
}
