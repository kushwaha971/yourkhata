'use client';

import { useEffect, useState } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';
import { formatInr } from 'src/utils/money';

import {
  getTodayRates,
  PURITIES,
  type TodayRates,
} from 'modules/DigiKhaato/features/inventory/api/metalRateService';
import {
  listCustomOrders,
  type CustomOrder,
} from 'modules/DigiKhaato/features/sales/api/customOrderService';
import { useKindMessage } from 'modules/DigiKhaato/features/settings/hooks/useKindMessage';

// Loaded with the sheet, so these words come with its chunk.
import 'src/i18n/catalogues/sales';
import 'src/i18n/catalogues/settings';
import 'src/i18n/catalogues/stock';

export interface ReminderChoice {
  readonly key: string;
  readonly label: string;
  /** Absent for the payment reminder, whose words are the server's preview. */
  readonly text?: string;
}

const RATE_NAMES = {
  gold_24k: 'stock.rates.gold24',
  gold_22k: 'stock.rates.gold22',
  gold_18k: 'stock.rates.gold18',
  silver: 'stock.rates.silver',
} as const;

/**
 * D15 `pRemind` — the other messages a jeweller can send a customer from the
 * sheet. Each is offered only when its facts exist: "Custom order ready" needs
 * this customer's order that is really ready, "Today's rate" a rate typed
 * today. Nothing is invented, and a business without these features makes no
 * request at all.
 */
export const useReminderChoices = (
  open: boolean,
  party: { readonly id: string; readonly name: string }
): readonly ReminderChoice[] => {
  const { t } = useTranslation();
  const tenant = useAppSelector(selectActiveTenant);
  const jeweller = Boolean(tenant?.features?.includes('jewellery'));
  const readyMessage = useKindMessage('order_ready');
  const rateMessage = useKindMessage('todays_rate');
  const [order, setOrder] = useState<CustomOrder | null>(null);
  const [rates, setRates] = useState<TodayRates | null>(null);

  useEffect(() => {
    if (!open || !jeweller || !party.id || !party.name) return;
    const control = new AbortController();
    void listCustomOrders({ q: party.name, scope: 'open', karigar: '' }, control.signal)
      .then((list) =>
        setOrder(
          list.rows.find((row) => row.party.id === party.id && row.status === 'ready') ?? null
        )
      )
      .catch(() => setOrder(null));
    void getTodayRates(control.signal)
      .then(setRates)
      .catch(() => setRates(null));
    return () => control.abort();
  }, [open, jeweller, party.id, party.name]);

  if (!jeweller || !party.name) return [];
  const shop = tenant?.name ?? '';
  const choices: ReminderChoice[] = [
    { key: 'payment', label: t('settings.messages.payment_reminder') },
  ];
  if (order)
    choices.push({
      key: 'order_ready',
      label: t('settings.messages.order_ready'),
      text: readyMessage(
        order.fixedRate
          ? 'sales.customOrder.readyMessage'
          : 'sales.customOrder.readyMessageTodayRate',
        { name: party.name, what: order.what, number: order.number, shop }
      ),
    });
  const today = rates?.today?.rates;
  const lines = today
    ? PURITIES.filter((p) => today[p]).map(
        (p) => `${t(RATE_NAMES[p])} ${formatInr(String(today[p]))} / g`
      )
    : [];
  if (lines.length)
    choices.push({
      key: 'todays_rate',
      label: t('settings.messages.todays_rate'),
      text: rateMessage('stock.rates.shareText', { shop, rates: lines.join(' · ') }),
    });
  return choices;
};
