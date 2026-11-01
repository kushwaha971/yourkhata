'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ArrowLeft } from 'lucide-react';

import {
  UbBottomBar,
  UbBox,
  UbButton,
  UbCard,
  UbDataGrid,
  UbLink,
  UbMoneyInput,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbSelect,
  UbStack,
  UbText,
  useGridTier,
  type UbDataGridColumn,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { ROUTES } from 'src/routes';

import {
  getRateHistory,
  getTodayRates,
  PURITIES,
  saveTodayRates,
  type DayRate,
  type Purity,
  type RateFigures,
  type TodayRates,
} from '../api/metalRateService';
import { inventoryGridLabels } from '../view-model/gridLabels';
import { ITEM_SELECT_IDS } from '../view-model/itemGridIds';

/**
 * G1 — Today's rate (design §G1, `M.pRate` / `M.dRate`). Typed once each
 * morning; every bill that day uses it and keeps it. No rate feed (ADR-021):
 * the owner copies the association board, or taps Same as yesterday, which
 * fills the boxes and saves nothing until Save rates.
 */

type Draft = Record<Purity, string>;

const EMPTY: Draft = { gold_24k: '', gold_22k: '', gold_18k: '', silver: '' };

/** The design prints whole rupees ("₹11,650"); paise only when there are some. */
const rupees = (value: string | null | undefined): string => {
  if (!value) return '—';
  const n = Number(value);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const toDraft = (rates: RateFigures | undefined): Draft =>
  rates
    ? (Object.fromEntries(
        PURITIES.map((p) => [p, rates[p] ? String(Number(rates[p])) : ''])
      ) as Draft)
    : EMPTY;

/** "Thu 30 Oct" / "Thursday 30 Oct" as the design writes it: no comma. */
const dayLabel = (iso: string, locale: string, long: boolean): string =>
  new Date(`${iso}T00:00:00`)
    .toLocaleDateString(locale.startsWith('hi') ? 'hi-IN' : 'en-IN', {
      weekday: long ? 'long' : 'short',
      day: 'numeric',
      month: 'short',
    })
    .replace(',', '');

const timeLabel = (iso: string, locale: string): string =>
  new Date(iso)
    .toLocaleTimeString(locale.startsWith('hi') ? 'hi-IN' : 'en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    })
    .toLowerCase();

/** A refusal per box, in the person's words, before anything is sent. */
const checkDraft = (draft: Draft, t: TranslateFn): Partial<Record<Purity, string>> => {
  const errors: Partial<Record<Purity, string>> = {};
  for (const p of PURITIES) {
    const raw = draft[p].trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) errors[p] = t('stock.rates.errorPositive');
    else if (/\.\d{3,}$/.test(raw)) errors[p] = t('stock.rates.errorDecimals');
  }
  if (Object.keys(errors).length === 0 && PURITIES.every((p) => !draft[p].trim())) {
    errors.gold_22k = t('stock.rates.errorNone');
  }
  return errors;
};

/**
 * "Sends a picture of the rate board to WhatsApp" — drawn on a canvas (no
 * library) and handed to the phone's share sheet. Where a picture cannot be
 * shared (most desktops), WhatsApp opens with the rates as text instead.
 */
const shareBoard = async (
  shop: string,
  day: string,
  lines: readonly (readonly [string, string])[]
): Promise<void> => {
  const text = [shop, day, ...lines.map(([name, rate]) => `${name}: ${rate}`)].join('\n');
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 220 + lines.length * 72;
  const g = canvas.getContext('2d');
  if (g && typeof navigator.canShare === 'function') {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#0f766e';
    g.fillRect(0, 0, canvas.width, 120);
    g.fillStyle = '#ffffff';
    g.font = '700 40px "Plus Jakarta Sans", sans-serif';
    g.fillText(shop, 40, 64);
    g.font = '500 26px "Plus Jakarta Sans", sans-serif';
    g.fillText(day, 40, 102);
    lines.forEach(([name, rate], n) => {
      const y = 190 + n * 72;
      g.fillStyle = '#1f2937';
      g.font = '600 30px "Plus Jakarta Sans", sans-serif';
      g.fillText(name, 40, y);
      g.textAlign = 'right';
      g.font = '700 34px "Plus Jakarta Sans", sans-serif';
      g.fillText(rate, canvas.width - 40, y);
      g.textAlign = 'left';
    });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = blob ? new File([blob], 'todays-rate.png', { type: 'image/png' }) : null;
    if (file && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
};

const historyColumns = (t: TranslateFn, locale: string): UbDataGridColumn<DayRate>[] => [
  {
    id: 'date',
    widthShare: 1,
    header: t('stock.rates.col.date'),
    priority: 1,
    cardSlot: 'title',
    cell: (r) => dayLabel(r.day, locale, false).replace(/^\S+\s/, ''),
  },
  {
    id: 'k22',
    widthShare: 1,
    header: '22K',
    priority: 1,
    align: 'end',
    cardSlot: 'meta',
    cell: (r) => rupees(r.rates.gold_22k),
  },
  {
    id: 'k24',
    widthShare: 1,
    header: '24K',
    priority: 1,
    align: 'end',
    cardSlot: 'none',
    cell: (r) => rupees(r.rates.gold_24k),
  },
  {
    id: 'silver',
    widthShare: 1,
    header: t('stock.rates.col.silver'),
    priority: 1,
    align: 'end',
    cardSlot: 'none',
    cell: (r) => rupees(r.rates.silver),
  },
  {
    id: 'by',
    widthShare: 2,
    header: t('stock.rates.col.setBy'),
    priority: 1,
    cardSlot: 'trailing',
    cell: (r) => `${r.setBy}, ${timeLabel(r.setAt, locale)}`,
  },
];

/** The twelve months up to today's, newest first, as `YYYY-MM` with a name. */
const monthOptions = (today: string, locale: string): { value: string; label: string }[] => {
  const [y, m] = today.split('-').map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, n) => {
    const d = new Date(y, m - 1 - n, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(locale.startsWith('hi') ? 'hi-IN' : 'en-IN', {
        month: 'long',
        year: 'numeric',
      }),
    };
  });
};

export function RatesPageContent(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const dispatch = useAppDispatch();
  const desk = useGridTier() !== 'cards';
  const { can } = usePermissions();
  const canSet = can('inventory.item.write');
  const shop = useAppSelector(selectActiveTenant)?.name ?? '';
  const [data, setData] = useState<TodayRates | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Purity, string>>>({});
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<readonly DayRate[] | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    void getTodayRates(signal)
      .then((next) => {
        setData(next);
        setDraft(toDraft(next.today?.rates));
      })
      .catch((error: Error) => {
        if (error.name !== 'CanceledError') setFailed(true);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Design "Rate history · Month: October": this month unless another is picked.
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const month = pickedMonth ?? data?.day.slice(0, 7);
  useEffect(() => {
    if (!desk || !month) return undefined;
    const controller = new AbortController();
    void getRateHistory(month, controller.signal)
      .then((next) => setHistory(next.rows))
      .catch(() => setHistory([]));
    return () => controller.abort();
  }, [desk, month, data?.today?.setAt]);

  const names: Record<Purity, string> = {
    gold_24k: t('stock.rates.gold24'),
    gold_22k: t('stock.rates.gold22'),
    gold_18k: t('stock.rates.gold18'),
    silver: t('stock.rates.silver'),
  };

  const save = async () => {
    const found = checkDraft(draft, t);
    setErrors(found);
    if (Object.keys(found).length > 0 || saving) return;
    setSaving(true);
    try {
      const body = Object.fromEntries(
        PURITIES.map((p) => [p, draft[p].trim() || null])
      ) as RateFigures;
      const next = await saveTodayRates(body);
      setData(next);
      setDraft(toDraft(next.today?.rates));
      dispatch(showSnackbar({ severity: 'success', id: 'stock.rates.saved' }));
    } catch {
      // The global snackbar has said why; the boxes keep what was typed.
    } finally {
      setSaving(false);
    }
  };

  const sameAsYesterday = () => {
    setDraft(toDraft(data?.yesterday?.rates));
    setErrors({});
  };

  const share = () => {
    if (!data) return;
    const lines = PURITIES.filter((p) => draft[p].trim()).map(
      (p) => [names[p], `${rupees(draft[p])} / g`] as const
    );
    void shareBoard(shop, dayLabel(data.day, locale, true), lines);
  };

  /** "Yesterday ₹X" (phone) or "Up/Down ₹X from yesterday" (desktop). */
  const yesterdayLine = (p: Purity): string | null => {
    const before = data?.yesterday?.rates[p];
    if (!before) return null;
    if (!desk) return t('stock.rates.yesterday', { amount: rupees(before) });
    const now = draft[p].trim() ? Number(draft[p]) : null;
    if (now === null || !Number.isFinite(now))
      return t('stock.rates.yesterday', { amount: rupees(before) });
    const diff = Math.round((now - Number(before)) * 100) / 100;
    if (diff === 0) return t('stock.rates.same');
    return t(diff > 0 ? 'stock.rates.up' : 'stock.rates.down', {
      amount: rupees(String(Math.abs(diff))),
    });
  };

  const rows = PURITIES.map((p) => (
    <UbBox
      key={p}
      className={
        desk
          ? 'grid grid-cols-[1fr_150px] items-center gap-3'
          : 'flex min-h-[56px] items-center justify-between gap-3 border-b border-border-hairline px-4 py-3 last:border-b-0'
      }
      data-testid={`rate-row-${p}`}
    >
      <UbStack gap={0.5} className="min-w-0">
        <UbText as="span" variant="body-sm-medium">
          {names[p]}
        </UbText>
        {yesterdayLine(p) && (
          <UbText as="span" variant="caption" tone="secondary" data-testid={`rate-yesterday-${p}`}>
            {yesterdayLine(p)}
          </UbText>
        )}
        {errors[p] && (
          <UbText as="span" variant="caption" tone="error" role="alert">
            {errors[p]}
          </UbText>
        )}
      </UbStack>
      <UbMoneyInput
        value={draft[p]}
        onChange={(value) => setDraft((d) => ({ ...d, [p]: value }))}
        // Whole rupees as the design prints them; paise shown only when there are
        // some (leaving the box pads to "12710.00", which must still read 12,710).
        // Design: "₹ 12,710 / g" on a desktop, "₹ 12,710" on a phone.
        unit={desk ? '/ g' : ''}
        decimalPlaces={/\.\d*[1-9]/.test(draft[p]) ? 2 : 0}
        maxDecimalPlaces={2}
        invalid={Boolean(errors[p])}
        disabled={!canSet || !data}
        aria-label={names[p]}
        placeholder={t('stock.rates.placeholder')}
        className={desk ? 'shrink-0' : 'h-10 w-[130px] shrink-0'}
        data-testid={`rate-input-${p}`}
      />
    </UbBox>
  ));

  const shareButton = (
    <UbButton
      variant="outlineNeutral"
      size={desk ? undefined : 'sm'}
      onClick={share}
      disabled={!data}
      data-testid="rate-share"
    >
      {t('stock.rates.share')}
    </UbButton>
  );
  const sameButton = (
    <UbButton
      variant="secondary"
      size={desk ? undefined : 'lg'}
      onClick={sameAsYesterday}
      disabled={!canSet || !data?.yesterday}
      className={desk ? undefined : 'min-w-0 flex-1 max-[359px]:px-2 max-[359px]:text-sm'}
      data-testid="rate-same"
    >
      {t('stock.rates.sameAsYesterday')}
    </UbButton>
  );
  const saveButton = (
    <UbButton
      size={desk ? undefined : 'lg'}
      onClick={() => void save()}
      busy={saving}
      busyLabel={t('stock.rates.saving')}
      disabled={!canSet || !data}
      className={desk ? undefined : 'min-w-0 flex-1 max-[359px]:px-2 max-[359px]:text-sm'}
      data-testid="rate-save"
    >
      {t('stock.rates.save')}
    </UbButton>
  );

  const subtitle = data
    ? t(desk ? 'stock.rates.subtitleDesk' : 'stock.rates.subtitle', {
        day: dayLabel(data.day, locale, desk),
      })
    : undefined;

  const setLine = data?.today
    ? t('stock.rates.setAt', { time: timeLabel(data.today.setAt, locale), name: data.today.setBy })
    : t('stock.rates.notSet');

  const labels = useMemo(
    () =>
      inventoryGridLabels(t, {
        loading: 'stock.rates.loading',
        open: 'stock.rates.history',
        ...ITEM_SELECT_IDS,
      }),
    [t]
  );
  const columns = useMemo(() => historyColumns(t, locale), [t, locale]);

  if (failed) {
    return (
      <UbPageShell>
        <UbPageHeader title={t('stock.rates.title')} />
        <UbCard className="grid gap-3 p-4" data-testid="rate-error">
          <UbText as="p" variant="body-sm">
            {t('stock.rates.loadFailed')}
          </UbText>
          <UbButton
            variant="secondary"
            onClick={() => {
              setFailed(false);
              load();
            }}
            className="justify-self-start"
          >
            {t('stock.rates.retry')}
          </UbButton>
        </UbCard>
      </UbPageShell>
    );
  }

  return (
    <UbPageShell>
      {desk ? (
        <UbPageHeader
          title={t('stock.rates.title')}
          subtitle={subtitle}
          primaryActions={
            <UbStack direction="row" gap={2}>
              {shareButton}
              {sameButton}
              {saveButton}
            </UbStack>
          }
        />
      ) : (
        // Design pRate: Back beside the title. The page opens from More on a
        // phone, so Back goes there (the Money book person page's pattern).
        <UbStack direction="row" align="start" gap={2}>
          <UbLink
            href={ROUTES.MORE}
            aria-label={t('stock.rates.back')}
            title={t('stock.rates.back')}
            underline={false}
            tone="secondary"
            data-testid="rate-back"
            className="-ml-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-control active:bg-surface-active"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </UbLink>
          <UbPageHeader
            className="min-w-0 flex-1"
            title={t('stock.rates.title')}
            subtitle={subtitle}
          />
        </UbStack>
      )}
      {desk ? (
        <UbBox
          className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[420px_minmax(0,1fr)] [&>*:first-child]:max-xl:w-[420px]"
          data-testid="rate-screen"
        >
          <UbPanel className="grid gap-3.5 p-4" aria-busy={!data}>
            <UbBox className="grid gap-3.5">{rows}</UbBox>
            <UbText as="p" variant="caption" tone="secondary" data-testid="rate-set-line">
              {setLine} {t('stock.rates.keeps')}
            </UbText>
          </UbPanel>
          <UbDataGrid
            rows={history ?? []}
            columns={columns}
            rowId={(r) => r.day}
            rowName={(r) => r.day}
            state={history === null ? 'loading' : history.length === 0 ? 'empty' : 'rows'}
            labels={labels}
            emptyStates={{
              firstUse: {
                title: t('stock.rates.historyEmpty'),
                description: t('stock.rates.historyEmptyBody'),
              },
              filtered: {
                title: t('stock.rates.historyEmpty'),
                description: t('stock.rates.historyEmptyBody'),
              },
              error: { title: '', description: '', requestId: null, requestIdLabel: '' },
            }}
            caption={t('stock.rates.history')}
            toolbar={
              <UbBox className="flex items-center justify-between gap-3 px-4 py-3">
                <UbText as="span" variant="body-sm-medium">
                  {t('stock.rates.history')}
                </UbText>
                {data && (
                  <UbSelect
                    value={month}
                    onChange={setPickedMonth}
                    options={monthOptions(data.day, locale)}
                    aria-label={t('stock.rates.month')}
                    className="w-[180px]"
                    data-testid="rate-month"
                  />
                )}
              </UbBox>
            }
            cardAvatar={false}
            page={{
              page: 1,
              pageSize: Math.max(history?.length ?? 0, 1),
              total: history?.length ?? 0,
              totalPages: 1,
            }}
            onPageChange={() => undefined}
            data-testid="rate-history"
          />
        </UbBox>
      ) : (
        <UbStack gap={3} className="pb-24" data-testid="rate-screen">
          <UbPanel className="p-0" aria-busy={!data}>
            {rows}
          </UbPanel>
          <UbText as="p" variant="caption" tone="secondary">
            {t('stock.rates.note')}
          </UbText>
          <UbPanel className="p-4">
            <UbStack gap={1.5} className="items-start">
              <UbText as="span" variant="body-sm-medium">
                {t('stock.rates.shareTitle')}
              </UbText>
              <UbText as="span" variant="caption" tone="secondary">
                {t('stock.rates.shareBody')}
              </UbText>
              {shareButton}
            </UbStack>
          </UbPanel>
          <UbBottomBar className="grid grid-cols-2 gap-2 border-t border-border-hairline bg-surface-card px-4 py-3">
            {sameButton}
            {saveButton}
          </UbBottomBar>
        </UbStack>
      )}
    </UbPageShell>
  );
}
