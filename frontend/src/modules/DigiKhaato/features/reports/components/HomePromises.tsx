'use client';

import { UbButton, UbLink, UbPanel, UbStack, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { partyPath } from 'src/routes';

import { promiseStillDue } from '../../parties/view-model/shopPromiseFacts';
import { homePromiseCaption, homePromiseTitle } from '../view-model/homePromiseDisplay';

import { PartUnavailable } from './DashboardPanels';

import type { ShopPromise } from '../../parties/types/shopPromise.types';
import type { HomePromises as HomePromisesState } from '../hooks/useHomePromises';

/**
 * BP-16 — Follow-ups' promises: who said they would pay this week, late ones
 * first (Counter Mode rev 3, "Sharma General Store promised ₹1,500 today ·
 * Owes ₹3,100 · 42 days late · Remind").
 *
 * The caption is today's balance in that role, from the server, never the
 * figure promised; when it has reached zero there is no Remind or Pay, only
 * "Nothing due now", so a customer who paid yesterday is not chased today.
 * Nothing is drawn when no promise is due: an empty panel on every shop's
 * Home is noise.
 */
export function HomePromises({
  state,
  today,
  formatDate,
  canRemind,
  canPay,
  onRemind,
  onPay,
  onRetry,
  t,
}: Readonly<{
  state: HomePromisesState;
  today: string;
  formatDate: (iso: string) => string;
  canRemind: boolean;
  canPay: boolean;
  onRemind: (promise: ShopPromise) => void;
  onPay: (promise: ShopPromise) => void;
  onRetry: () => void;
  t: TranslateFn;
}>): React.JSX.Element | null {
  if (state.status !== 'ready')
    return state.status === 'failed' ? (
      <UbPanel as="section" aria-label={t('reports.home.promise.title')}>
        <PartUnavailable onRetry={onRetry} t={t} className="p-4" />
      </UbPanel>
    ) : null;
  if (state.rows.length === 0) return null;
  return (
    <UbPanel as="section" aria-label={t('reports.home.promise.title')} data-testid="home-promises">
      <UbStack gap={0}>
        <UbStack gap={0} className="px-4 pt-4">
          <UbText as="h2" variant="h3">
            {t('reports.home.promise.title')}
          </UbText>
          <UbText variant="caption" tone="secondary">
            {t('reports.home.promise.basis')}
          </UbText>
        </UbStack>
        <UbStack as="ul" gap={0} className="py-1">
          {state.rows.map((promise) => {
            const supplier = promise.role === 'supplier';
            const due = promiseStillDue(promise);
            const act = supplier
              ? canPay && due
              : canRemind && due && Boolean(promise.party.mobile);
            return (
              <UbStack
                key={promise.id}
                as="li"
                direction="row"
                align="center"
                className="gap-3 border-b border-border-hairline px-4 py-3 last:border-b-0"
                data-testid="home-promise-row"
              >
                <UbStack gap={0} className="min-w-0 flex-1">
                  <UbLink
                    href={partyPath(promise.party.id, supplier ? 'supplier' : undefined)}
                    underline={false}
                    variant="body-sm-medium"
                    className="ds-num whitespace-normal break-words"
                  >
                    {homePromiseTitle(t, promise, today, formatDate)}
                  </UbLink>
                  <UbText
                    variant="caption"
                    tone={promise.daysLate ? 'warning' : 'secondary'}
                    className="ds-num"
                  >
                    {homePromiseCaption(t, promise)}
                  </UbText>
                </UbStack>
                {act && (
                  <UbButton
                    variant="outlineNeutral"
                    size="sm"
                    className="shrink-0"
                    onClick={() => (supplier ? onPay(promise) : onRemind(promise))}
                    aria-label={t(supplier ? 'reports.home.promise.pay' : 'reports.home.promise.remind', {
                      name: promise.party.name,
                    })}
                    data-testid="home-promise-act"
                  >
                    {t(supplier ? 'reports.home.pay' : 'reports.home.remind')}
                  </UbButton>
                )}
              </UbStack>
            );
          })}
        </UbStack>
      </UbStack>
    </UbPanel>
  );
}
