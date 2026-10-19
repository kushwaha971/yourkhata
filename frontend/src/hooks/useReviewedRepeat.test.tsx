import { act, renderHook, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { Provider } from 'react-redux';

import { store } from 'src/redux/store';

import { useReviewedRepeat } from './useReviewedRepeat';
const mockQuery = 'repeat=source1';
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mockQuery) }));
const wrapper = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <Provider store={store}>{children}</Provider>
);
it('proposes source fields in a new form without copying a source identity or saving', async () => {
  const read = jest.fn().mockResolvedValue({ name: 'LED driver', price: '900.00' });
  const { result } = renderHook(
    () => {
      const form = useForm({ defaultValues: { name: '', price: '', date: '2026-10-19' } });
      useReviewedRepeat({ ready: true, documentId: null, form, read });
      return form;
    },
    { wrapper }
  );
  await waitFor(() => expect(result.current.getValues('name')).toBe('LED driver'));
  expect(result.current.getValues('date')).toBe('2026-10-19');
  expect(result.current.formState.isDirty).toBe(false);
});
it('never overwrites manual input with a late repeat reply', async () => {
  let answer!: (v: { name: string }) => void;
  const read = jest.fn(
    () =>
      new Promise<{ name: string }>((r) => {
        answer = r;
      })
  );
  const { result } = renderHook(
    () => {
      const form = useForm({ defaultValues: { name: '' } });
      void form.formState.isDirty;
      useReviewedRepeat({ ready: true, documentId: null, form, read });
      return form;
    },
    { wrapper }
  );
  act(() => result.current.setValue('name', 'My electrical item', { shouldDirty: true }));
  await act(async () => answer({ name: 'Old source' }));
  expect(result.current.getValues('name')).toBe('My electrical item');
});
