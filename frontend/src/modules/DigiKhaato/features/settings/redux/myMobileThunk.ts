import { createAsyncThunk } from '@reduxjs/toolkit';

import type { AppDispatch, RootState } from 'src/redux/store';
import type { ApiErrorShape } from 'src/types/api.types';
import { toApiError } from 'src/utils/apiError';

import { fetchSession } from 'modules/DigiKhaato/features/auth/redux/sessionThunk';
import type { OtpChallenge } from 'modules/DigiKhaato/features/auth/types/auth.types';

import * as myMobileService from '../api/myMobileService';

/** QUERY-like. Design S2 — Change mobile, step 1: a code to the new number. */
export const requestMobileChange = createAsyncThunk<
  OtpChallenge,
  { readonly mobile: string },
  { rejectValue: ApiErrorShape }
>('session/requestMobileChange', async ({ mobile }, { rejectWithValue }) => {
  try {
    return await myMobileService.requestMobileChange(mobile);
  } catch (error) {
    return rejectWithValue(toApiError(error, 'common.error.generic'));
  }
});

/**
 * MUTATION. Design S2 — Change mobile, step 2: the code moves the sign-in, and
 * the session is read again so every screen shows the new number at once.
 */
export const confirmMobileChange = createAsyncThunk<
  void,
  { readonly challengeId: string; readonly code: string },
  { rejectValue: ApiErrorShape; state: RootState; dispatch: AppDispatch }
>('session/confirmMobileChange', async (input, { dispatch, rejectWithValue }) => {
  try {
    await myMobileService.confirmMobileChange(input);
  } catch (error) {
    return rejectWithValue(toApiError(error, 'common.error.generic'));
  }
  await dispatch(fetchSession());
  return undefined;
});
