import { createAsyncThunk } from '@reduxjs/toolkit';

import type { ApiErrorShape } from 'src/types/api.types';
import { toApiError } from 'src/utils/apiError';

import { getParty, setCollectionDate } from '../api/partyService';

import type { PartyDetail, PartyDetailResult } from '../types/party.types';

export type PartyDetailArg = string | { readonly id: string; readonly book: 'shop' };
export const partyDetailArgId = (arg: PartyDetailArg): string =>
  typeof arg === 'string' ? arg : arg.id;
export const partyDetailArgBook = (arg: PartyDetailArg): 'main' | 'shop' =>
  typeof arg === 'string' ? 'main' : arg.book;

/**
 * QUERY. Part 19 §19.3.3 — three type arguments, one service call, and a catch
 * that normalises. The `signal` is RTK's own, so navigating away from a slow
 * khata page does not land its rows on the next one.
 */
export const fetchPartyDetail = createAsyncThunk<
  PartyDetailResult,
  PartyDetailArg,
  { rejectValue: ApiErrorShape }
>('partyDetail/fetchPartyDetail', async (arg, { signal, rejectWithValue }) => {
  try {
    return await (typeof arg === 'string'
      ? getParty(arg, signal)
      : getParty(arg.id, signal, arg.book));
  } catch (error) {
    return rejectWithValue(toApiError(error, 'parties.detail.error.title'));
  }
});

export interface SetCollectionDateArg {
  readonly id: string;
  /** ISO `YYYY-MM-DD`, or `null` to clear the promise. */
  readonly collectionDate: string | null;
}

/**
 * COMMAND. No `suppressErrorSnackbar` on the service call behind it, so a
 * failure surfaces through the global snackbar — which is right here and wrong
 * for the page fetch: this is one field on a screen that is otherwise fine, so
 * the toast lands next to a page the merchant can still read and retry from.
 */
export const saveCollectionDate = createAsyncThunk<
  PartyDetail,
  SetCollectionDateArg,
  { rejectValue: ApiErrorShape }
>('partyDetail/saveCollectionDate', async ({ id, collectionDate }, { rejectWithValue }) => {
  try {
    return await setCollectionDate(id, collectionDate);
  } catch (error) {
    return rejectWithValue(toApiError(error, 'parties.detail.collection.error'));
  }
});
