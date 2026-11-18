import { store } from 'src/redux/store';

import { itemFiltersChanged, selectItemRows } from './itemListSlice';
import { fetchItemList, type ItemListArg } from './itemThunk';

import type { ItemListResult, ItemListRow } from '../types/item.types';

/**
 * R-DEC-33 on Items. What these protect: a phone's page two JOINS the cards
 * (never replaces them), a failed page two keeps them, Try again joins rather
 * than showing page two alone, and a new search starts from page one's answer
 * only — a late page two of the old search is dropped.
 */
const base: ItemListArg = {
  q: '',
  tab: 'all',
  type: '',
  categoryId: '',
  status: 'active',
  ordering: 'name',
  page: 1,
};
const page = (ids: readonly string[], pageNo: number): ItemListResult => ({
  rows: ids.map((id) => ({ id }) as ItemListRow),
  page: pageNo,
  pageSize: 25,
  total: 60,
  totalPages: 3,
  totals: { items: 60, stockValue: null },
  counts: { all: 60, in: 50, low: 6, out: 4 },
});
const ids = () => selectItemRows(store.getState()).map((row) => row.id);
const land = (arg: ItemListArg, result: ItemListResult, id: string) => {
  store.dispatch(itemFiltersChanged(arg));
  store.dispatch(fetchItemList.pending(id, arg));
  store.dispatch(fetchItemList.fulfilled(result, id, arg));
};

it('joins page two under page one on a phone, and keeps the cards when it fails', () => {
  land(base, page(['a', 'b'], 1), 'r1');
  const next: ItemListArg = { ...base, page: 2, mode: 'append' };
  store.dispatch(itemFiltersChanged(next));
  store.dispatch(fetchItemList.pending('r2', next));
  store.dispatch(fetchItemList.rejected(new Error('lost'), 'r2', next));
  expect(ids()).toEqual(['a', 'b']);
  expect(store.getState().itemList?.status).toBe('failed');
  // Try again sends the same append argument.
  store.dispatch(fetchItemList.pending('r3', next));
  store.dispatch(fetchItemList.fulfilled(page(['c', 'b'], 2), 'r3', next));
  expect(ids()).toEqual(['a', 'b', 'c']);
});

it('a desktop page replaces, and a late page two of an old search is dropped', () => {
  land(base, page(['a', 'b'], 1), 'r1');
  land({ ...base, page: 2 }, page(['c'], 2), 'r2');
  expect(ids()).toEqual(['c']);
  const old: ItemListArg = { ...base, page: 2, mode: 'append' };
  land(base, page(['a', 'b'], 1), 'r3');
  store.dispatch(itemFiltersChanged(old));
  store.dispatch(fetchItemList.pending('r4', old));
  const fresh: ItemListArg = { ...base, q: 'rice' };
  store.dispatch(itemFiltersChanged(fresh));
  store.dispatch(fetchItemList.pending('r5', fresh));
  store.dispatch(fetchItemList.fulfilled(page(['late'], 2), 'r4', old));
  store.dispatch(fetchItemList.fulfilled(page(['rice'], 1), 'r5', fresh));
  expect(ids()).toEqual(['rice']);
});
