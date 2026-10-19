'use client';
import { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import { todayInTenantTz } from 'src/utils/dates';

import { ExpenseFormDrawer } from '../../expenses/components/ExpenseFormDrawer';
import { useExpenseForm } from '../../expenses/hooks/useExpenseForm';
import { expenseRepeatOpened } from '../../expenses/redux/expenseFormSlice';

import type { RepeatSource } from '../api/counterService';
export function RepeatExpense({
  source,
  onClose,
}: Readonly<{ source: RepeatSource; onClose: () => void }>): React.JSX.Element | null {
  const form = useExpenseForm();
  const dispatch = useAppDispatch();
  const zone = useAppSelector(selectTenantTimezone);
  useEffect(() => {
    if (source.expense)
      dispatch(
        expenseRepeatOpened({ ...source.expense, expenseDate: todayInTenantTz(zone ?? undefined) })
      );
  }, [source, dispatch, zone]);
  const close = () => {
    form.close();
    onClose();
  };
  return form.open ? <ExpenseFormDrawer form={{ ...form, close }} /> : null;
}
