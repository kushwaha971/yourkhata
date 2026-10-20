'use client';

import { useEffect, useState } from 'react';

/** 05 §3 — how long a write may be busy before the screen says it still is. */
export const STILL_WORKING_MS = 3_000;

/**
 * True once `busy` has stayed true for `ms`, false the moment it stops.
 *
 * The busy word on the button ("Issuing…") is right for a second; after three,
 * a merchant at a counter starts to wonder whether the tap took, and a second
 * tap is exactly the double bill the in-flight guard and the idempotency key
 * exist to absorb. Saying "it won't be issued twice" stops the tap instead.
 * The flag is keyed to the busy run it started in, so a quick second write
 * never inherits the first one's "still".
 */
export function useStillWorking(busy: boolean, ms = STILL_WORKING_MS): boolean {
  const [slowRun, setSlowRun] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const [wasBusy, setWasBusy] = useState(busy);
  // A new busy run is derived during render, so the old flag never paints once.
  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (busy) setRun((current) => current + 1);
  }
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setSlowRun(run), ms);
    return () => window.clearTimeout(timer);
  }, [busy, run, ms]);
  return busy && slowRun === run;
}
