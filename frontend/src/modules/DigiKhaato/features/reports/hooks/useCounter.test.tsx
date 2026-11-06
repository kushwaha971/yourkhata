import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

import { store } from 'src/redux/store';

import { getCounter } from '../api/counterService';

import { useCounter } from './useCounter';

import type { CounterData } from '../api/counterService';

jest.mock('../api/counterService', () => ({ getCounter: jest.fn() }));
const read = jest.mocked(getCounter);
const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => <Provider store={store}>{children}</Provider>;

it('hides old register facts immediately when the dashboard refresh identity changes', async () => {
  // Defect: same-actor refreshes retained previous facts while the new source read was pending.
  read.mockResolvedValueOnce({ as_of: '2026-10-20', documents: {} });
  const view = renderHook(({ stamp }) => useCounter(stamp), { wrapper, initialProps: { stamp: 'before-payment' } });
  await waitFor(() => expect(view.result.current.data).not.toBeNull());
  let finish: ((data: CounterData) => void) | undefined;
  read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  view.rerender({ stamp: 'after-payment' });
  expect(view.result.current.data).toBeNull();
  await act(async () => finish?.({ as_of: '2026-10-21', documents: {} }));
  await waitFor(() => expect(view.result.current.data?.as_of).toBe('2026-10-21'));
});
