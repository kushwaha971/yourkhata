'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import dynamic from 'next/dynamic';

import {
  UbActionLink,
  UbButton,
  UbCard,
  UbChoiceChips,
  UbDrawerLoading,
  UbMoneyInput,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { ROUTES } from 'src/routes';
import { formatInr, sumMoney } from 'src/utils/money';

import { listSites, paySites, type SiteList } from '../api/siteService';

// Opened from other routes' chunks, so its words travel with it.
import 'src/i18n/catalogues/sales';

const SiteDrawer = dynamic(() => import('./SiteDrawer').then((m) => m.SiteDrawer), {
  ssr: false,
  loading: () => <UbDrawerLoading />,
});

/**
 * G7 — the contractor's page shows each site as a line, and one payment can be
 * split across them (design dSite's note). Each line takes its own amount; the
 * server puts it on that site's oldest bills first.
 */
export function ContractorSitesPanel({
  party,
  onPaid,
}: Readonly<{ party: { readonly id: string; readonly name: string }; onPaid?: () => void }>): React.JSX.Element | null {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { can } = usePermissions();
  const [list, setList] = useState<SiteList | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [amounts, setAmounts] = useState<Readonly<Record<string, string>>>({});
  const [mode, setMode] = useState('cash');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const key = useRef<{ body: string; value: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listSites({ party: party.id }, controller.signal)
      .then(setList)
      .catch(() => undefined);
    return () => controller.abort();
  }, [party.id, attempt]);

  const splits = (list?.sites ?? [])
    .filter((site) => Number(amounts[site.id]) > 0)
    .map((site) => ({ site_id: site.id, amount: amounts[site.id] as string }));
  const total = sumMoney(splits.map((row) => row.amount));

  const pay = useCallback(async () => {
    const body = JSON.stringify(splits);
    if (key.current?.body !== body) key.current = { body, value: crypto.randomUUID() };
    setBusy(true);
    try {
      await paySites({ mode, splits }, key.current.value);
      dispatch(showSnackbar({ severity: 'success', id: 'sales.site.paidSaved', params: { amount: formatInr(total) } }));
      setAmounts({});
      key.current = null;
      setAttempt((n) => n + 1);
      onPaid?.();
    } catch {
      // the global snackbar has said why
    } finally {
      setBusy(false);
    }
  }, [dispatch, mode, onPaid, splits, total]);

  if (!list) return null;
  return (
    <UbCard className="mt-4">
      <UbStack gap={3} data-testid="contractor-sites">
        <UbText variant="body-sm" className="font-semibold">{t('sales.site.title')}</UbText>
        {list.sites.length === 0 && <UbText variant="body-sm" tone="secondary">{t('sales.site.noneYet')}</UbText>}
        {list.sites.map((site) => (
          <UbStack key={site.id} gap={1}>
            <UbStack direction="row" gap={2} className="items-center justify-between">
              <UbActionLink href={`${ROUTES.SALES_SITES}/${site.id}`} variant="ghost" className="h-auto min-w-0 justify-start whitespace-normal p-0 text-left">
                {site.name}
              </UbActionLink>
              <UbText variant="body-sm" className="shrink-0 font-semibold">{formatInr(site.due)}</UbText>
            </UbStack>
            {Number(site.due) > 0 && can('payments.payment.write') && (
              <UbMoneyInput
                aria-label={t('sales.site.payFor', { name: site.name })}
                value={amounts[site.id] ?? ''}
                onChange={(value) => setAmounts((now) => ({ ...now, [site.id]: value }))}
              />
            )}
          </UbStack>
        ))}
        {splits.length > 0 && (
          <>
            <UbChoiceChips
              value={mode}
              onChange={setMode}
              ariaLabel={t('sales.site.howPaid')}
              options={[
                { value: 'cash', label: t('sales.site.cash') },
                { value: 'upi', label: t('sales.site.upi') },
                { value: 'bank', label: t('sales.site.bank') },
              ]}
            />
            <UbButton onClick={() => void pay()} busy={busy} data-testid="site-pay">
              {t('sales.site.take', { amount: formatInr(total) })}
            </UbButton>
          </>
        )}
        {can('sales.invoice.write') && (
          <UbButton variant="secondary" onClick={() => setAdding(true)} data-testid="contractor-site-new">
            {t('sales.site.new')}
          </UbButton>
        )}
      </UbStack>
      {adding && (
        <SiteDrawer
          party={party}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </UbCard>
  );
}
