import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { REPEAT_MS, UbScanSheet } from './UbScanSheet';

// ADR-064: phones without a built-in reader use the ponyfill; its .wasm is
// ours, under /vendor, never a CDN.
const prepare = jest.fn();
jest.mock('barcode-detector/ponyfill', () => ({
  ZXING_WASM_VERSION: '3.1.3',
  prepareZXingModule: (options: unknown) => prepare(options),
  BarcodeDetector: class {
    detect = jest.fn(async () => [{ rawValue: '8901030875021' }]);
  },
}));

/**
 * C1 / C2 — the phone camera that reads barcodes. Prevents: one code held in
 * front of the lens adding ten lines; a refused or missing camera leaving the
 * merchant stuck (the typed path must add a code); a camera left running after
 * Done (the stream's tracks must stop).
 */
const labels = {
  close: 'Close',
  torch: 'Torch',
  done: 'Done',
  blockedTitle: 'Camera is blocked',
  blockedBody: 'Allow the camera… Or type the code below.',
  barcode: 'Barcode',
  add: 'Add',
  keepsWorking: 'The bill keeps working without the camera.',
};

const codes: string[] = [];
let stop: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  codes.length = 0;
  stop = jest.fn();
  (globalThis as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
    detect = jest.fn(async () => (codes.length ? [{ rawValue: codes[0] }] : []));
  };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: jest.fn(async () => ({ getTracks: () => [{ stop }], getVideoTracks: () => [] })),
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
});
afterEach(() => {
  jest.useRealTimers();
  delete (globalThis as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
});

it('reads a code once while it is held, again after the repeat window, and stops the camera on Done', async () => {
  const onCode = jest.fn();
  const onClose = jest.fn();
  const { rerender } = render(
    <UbScanSheet open onClose={onClose} onCode={onCode} title="Scanning for bill" hint="Point at the barcode." labels={labels} />
  );
  codes.push('8901234567890');
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(160);
    });
  }
  expect(onCode).toHaveBeenCalledTimes(1);
  await act(async () => {
    jest.advanceTimersByTime(REPEAT_MS + 200);
  });
  expect(onCode).toHaveBeenCalledTimes(2);
  rerender(
    <UbScanSheet open={false} onClose={onClose} onCode={onCode} title="Scanning for bill" hint="Point at the barcode." labels={labels} />
  );
  expect(stop).toHaveBeenCalled();
});

it('without a built-in reader, reads with the ponyfill and serves its .wasm from /vendor', async () => {
  delete (globalThis as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  const onCode = jest.fn();
  render(<UbScanSheet open onClose={jest.fn()} onCode={onCode} title="t" hint="h" labels={labels} />);
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(160);
    });
  }
  expect(onCode).toHaveBeenCalledWith('8901030875021');
  const { overrides } = prepare.mock.calls[0][0] as { overrides: { locateFile: (p: string, x: string) => string } };
  expect(overrides.locateFile('zxing_reader.wasm', 'https://cdn.example/')).toBe('/vendor/zxing_reader-3.1.3.wasm');
});

it('without a camera, shows the blocked view and adds a typed code', async () => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  jest.useRealTimers();
  const onCode = jest.fn();
  render(<UbScanSheet open onClose={jest.fn()} onCode={onCode} title="t" hint="h" labels={labels} />);
  expect(screen.getByText('Camera is blocked')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Barcode'), '8901030875021');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(onCode).toHaveBeenCalledWith('8901030875021');
});
