'use client';

import { useEffect, useState } from 'react';

import { Plus } from 'lucide-react';

import {
  UbActionLink,
  UbBox,
  UbButton,
  UbCard,
  UbPageHeader,
  UbPageShell,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';
import { ROUTES } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { getSite, type SiteDetail } from '../api/siteService';

/** G7 — one site (design pSite): what it owes, Remind, New bill, its own bills. */
export function SiteDetailPageContent({ id }: Readonly<{ id: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const shop = useAppSelector(selectActiveTenant)?.name ?? '';
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getSite(id, controller.signal)
      .then((next) => {
        setSite(next);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [id, attempt]);

  if (failed)
    return (
      <UbPageShell>
        <UbStack gap={3} className="items-start">
          <UbText>{t('sales.site.error')}</UbText>
          <UbButton onClick={() => setAttempt((n) => n + 1)}>{t('common.action.retry')}</UbButton>
        </UbStack>
      </UbPageShell>
    );
  if (!site)
    return (
      <UbPageShell>
        <UbSkeleton className="h-64 w-full" />
      </UbPageShell>
    );

  const owes = Number(site.due) > 0;
  const mobile = site.party.mobile?.replace(/\D/g, '').slice(-10);
  const remind =
    owes && mobile
      ? `https://wa.me/91${mobile}?text=${encodeURIComponent(
          t('sales.site.remindMessage', { name: site.party.name, site: site.name, amount: formatInr(site.due), shop })
        )}`
      : null;
  const facts = [
    site.days_late > 0 ? t('sales.site.daysLate', { count: site.days_late }) : null,
    site.credit_limit ? t('sales.site.limit', { amount: formatInr(site.credit_limit) }) : null,
    t(site.bills === 1 ? 'sales.site.oneBill' : 'sales.site.billCount', { count: site.bills }),
  ].filter(Boolean);
  const newBill = `${ROUTES.SALES_INVOICES}/new?site=${site.id}&party=${site.party.id}&partyName=${encodeURIComponent(site.party.name)}`;

  return (
    <UbPageShell>
      <UbPageHeader title={site.name} subtitle={t('sales.site.ofContractor', { name: site.party.name })} />
      <UbStack gap={3} data-testid="site-screen">
        <UbCard>
          <UbStack gap={1}>
            <UbText variant="body-sm" tone="secondary">{t('sales.site.toCollectHere')}</UbText>
            <UbText className="text-[26px] font-bold leading-tight" data-testid="site-due">{formatInr(site.due)}</UbText>
            <UbText variant="body-sm" tone="secondary">{facts.join(' · ')}</UbText>
          </UbStack>
        </UbCard>
        <UbBox className="grid grid-cols-2 gap-2 lg:max-w-md">
          {remind ? (
            <UbActionLink href={remind} target="_blank" rel="noopener noreferrer" variant="secondary">
              {t('sales.site.remind')}
            </UbActionLink>
          ) : (
            <UbButton variant="secondary" disabled>{t('sales.site.remind')}</UbButton>
          )}
          {can('sales.invoice.write') && (
            <UbActionLink href={newBill} variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} data-testid="site-new-bill">
              {t('sales.site.newBill')}
            </UbActionLink>
          )}
        </UbBox>
        <UbText variant="body-sm" className="font-semibold">{t('sales.site.billsHere')}</UbText>
        <UbCard>
          <UbStack gap={3} data-testid="site-bills">
            {site.bill_rows.length === 0 && <UbText tone="secondary">{t('sales.site.noBills')}</UbText>}
            {site.bill_rows.map((bill) => (
              <UbActionLink key={bill.id} href={`${ROUTES.SALES_INVOICES}/${bill.id}`} variant="ghost" className="h-auto w-full py-1 text-left [&>*]:w-full" data-testid="site-bill">
                <UbStack direction="row" gap={2} className="w-full items-center justify-between">
                <UbStack gap={0} className="min-w-0">
                  <UbText variant="body-sm" className="font-semibold">{bill.number}</UbText>
                  <UbText variant="caption" tone="secondary">{formatBusinessDate(bill.date)}</UbText>
                </UbStack>
                <UbStack gap={0} className="items-end">
                  <UbText variant="body-sm" className="font-semibold">{formatInr(Number(bill.due) > 0 ? bill.due : bill.total)}</UbText>
                  <UbStatusBadge
                    tone={Number(bill.due) > 0 ? 'warning' : 'success'}
                    label={t(Number(bill.due) > 0 ? 'sales.site.notPaid' : 'sales.site.paid')}
                  />
                </UbStack>
                </UbStack>
              </UbActionLink>
            ))}
          </UbStack>
        </UbCard>
      </UbStack>
    </UbPageShell>
  );
}
