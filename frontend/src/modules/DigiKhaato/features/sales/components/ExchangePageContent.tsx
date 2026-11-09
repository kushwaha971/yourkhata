'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { X } from 'lucide-react';

import {
  UbAsyncCombobox,
  UbBox,
  UbButton,
  UbCard,
  UbCheckbox,
  UbPageHeader,
  UbPageShell,
  UbQuantityInput,
  UbSkeleton,
  UbStack,
  UbText,
  UbTotalDock,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { ROUTES } from 'src/routes';
import { formatInr } from 'src/utils/money';
import { comboPaging } from 'src/utils/searchPaging';

import { useItemSearch } from '../../inventory/hooks/useItemSearch';
import {
  makeExchange,
  previewExchange,
  type ExchangeFigures,
  type ExchangeRequest,
} from '../api/exchangeService';
import { getInvoice } from '../api/salesService';

import type { ItemListRow } from '../../inventory/types/item.types';
import type { SalesDocument } from '../types/sales.types';

interface OutLine {
  readonly itemId: string;
  readonly name: string;
  readonly qty: number;
}

const PREVIEW_WAIT_MS = 250;

/**
 * G6 (design `pExchange`, `dExchange`) — tick what comes back from the old bill,
 * scan what goes out, pay the difference. The figures are the server's, from the
 * same code Done runs, and Done makes the credit note and the bill together.
 */
export function ExchangePageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const dispatch = useAppDispatch();
  const against = useSearchParams().get('against') ?? '';
  const [bill, setBill] = useState<SalesDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Line id → how many come back; a bill for two shirts may return one.
  const [ticked, setTicked] = useState<ReadonlyMap<string, string>>(new Map());
  const [out, setOut] = useState<readonly OutLine[]>([]);
  const [seen, setSeen] = useState<{ for: ExchangeRequest; figures: ExchangeFigures } | null>(null);
  const [busy, setBusy] = useState(false);
  const search = useItemSearch({});
  const key = useRef<{ body: string; value: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getInvoice(against, controller.signal)
      .then((envelope) => {
        setBill(envelope.document);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [against, attempt]);

  const open = useMemo(
    () =>
      (bill?.lines ?? [])
        .map((line) => ({ line, left: Number(line.qty) - Number(line.returnedQty) }))
        .filter((row) => row.line.id && row.left > 0),
    [bill]
  );
  const request = useMemo<ExchangeRequest | null>(() => {
    if (!ticked.size || !out.length) return null;
    return {
      against_id: against,
      returns: open
        .filter((row) => ticked.has(row.line.id as string))
        .map((row) => ({ against_line_id: row.line.id as string, qty: ticked.get(row.line.id as string) ?? '1' })),
      lines: out.map((line) => ({ item_id: line.itemId, qty: String(line.qty) })),
    };
  }, [against, open, out, ticked]);

  useEffect(() => {
    if (!request) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      previewExchange(request, controller.signal)
        .then((next) => setSeen({ for: request, figures: next }))
        .catch(() => undefined);
    }, PREVIEW_WAIT_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [request]);

  // Figures for an earlier choice are never shown against this one.
  const figures = seen && seen.for === request ? seen.figures : null;

  const addItem = useCallback((row: ItemListRow) => {
    setOut((lines) =>
      lines.some((line) => line.itemId === row.id)
        ? lines.map((line) => (line.itemId === row.id ? { ...line, qty: line.qty + 1 } : line))
        : [...lines, { itemId: row.id, name: row.name, qty: 1 }]
    );
    search.setQuery('');
  }, [search]);

  const done = useCallback(async () => {
    if (!request || busy) return;
    const body = JSON.stringify(request);
    if (key.current?.body !== body) key.current = { body, value: crypto.randomUUID() };
    setBusy(true);
    try {
      const made = await makeExchange(request, key.current.value);
      dispatch(
        showSnackbar({
          severity: 'success',
          id: 'sales.exchange.made',
          params: { note: made.credit_note.number, bill: made.invoice.number },
        })
      );
      router.push(`${ROUTES.SALES_INVOICES}/${made.invoice.id}`);
    } catch {
      setBusy(false); // the global snackbar has said why
    }
  }, [busy, dispatch, request, router]);

  if (failed) {
    return (
      <UbPageShell>
        <UbStack gap={3} className="items-start">
          <UbText>{t('sales.exchange.failed')}</UbText>
          <UbButton onClick={() => setAttempt((n) => n + 1)}>{t('sales.exchange.retry')}</UbButton>
        </UbStack>
      </UbPageShell>
    );
  }
  if (!bill) {
    return (
      <UbPageShell>
        <UbSkeleton className="h-64 w-full" />
      </UbPageShell>
    );
  }

  const toPay = figures?.to_pay ?? '0';
  const creditLeft = figures?.credit_left ?? '0';
  return (
    <UbPageShell>
      <UbPageHeader
        title={t('sales.exchange.title')}
        subtitle={t('sales.exchange.against', {
          number: bill.number ?? '',
          name: bill.partySnapshot?.name ?? bill.party?.name ?? '',
        })}
      />
      <UbBox className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <UbStack gap={4}>
          <UbStack gap={2}>
            <UbText variant="body-sm" className="font-semibold">
              {t('sales.exchange.back')} · {t('sales.exchange.backHint')}
            </UbText>
            <UbCard>
              <UbStack gap={2} data-testid="exchange-back">
                {open.length === 0 && <UbText tone="secondary">{t('sales.exchange.noneLeft')}</UbText>}
                {open.map(({ line, left }) => (
                  <UbStack key={line.id} direction="row" gap={2} className="items-center justify-between">
                    <UbCheckbox
                      checked={ticked.has(line.id as string)}
                      onChange={(on) =>
                        setTicked((now) => {
                          const next = new Map(now);
                          if (on) next.set(line.id as string, '1');
                          else next.delete(line.id as string);
                          return next;
                        })
                      }
                      label={`${line.description} × ${left}`}
                    />
                    {left > 1 && ticked.has(line.id as string) && (
                      <UbQuantityInput
                        aria-label={t('sales.exchange.howMany', { name: line.description })}
                        className="w-20 shrink-0"
                        decimals={0}
                        value={ticked.get(line.id as string)}
                        onChange={(value) =>
                          setTicked((now) => {
                            const next = new Map(now);
                            next.set(line.id as string, String(Math.min(left, Math.max(1, Number(value) || 1))));
                            return next;
                          })
                        }
                      />
                    )}
                  </UbStack>
                ))}
              </UbStack>
            </UbCard>
          </UbStack>
          <UbStack gap={2}>
            <UbText variant="body-sm" className="font-semibold">{t('sales.exchange.out')}</UbText>
            <UbCard>
              <UbStack gap={3}>
                <UbAsyncCombobox
                  id="exchange-scan"
                  aria-label={t('sales.exchange.scan')}
                  placeholder={t('sales.exchange.scan')}
                  value={null}
                  query={search.query}
                  onQueryChange={search.setQuery}
                  onOpen={search.activate}
                  paging={comboPaging(search, t)}
                  options={search.options}
                  loading={search.status === 'loading'}
                  pending={search.pending}
                  onSelect={(option) => {
                    const row = search.find(option.value);
                    if (row) addItem(row);
                  }}
                  onSubmitQuery={(code) => {
                    void search.lookup(code).then((row) => {
                      if (row) addItem(row);
                      else
                        dispatch(
                          showSnackbar({ severity: 'warning', id: 'items.scan.notFound', params: { code } })
                        );
                    });
                  }}
                />
                {out.length === 0 && <UbText tone="secondary">{t('sales.exchange.empty')}</UbText>}
                {out.map((line) => (
                  <UbStack key={line.itemId} direction="row" gap={2} className="items-center justify-between" data-testid="exchange-out-line">
                    <UbText className="min-w-0 break-words">
                      {line.name} × {line.qty}
                    </UbText>
                    <UbButton
                      variant="ghost"
                      iconOnly
                      icon={<X className="h-4 w-4" aria-hidden />}
                      onClick={() => setOut((lines) => lines.filter((one) => one.itemId !== line.itemId))}
                    >
                      {t('sales.exchange.remove', { name: line.name })}
                    </UbButton>
                  </UbStack>
                ))}
              </UbStack>
            </UbCard>
          </UbStack>
        </UbStack>
        <UbCard>
          <UbStack gap={2} data-testid="exchange-totals">
            <UbStack direction="row" className="justify-between">
              <UbText>{t('sales.exchange.goesOut')}</UbText>
              <UbText variant="body-sm" className="font-semibold">{figures ? formatInr(figures.goes_out) : '—'}</UbText>
            </UbStack>
            <UbStack direction="row" className="justify-between">
              <UbText>{t('sales.exchange.comesBack')}</UbText>
              <UbText>{figures ? `− ${formatInr(figures.comes_back)}` : '—'}</UbText>
            </UbStack>
            <UbText variant="caption" tone="secondary">
              {Number(creditLeft) > 0
                ? t('sales.exchange.creditLeft', { amount: formatInr(creditLeft) })
                : t('sales.exchange.rule')}
            </UbText>
            <UbText variant="caption" tone="secondary">
              {t('sales.exchange.stockNote')}
            </UbText>
          </UbStack>
        </UbCard>
      </UbBox>
      <UbTotalDock
        data-testid="exchange-dock"
        className="mt-auto"
        totalLabel={figures && Number(toPay) === 0 ? t('sales.exchange.nothing') : t('sales.exchange.toPay')}
        total={formatInr(toPay)}
      >
        <UbButton
          variant="secondary"
          onClick={() => router.push(`${ROUTES.SALES_INVOICES}/${against}`)}
        >
          {t('sales.exchange.cancel')}
        </UbButton>
        <UbButton onClick={() => void done()} busy={busy} disabled={!figures} data-testid="exchange-done">
          {t('sales.exchange.done')}
        </UbButton>
      </UbTotalDock>
    </UbPageShell>
  );
}
