'use client';

import { useEffect, useState } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';

import { listPlaces, type Place } from '../api/transferService';

/**
 * D P1c — the business's places. A business turns `godowns` on by adding its
 * second place, and only then is the list read: the editors offer a godown
 * choice "only once a second godown exists" (design D10), and every other
 * business pays no request for it.
 */
export function usePlaces(): readonly Place[] {
  const hasGodowns = Boolean(useAppSelector(selectActiveTenant)?.features?.includes('godowns'));
  const [places, setPlaces] = useState<readonly Place[]>([]);
  useEffect(() => {
    if (!hasGodowns) return undefined;
    let alive = true;
    void listPlaces()
      .then((list) => {
        if (alive) setPlaces(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [hasGodowns]);
  return hasGodowns ? places : [];
}
