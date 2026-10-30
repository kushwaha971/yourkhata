'use client';

import { useAppSelector } from 'src/hooks/useAppStore';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';

/**
 * B2 / BP-22 #2 — is this business feature on? The server decides (from the
 * kind's preset and the owner's switches) and sends the list in the session;
 * nothing on the client reads a business type to decide (R-DEC-65).
 *
 * An older server that sends no list answers `true`, so nothing that worked
 * before B2 disappears.
 */
export function useFeature(key: string): boolean {
  const features = useAppSelector(selectActiveTenant)?.features;
  return features == null ? true : features.includes(key);
}
