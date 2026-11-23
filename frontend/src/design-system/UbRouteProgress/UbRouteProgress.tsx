'use client';

import { memo } from 'react';

import { cn } from 'src/utils/cn';

export interface UbRouteProgressProps {
  readonly active: boolean;
  readonly className?: string;
}

/**
 * docs/revamp/07-screens/02 "Route loading" — the 2 px teal line across the
 * very top of the screen while a navigation is on its way.
 *
 * It is drawn the moment a navigation starts rather than after a 120 ms grace
 * period: the screens it serves (a list row, "New bill") showed nothing for
 * ~300 ms on a throttled phone, and a line that flashes on a fast tap costs
 * less than a tap that seems not to have registered. Decorative to assistive
 * technology — the loading view that follows is the announced state — and
 * `data-loading` is what the perf harness counts as loading UI. Under reduced
 * motion the segment stops sliding and the line stays as a static bar.
 */
function UbRouteProgressBase({ active, className }: Readonly<UbRouteProgressProps>) {
  if (!active) return null;
  return (
    <div
      aria-hidden
      data-loading="true"
      data-testid="route-progress"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-primary-50',
        className
      )}
    >
      <div className="ub-route-progress h-full w-1/3 bg-primary-500" />
    </div>
  );
}

UbRouteProgressBase.displayName = 'UbRouteProgress';
export const UbRouteProgress = memo(UbRouteProgressBase);
