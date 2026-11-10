'use client';

import { UbActionLink, UbBox, UbCard, UbStack, UbStatusBadge, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { formatInr } from 'src/utils/money';

import 'src/i18n/catalogues/sales';

import type { DashboardSectionProps } from '../../reports/dashboardSections';

interface Row {
  readonly id: string;
  readonly number: string;
  readonly party: { readonly name: string } | null;
  readonly ready_at: string | null;
  readonly status: string;
  readonly balance: string;
  readonly lines: readonly { readonly name: string; readonly qty: string }[];
}

/**
 * G10 — Home's block (design pAdvance: "Shows on Home the day before"):
 * advance orders to be ready today or tomorrow, so the kitchen starts in time.
 * Draws nothing when there are none, which is every business but a café's.
 */
export function AdvanceOrdersSection({ data }: DashboardSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const orders = ((data as { orders?: Row[] } | null)?.orders ?? []).filter((o) => o.ready_at);
  if (orders.length === 0) return null;
  return (
    <UbBox data-testid="home-advance-orders">
      <UbCard padded>
        <UbStack gap={3}>
          <UbStack direction="row" gap={2} className="items-center justify-between">
            <UbText as="h2" variant="h3">
              {t('sales.cafe.home.title')}
            </UbText>
            <UbActionLink href={ROUTES.SALES_OPEN_ORDERS} variant="ghost" size="sm">
              {t('sales.cafe.home.open')}
            </UbActionLink>
          </UbStack>
          {orders.map((o) => {
            const at = new Date(o.ready_at ?? '');
            return (
              <UbStack
                key={o.id}
                gap={0.5}
                className="border-b border-border pb-2 last:border-b-0 last:pb-0"
              >
                <UbStack direction="row" gap={2} className="items-center justify-between">
                  <UbText variant="body-sm" className="font-semibold">
                    {t('sales.cafe.home.item', {
                      number: o.number,
                      who: o.party?.name ?? '',
                      when: at.toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      }),
                    })}
                  </UbText>
                  <UbStatusBadge
                    tone={o.status === 'ready' ? 'success' : 'warning'}
                    label={t(`sales.cafe.status.${o.status}`)}
                  />
                </UbStack>
                <UbText variant="caption" tone="secondary">
                  {o.lines.map((l) => `${l.name} × ${l.qty}`).join(', ')} ·{' '}
                  {t('sales.cafe.home.balance', { amount: formatInr(o.balance) })}
                </UbText>
              </UbStack>
            );
          })}
        </UbStack>
      </UbCard>
    </UbBox>
  );
}
