/**
 * C1 (design dScan / pScan) — what a scan feels like at a busy counter:
 * a short beep and a short buzz when a code lands, a lower double beep when it
 * is not one of the shop's items, and the line it touched flashing green.
 *
 * No library: Web Audio for the beep, `navigator.vibrate` where the phone has
 * it, and a data attribute the global stylesheet colours. Every part is best
 * effort; a browser that refuses sound or vibration still adds the line.
 */
let audio: AudioContext | null = null;

const tone = (frequency: number, startAt: number, ms: number): void => {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = frequency;
  osc.type = 'square';
  gain.gain.value = 0.06;
  osc.connect(gain).connect(audio.destination);
  osc.start(audio.currentTime + startAt);
  osc.stop(audio.currentTime + startAt + ms / 1000);
};

export const scanFeedback = (result: 'added' | 'notFound'): void => {
  try {
    const Ctx =
      typeof window === 'undefined'
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (Ctx && !audio) audio = new Ctx();
    if (result === 'added') tone(1760, 0, 70);
    else {
      tone(440, 0, 90);
      tone(440, 0.14, 90);
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(result === 'added' ? 40 : [60, 60, 60]);
    }
  } catch {
    // Sound or vibration refused: the scan still counts.
  }
};

/** How long the touched line stays green. */
export const SCAN_FLASH_MS = 900;

/**
 * Flash the bill line at `row` green: the desktop table's cells for that row
 * and the phone list's line. Drawn by `[data-scan-flash]` in globals.css.
 */
export const flashLine = (row: number, note?: string): void => {
  if (typeof document === 'undefined') return;
  requestAnimationFrame(() => {
    const targets = [
      ...document.querySelectorAll<HTMLElement>(`[data-line-cell][data-row="${row}"]`),
      ...[...document.querySelectorAll<HTMLElement>('[data-testid="invoice-line"]')].slice(row, row + 1),
    ];
    // Design dScan: "+1 scanned" under that line's Qty while it flashes.
    // The sales bill's table names its inputs `lines.<n>.qty`; the shared
    // line editor (purchases) marks its cells with data-field.
    const qty = note
      ? (document.getElementById(`lines.${row}.qty`)?.closest<HTMLElement>('td') ??
        document.querySelector<HTMLElement>(`[data-line-cell][data-row="${row}"][data-field="qty"]`))
      : null;
    for (const el of targets) el.setAttribute('data-scan-flash', '');
    qty?.setAttribute('data-scan-note', note ?? '');
    window.setTimeout(() => {
      for (const el of targets) el.removeAttribute('data-scan-flash');
      qty?.removeAttribute('data-scan-note');
    }, SCAN_FLASH_MS);
  });
};
