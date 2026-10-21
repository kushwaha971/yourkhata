import { yupResolver } from '@hookform/resolvers/yup';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';

import { UbButton } from 'src/design-system/UbButton';
import { UbField } from 'src/design-system/UbField';
import { UbForm } from 'src/design-system/UbForm';
import { UbTextInput } from 'src/design-system/UbTextInput';

/**
 * 05 §4 — the double-tap lock on every form.
 *
 * The defect: `handleSubmit` awaits the resolver before calling `onSubmit`, so
 * the caller's `busy` is painted only after validation. Two taps on Save inside
 * that window — or a tap and an Enter — both reached `onSubmit` and both
 * posted. For a money form that is the same entry recorded twice.
 */
interface Values {
  amount: string;
}

function Harness({ onSubmit }: Readonly<{ onSubmit: (values: Values) => Promise<void> }>) {
  const form = useForm<Values>({
    resolver: yupResolver(
      Yup.object({ amount: Yup.string().required('Enter an amount').defined() })
    ),
    defaultValues: { amount: '500' },
  });
  return (
    <UbForm form={form} onSubmit={onSubmit}>
      <UbField name="amount" label="Amount">
        {(field) => <UbTextInput {...field} />}
      </UbField>
      <UbButton type="submit">Save</UbButton>
    </UbForm>
  );
}

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe('UbForm double-tap lock', () => {
  it('submits once for two taps that arrive before the first has finished', async () => {
    const pending = deferred();
    const onSubmit = jest.fn(() => pending.promise);
    render(<Harness onSubmit={onSubmit} />);
    const save = screen.getByRole('button', { name: 'Save' });

    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.submit(save.closest('form') as HTMLFormElement);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('accepts the next submit once the first has settled, so Try again works', async () => {
    const onSubmit = jest.fn(() => Promise.reject(new Error('no network')).catch(() => undefined));
    render(<Harness onSubmit={onSubmit} />);
    const save = screen.getByRole('button', { name: 'Save' });

    fireEvent.click(save);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    fireEvent.click(save);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });

  it('still prevents the native submit of a dropped tap', async () => {
    const pending = deferred();
    render(<Harness onSubmit={() => pending.promise} />);
    const form = screen.getByRole('button', { name: 'Save' }).closest('form') as HTMLFormElement;

    fireEvent.submit(form);
    const second = fireEvent.submit(form);
    expect(second).toBe(false); // defaultPrevented
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
  });
});

it('saving a form in a portal never submits the document form that opened it', async () => {
  // Defect: React submit events cross portal boundaries; saving an inline contact/item could submit its bill too.
  const saveContact = jest.fn(async () => undefined);
  const recordBill = jest.fn(async () => undefined);
  function Contact() {
    const form = useForm({ defaultValues: { name: 'Radhe Krishna Electricals' } });
    return createPortal(
      <UbForm form={form} onSubmit={saveContact}>
        <UbButton type="submit">Save contact</UbButton>
      </UbForm>,
      document.body
    );
  }
  function Bill() {
    const form = useForm({ defaultValues: { qty: '1' } });
    return (
      <UbForm form={form} onSubmit={recordBill}>
        <Contact />
      </UbForm>
    );
  }
  render(<Bill />);
  fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));
  await waitFor(() => expect(saveContact).toHaveBeenCalledTimes(1));
  expect(recordBill).not.toHaveBeenCalled();
});
