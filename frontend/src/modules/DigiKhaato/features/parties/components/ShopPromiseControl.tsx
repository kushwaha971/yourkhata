'use client';

import { useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import {
  UbBox,
  UbButton,
  UbDisclosure,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import { todayInTenantTz } from 'src/utils/dates';

import { useShopPromises } from '../hooks/useShopPromises';
import { promiseHistoryLine, promiseLate, promiseLine } from '../view-model/shopPromiseDisplay';
import { PROMISE_DATE_FORMAT, PROMISE_HISTORY_DATE_FORMAT } from '../view-model/shopPromiseFacts';

import type { ShopPromiseRole } from '../types/shopPromise.types';

/* The form, its schema and the resolver load when the drawer opens: the
   page is opened to read a balance far more often than to take a promise. */
const ShopPromiseDrawerLazy = dynamic(
  () => import('./ShopPromiseDrawer').then((m) => m.ShopPromiseDrawer),
  { ssr: false }
);

/**
 * BP-16 (R-DEC-26) — "they said they'll pay Friday", on the Shop's person page.
 *
 * Its own record, one per contact AND role: a person who is both customer
 * and supplier has a promise to the shop and a promise from it, and neither is
 * the Udhaar book's collection date (DEC-019), which this page no longer shows.
 *
 * Always visible rather than folded away: a promise that is late is the one
 * thing on this page the shopkeeper should not have to open something to see.
 * "Promise kept" closes the promise only; it records no money, and the
 * snackbar says to record the payment, because a partial payment is still a
 * payment and the shop's figures come from payments and bills, never from
 * a promise.
 */
export function ShopPromiseControl({
  partyId,
  role,
  canWrite,
}: Readonly<{ partyId: string; role: ShopPromiseRole; canWrite: boolean }>): React.JSX.Element {
  const { t, d } = useTranslation();
  const timezone = useAppSelector(selectTenantTimezone) ?? undefined;
  const today = useMemo(() => todayInTenantTz(timezone), [timezone]);
  const day = (iso: string) => d(iso, PROMISE_DATE_FORMAT);
  const { load, reload, saved, close, closing } = useShopPromises(partyId, role);
  const [drawer, setDrawer] = useState<'add' | 'change' | null>(null);
  const open = load.status === 'ready' ? load.open : null;
  const late = open ? promiseLate(t, open) : null;

  return (
    <UbStack
      as="section"
      gap={2}
      aria-label={t(`parties.shopPromise.title.${role}`)}
      className="w-full rounded-card border border-border-hairline px-4 py-3 sm:max-w-sm"
      data-testid="shop-promise"
    >
      <UbText as="h2" variant="body-sm-medium">
        {t(`parties.shopPromise.title.${role}`)}
      </UbText>

      {load.status === 'loading' && <UbSkeleton className="h-5 w-40" />}

      {load.status === 'failed' && (
        <UbStack direction="row" align="center" className="flex-wrap gap-x-3 gap-y-1">
          <UbText variant="body-sm" tone="secondary">
            {t('parties.shopPromise.loadFailed')}
          </UbText>
          <UbButton size="sm" variant="outlineNeutral" onClick={reload}>
            {t('parties.shopPromise.retry')}
          </UbButton>
        </UbStack>
      )}

      {load.status === 'ready' && open && (
        <UbStack gap={1} data-testid="shop-promise-open">
          <UbText variant="body" className="ds-num font-semibold" data-testid="shop-promise-line">
            {promiseLine(t, open, today, day)}
          </UbText>
          {late && (
            <UbStatusBadge tone="warning" label={late} className="self-start" />
          )}
          {open.note && (
            <UbText variant="caption" tone="secondary" className="break-words">
              {open.note}
            </UbText>
          )}
        </UbStack>
      )}

      {load.status === 'ready' && !open && (
        <UbText variant="body-sm" tone="secondary" data-testid="shop-promise-none">
          {t('parties.shopPromise.none')}
        </UbText>
      )}

      {load.status === 'ready' && canWrite && (
        <UbStack direction="row" className="flex-wrap gap-2 pt-1">
          {open ? (
            <>
              <UbButton
                size="sm"
                variant="secondary"
                onClick={() => void close('kept')}
                busy={closing === 'kept'}
                disabled={closing !== null}
                data-testid="shop-promise-kept"
              >
                {t('parties.shopPromise.kept')}
              </UbButton>
              <UbButton
                size="sm"
                variant="outlineNeutral"
                onClick={() => setDrawer('change')}
                disabled={closing !== null}
                data-testid="shop-promise-change"
              >
                {t('parties.shopPromise.change')}
              </UbButton>
              <UbButton
                size="sm"
                variant="ghost"
                onClick={() => void close('cancel')}
                busy={closing === 'cancel'}
                disabled={closing !== null}
                data-testid="shop-promise-cancel"
              >
                {t('parties.shopPromise.cancel')}
              </UbButton>
            </>
          ) : (
            <UbButton
              size="sm"
              variant="secondary"
              onClick={() => setDrawer('add')}
              data-testid="shop-promise-add"
            >
              {t('parties.shopPromise.add')}
            </UbButton>
          )}
        </UbStack>
      )}

      {load.status === 'ready' && load.history.length > 0 && (
        <UbDisclosure
          label={t('parties.shopPromise.history')}
          className="mt-1 border-0 [&>button]:min-h-11 [&>button]:px-0"
        >
          <UbStack as="ul" gap={2} data-testid="shop-promise-history">
            {load.history.map((row) => (
              <UbBox as="li" key={row.id} className="min-w-0">
                <UbBox className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <UbText variant="body-sm" className="ds-num">
                    {promiseHistoryLine(t, row, (iso) => d(iso, PROMISE_HISTORY_DATE_FORMAT))}
                  </UbText>
                  <UbText
                    variant="caption"
                    tone={row.state === 'kept' ? 'success' : 'secondary'}
                    className="font-semibold"
                  >
                    {t(`parties.shopPromise.state.${row.state}`)}
                  </UbText>
                </UbBox>
                {(row.closedBy || row.note) && (
                  <UbText variant="caption" tone="secondary" className="break-words">
                    {[row.closedBy ? t('parties.shopPromise.by', { name: row.closedBy }) : '', row.note]
                      .filter(Boolean)
                      .join(' · ')}
                  </UbText>
                )}
              </UbBox>
            ))}
          </UbStack>
        </UbDisclosure>
      )}

      {drawer && (
        <ShopPromiseDrawerLazy
          partyId={partyId}
          role={role}
          today={today}
          editing={drawer === 'change' ? open : null}
          onClose={() => setDrawer(null)}
          onSaved={saved}
          onConflict={() => {
            setDrawer(null);
            reload();
          }}
        />
      )}
    </UbStack>
  );
}
