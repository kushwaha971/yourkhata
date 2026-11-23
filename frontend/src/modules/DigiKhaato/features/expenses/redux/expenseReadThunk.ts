import { createAsyncThunk } from '@reduxjs/toolkit';

import type { ApiErrorShape } from 'src/types/api.types';
import { toApiError } from 'src/utils/apiError';

import type { Expense } from '../types/expense.types';

/**
 * 08 §11 — one expense by id, for a cash book row's detail sheet.
 *
 * Its own module, not `expenseThunk.ts`: that file is imported by the two
 * expense slices, which the store registers statically. Nothing reduces this
 * thunk, so only the hook that dispatches it imports it.
 */
export const fetchExpense = createAsyncThunk<Expense, string, { rejectValue: ApiErrorShape }>(
  'expenseForm/fetchExpense',
  async (id, { signal, rejectWithValue }) => {
    try {
      return await (await import('../api/expenseService')).getExpense(id, signal);
    } catch (error) {
      return rejectWithValue(toApiError(error, 'expenses.list.error.title'));
    }
  }
);
