'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { Camera, Flashlight, X } from 'lucide-react';

import { cn } from 'src/utils/cn';

/**
 * C1 / C2 (design `pScan`, `pCamBlocked`) — the phone's full-screen camera
 * that reads barcodes.
 *
 * Continuous: every code is handed to `onCode` and the camera stays open
 * until Done, so a stack of goods is billed by pointing at each in turn. The
 * same code is not read twice within `REPEAT_MS` (a code held in front of the
 * lens is one item, not ten); a second of the same item after that raises its
 * quantity, as the bill does for the USB scanner.
 *
 * The reader is the browser's own `BarcodeDetector` (ADR-025). Where there is
 * none (iPhones today), or the camera is refused or missing, the sheet shows
 * the design's "Camera is blocked" view with a Barcode field and Add: the bill
 * keeps working without the camera. A library for iPhones is the owner's call
 * (ADR-064, proposed).
 */
export interface UbScanSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCode: (code: string) => void;
  /** "Scanning for bill · INV-0419". */
  readonly title: string;
  /** "Point at the barcode. Keeps scanning until Done." */
  readonly hint: string;
  /** The tray under the camera: last scanned items and the running total. */
  readonly tray?: ReactNode;
  readonly labels: {
    readonly close: string;
    readonly torch: string;
    readonly done: string;
    readonly blockedTitle: string;
    readonly blockedBody: string;
    readonly barcode: string;
    readonly add: string;
    readonly keepsWorking: string;
  };
}

/** A code held in front of the lens is read once in this window. */
export const REPEAT_MS = 1500;
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];

interface Detector {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (options: { formats: string[] }) => Detector;

export function UbScanSheet({
  open,
  onClose,
  onCode,
  title,
  hint,
  tray,
  labels,
}: Readonly<UbScanSheetProps>): React.JSX.Element | null {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [denied, setDenied] = useState(false);
  // No reader in this browser (iPhones today) or no camera API: the typed path.
  const supported =
    typeof window !== 'undefined' &&
    Boolean((globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector) &&
    Boolean(navigator.mediaDevices?.getUserMedia);
  const blocked = !supported || denied;
  const [torchOn, setTorchOn] = useState(false);
  const [typed, setTyped] = useState('');
  const handler = useRef(onCode);
  useEffect(() => {
    handler.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!open) return undefined;
    let stopped = false;
    let timer: number | undefined;
    const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!supported || !Ctor) return undefined;
    const detector = new Ctor({ formats: FORMATS });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((media) => {
        if (stopped) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play().catch(() => undefined);
        }
        const tick = () => {
          if (stopped || !video.current) return;
          void detector
            .detect(video.current)
            .then((found) => {
              const code = found[0]?.rawValue?.trim();
              const now = Date.now();
              if (code && (code !== last.current.code || now - last.current.at > REPEAT_MS)) {
                last.current = { code, at: now };
                handler.current(code);
              }
            })
            .catch(() => undefined)
            .finally(() => {
              timer = window.setTimeout(tick, 150);
            });
        };
        tick();
      })
      .catch(() => setDenied(true));
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setTorchOn(false);
    };
  }, [open, supported]);

  const toggleTorch = useCallback(() => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    void track
      .applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => undefined);
  }, [torchOn]);

  const addTyped = useCallback(() => {
    const code = typed.trim();
    if (!code) return;
    handler.current(code);
    setTyped('');
  }, [typed]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="scan-sheet"
      className="fixed inset-0 z-[60] flex flex-col bg-[#0d0f10] text-white"
    >
      <div className="relative flex flex-1 flex-col">
        {!blocked && (
           
          <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="relative z-[1] flex items-center justify-between px-3.5 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/15"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
          {!blocked && <span className="text-sm font-semibold">{title}</span>}
          {!blocked ? (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={labels.torch}
              aria-pressed={torchOn}
              className={cn('grid h-11 w-11 place-items-center rounded-full bg-white/15', torchOn && 'bg-white/35')}
            >
              <Flashlight aria-hidden className="h-5 w-5" />
            </button>
          ) : (
            <span className="h-11 w-11" />
          )}
        </div>
        {!blocked ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[42%] h-[150px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border-[3px] border-white shadow-[0_0_0_999px_rgba(0,0,0,0.45)]"
            >
              <span className="absolute left-3 right-3 top-1/2 h-0.5 bg-[#F59E1B] shadow-[0_0_12px_#F59E1B]" />
            </div>
            <p className="absolute left-0 right-0 top-[calc(42%+92px)] text-center text-sm text-[#e6e6e6]">
              {hint}
            </p>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-6">
            <div className="grid max-w-[280px] justify-items-center gap-2.5 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white/15">
                <Camera aria-hidden className="h-6 w-6" />
              </span>
              <b className="text-lg">{labels.blockedTitle}</b>
              <span className="text-sm text-[#C4C8CE]">{labels.blockedBody}</span>
            </div>
          </div>
        )}
      </div>
      {!blocked ? (
        <div className="grid gap-2 rounded-t-2xl bg-[#1b1e23] px-4 pb-3.5 pt-3 text-[#ECEEF0]">
          {tray}
          <button
            type="button"
            onClick={onClose}
            className="mt-1 h-[46px] w-full rounded-lg bg-cta text-[15px] font-semibold text-cta-foreground"
          >
            {labels.done}
          </button>
        </div>
      ) : (
        <div className="grid gap-2 rounded-t-2xl bg-surface-card px-4 pb-3.5 pt-3 text-text-primary">
          <label htmlFor="ub-scan-typed" className="text-[13px] font-semibold">
            {labels.barcode}
          </label>
          <div className="flex gap-2">
            <input
              id="ub-scan-typed"
              inputMode="numeric"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addTyped();
              }}
              className="h-11 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-card px-3 text-[15px]"
            />
            <button
              type="button"
              onClick={addTyped}
              className="h-11 rounded-lg bg-cta px-4 text-[15px] font-semibold text-cta-foreground"
            >
              {labels.add}
            </button>
          </div>
          <span className="text-[12.5px] text-text-tertiary">{labels.keepsWorking}</span>
        </div>
      )}
    </div>
  );
}
