'use client';

import { useState } from 'react';

import { useSearchParams } from 'next/navigation';

import {
  UbBox,
  UbButton,
  UbEmptyState,
  UbInfoRow,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbSearchInput,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';

import { findSerial, type SerialFound } from '../api/serialService';

const monthsLeft = (until: string | null): number | null => {
  if (!until) return null;
  const end = new Date(until);
  const now = new Date();
  const months = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth();
  return Math.max(months, 0);
};

/**
 * D P3 — Find by IMEI (design D8): scan or type an IMEI and see the phone,
 * whether it is in stock or sold, who bought it, on which bill, how much
 * warranty is left, and where it was bought from. The customer at the counter
 * with a phone in hand is answered in one step.
 */
export function FindImeiPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get('imei') ?? '');
  const [found, setFound] = useState<SerialFound | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const look = async (value: string): Promise<void> => {
    const text = value.replace(/\s+/g, '');
    if (!text) return;
    setBusy(true);
    try {
      setFound(await findSerial(text));
      setMissing(null);
    } catch {
      setFound(null);
      setMissing(text);
    } finally {
      setBusy(false);
    }
  };

  const left = monthsLeft(found?.warrantyUntil ?? null);
  return (
    <UbPageShell>
      <UbPageHeader title={t('items.imei.title')} subtitle={t('items.imei.subtitle')} />
      <UbStack gap={3} className="max-w-xl" data-testid="find-imei">
        <UbBox
          as="form"
          onSubmit={(event: React.FormEvent) => {
            event.preventDefault();
            void look(code);
          }}
        >
          <UbSearchInput
            value={code}
            onChange={setCode}
            placeholder={t('items.imei.placeholder')}
            aria-label={t('items.imei.placeholder')}
            autoFocus
            data-testid="find-imei-input"
          />
        </UbBox>
        {busy && (
          <UbText as="p" variant="caption" tone="tertiary">
            {t('items.imei.looking')}
          </UbText>
        )}
        {missing && !busy && (
          <UbEmptyState
            variant="filtered"
            title={t('items.imei.none.title', { code: missing })}
            description={t('items.imei.none.body')}
          />
        )}
        {found && !busy && (
          <UbPanel className="p-4" data-testid="find-imei-result">
            <UbStack gap={2}>
              <UbStack direction="row" align="center" className="justify-between gap-2">
                <UbText as="p" variant="body-medium">
                  {found.item.name}
                </UbText>
                <UbStatusBadge
                  tone={found.status === 'sold' ? 'success' : 'info'}
                  label={found.status === 'sold' ? t('items.imei.sold') : t('items.imei.inStock')}
                />
              </UbStack>
              <UbText as="p" variant="body-sm" tone="secondary">
                {t('items.imei.code', { code: found.serial })}
              </UbText>
              <UbBox className="border-t border-border-hairline pt-2">
                {found.sale?.customer && (
                  <UbInfoRow
                    label={t('items.imei.soldTo')}
                    value={[found.sale.customer.name, found.sale.customer.mobile].filter(Boolean).join(' · ')}
                  />
                )}
                {found.sale && (
                  <UbInfoRow
                    label={t('items.imei.bill')}
                    value={
                      <UbLink href={`/sales/invoices/${found.sale.id}`} variant="body-sm">
                        {`${found.sale.number ?? ''} · ${formatBusinessDate(found.sale.date)}`}
                      </UbLink>
                    }
                  />
                )}
                {found.warrantyUntil && (
                  <UbInfoRow
                    label={t('items.imei.warranty')}
                    value={t('items.imei.warrantyLeft', {
                      date: formatBusinessDate(found.warrantyUntil),
                      months: left ?? 0,
                    })}
                  />
                )}
                {found.purchase && (
                  <UbInfoRow
                    label={t('items.imei.boughtFrom')}
                    value={[
                      found.purchase.supplier?.name,
                      found.purchase.number,
                      formatBusinessDate(found.purchase.date),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                )}
              </UbBox>
            </UbStack>
          </UbPanel>
        )}
        {found?.sale && !busy && (
          <UbStack direction="row" gap={2}>
            <UbButton
              variant="secondary"
              onClick={() => router.push(`/sales/invoices/${found.sale?.id ?? ''}`)}
            >
              {t('items.imei.openBill')}
            </UbButton>
            {found.sale.customer?.mobile && (
              <UbLink href={`tel:${found.sale.customer.mobile}`} variant="body-sm-medium" className="self-center">
                {t('items.imei.call')}
              </UbLink>
            )}
          </UbStack>
        )}
      </UbStack>
    </UbPageShell>
  );
}
