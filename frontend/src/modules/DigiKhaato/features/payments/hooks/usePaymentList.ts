'use client';

import { useCallback, useEffect, useMemo } from 'react';

import { useSearchParams } from 'next/navigation';

import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { selectNetworkImpaired } from 'src/redux/slice/networkSlice';
import { selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import type { ApiErrorShape, RequestStatus } from 'src/types/api.types';
import type { PaymentMode } from 'src/types/domain.types';
import { todayInTenantTz } from 'src/utils/dates';

import { resolveExpensePreset } from '../../expenses/view-model/expenseDisplay';
import {
  paymentFiltersChanged,
  selectPaymentError,
  selectPaymentHasAny,
  selectPaymentListStale,
  selectPaymentPage,
  selectPaymentPageSize,
  selectPaymentRows,
  selectPaymentStatus,
  selectPaymentTotal,
  selectPaymentTotals,
} from '../redux/paymentListSlice';
import { fetchPayments } from '../redux/paymentThunk';
import { paymentFiltersFromQuery, paymentQueryFromFilters } from '../view-model/paymentDisplay';

import type { PaymentPreset } from '../constants/paymentConstants';
import type {
  PaymentFilters,
  PaymentListArg,
  PaymentRow,
  PaymentTab,
  PaymentTotals,
} from '../types/payment.types';

/**
 * Part 19 §19.4 — everything the payments list does, so the page only renders.
 * The filters live in the URL (PTY-05's lesson), and every setter but
 * `setPage` returns the merchant to page one.
 */
export interface UsePaymentListResult {
  readonly rows: readonly PaymentRow[];
  readonly totals: PaymentTotals | null;
  readonly hasAny: boolean | null;
  readonly filters: PaymentFilters;
  readonly today: string;
  readonly status: RequestStatus;
  readonly error: ApiErrorShape | null;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly canRead: boolean;
  readonly setPreset: (preset: PaymentPreset) => void;
  readonly setRange: (from: string | null, to: string | null) => void;
  readonly setTab: (tab: PaymentTab) => void;
  readonly setMode: (mode: PaymentMode | null) => void;
  readonly setQuery: (q: string) => void;
  readonly setPage: (page: number) => void;
  /** The phone's Filters sheet: everything but the search in ONE address-bar update. */
  readonly applyFilters: (next: PaymentFilters) => void;
  readonly clearFilters: () => void;
  readonly refetch: () => void;
}

/**
 * 08 §9 C-3 / DEC-019 — `/payments` is the Shop's register, so it asks for the
 * Shop's bucket. Without it the Library's fee receipts and Lending's
 * disbursements were listed and totalled as Shop money (measured on the QA
 * book: 10,492 payments shown, 7,515 of them the Shop's).
 */
const REGISTER_BUCKET = 'shop' as const;

/**
 * `append` is a phone's card list (R-DEC-33): the next page joins the cards
 * already shown instead of replacing them. A desktop table pages by replacement.
 */
export const usePaymentList = (
  listMode: 'replace' | 'append' = 'replace'
): UsePaymentListResult => {
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const search = useSearchParams();
  const { can, hasModule } = usePermissions();
  const timezone = useAppSelector(selectTenantTimezone);
  const isImpaired = useAppSelector(selectNetworkImpaired);

  const rows = useAppSelector(selectPaymentRows);
  const totals = useAppSelector(selectPaymentTotals);
  const status = useAppSelector(selectPaymentStatus);
  const error = useAppSelector(selectPaymentError);
  const page = useAppSelector(selectPaymentPage);
  const pageSize = useAppSelector(selectPaymentPageSize);
  const total = useAppSelector(selectPaymentTotal);
  const stale = useAppSelector(selectPaymentListStale);
  const hasAny = useAppSelector(selectPaymentHasAny);

  const canRead = hasModule('payments') && can('payments.payment.read');
  const today = useMemo(() => todayInTenantTz(timezone ?? undefined), [timezone]);

  /* Keyed on the query STRING — `useSearchParams()` is a new object every
     render, and a memo on it re-dispatches forever (LED-04). */
  const queryString = search?.toString() ?? '';
  const filters = useMemo(
    () => paymentFiltersFromQuery(new URLSearchParams(queryString), today),
    [queryString, today]
  );

  const query = useMemo<PaymentListArg>(
    () => ({ ...filters, bucket: REGISTER_BUCKET, listMode }),
    [filters, listMode]
  );

  useEffect(() => {
    if (!canRead) return undefined;
    dispatch(paymentFiltersChanged(query));
    const promise = dispatch(fetchPayments(query));
    return () => promise.abort();
  }, [dispatch, canRead, query]);

  useEffect(() => {
    if (!stale || isImpaired || !canRead) return undefined;
    const promise = dispatch(fetchPayments(query));
    return () => promise.abort();
  }, [stale, isImpaired, canRead, dispatch, query]);

  const push = useCallback(
    (next: PaymentFilters) => {
      const query = paymentQueryFromFilters(next);
      router.replace(query ? `?${query}` : '?', { scroll: false });
    },
    [router]
  );

  const setPreset = useCallback(
    (preset: PaymentPreset) => {
      const resolved = resolveExpensePreset(preset, today);
      push({
        ...filters,
        preset,
        dateFrom: resolved?.dateFrom ?? filters.dateFrom,
        dateTo: resolved?.dateTo ?? filters.dateTo,
        page: 1,
      });
    },
    [push, filters, today]
  );
  const setRange = useCallback(
    (from: string | null, to: string | null) =>
      push({
        ...filters,
        preset: 'custom',
        dateFrom: from ?? filters.dateFrom,
        dateTo: to ?? filters.dateTo,
        page: 1,
      }),
    [push, filters]
  );
  const setTab = useCallback(
    (tab: PaymentTab) => push({ ...filters, tab, page: 1 }),
    [push, filters]
  );
  const setMode = useCallback(
    (mode: PaymentMode | null) => push({ ...filters, mode, page: 1 }),
    [push, filters]
  );
  const setQuery = useCallback((q: string) => push({ ...filters, q, page: 1 }), [push, filters]);
  const setPage = useCallback((next: number) => push({ ...filters, page: next }), [push, filters]);
  const applyFilters = useCallback(
    (next: PaymentFilters) => {
      const resolved =
        next.preset === 'custom' ? null : resolveExpensePreset(next.preset as PaymentPreset, today);
      push({
        ...next,
        dateFrom: resolved?.dateFrom ?? next.dateFrom,
        dateTo: resolved?.dateTo ?? next.dateTo,
        page: 1,
      });
    },
    [push, today]
  );
  const clearFilters = useCallback(
    () => push({ ...filters, tab: 'all', mode: null, q: '', page: 1 }),
    [push, filters]
  );
  const refetch = useCallback(() => {
    void dispatch(fetchPayments(query));
  }, [dispatch, query]);

  return useMemo(
    () => ({
      rows,
      totals,
      hasAny,
      filters,
      today,
      status,
      error,
      page,
      pageSize,
      total,
      canRead,
      setPreset,
      setRange,
      setTab,
      setMode,
      setQuery,
      setPage,
      applyFilters,
      clearFilters,
      refetch,
    }),
    [
      rows,
      totals,
      hasAny,
      filters,
      today,
      status,
      error,
      page,
      pageSize,
      total,
      canRead,
      setPreset,
      setRange,
      setTab,
      setMode,
      setQuery,
      setPage,
      applyFilters,
      clearFilters,
      refetch,
    ]
  );
};
