'use client';

import { memo, useEffect, useState } from 'react';

import { UbButton } from 'src/design-system/UbButton';
import { useUbLoadingLabels } from 'src/design-system/UbLoadingLabels';
import { UbStack } from 'src/design-system/UbStack';
import { UbText } from 'src/design-system/UbText';

/** A8 P4 — how long a loading shape may stay before it says something. */
export const SLOW_LOADING_MS = 10_000;

/**
 * A8 P4 — "a skeleton must time out into a message with a way to retry, never
 * wait for ever". The API already gives up at 30 s and every screen has its
 * error state; what had no end was the CODE: a chunk that never arrives left a
 * route's skeleton, or a drawer's loading shape, on screen indefinitely (A4's
 * monkey once saw the bill editor on its skeleton for minutes).
 *
 * After `afterMs` it says so in plain words and offers Try again, which
 * reloads the page — the one retry that reliably fetches a chunk again. Before
 * that it draws nothing, so a normal load never flashes it.
 */
/** The words, only once slow; they come from `UbLoadingLabelsProvider`. */
function SlowMessage(): React.JSX.Element {
  const labels = useUbLoadingLabels();
  return (
    <UbStack role="status" gap={2} data-ub-slow-loading="" className="items-start">
      <UbText variant="body-sm" tone="secondary">
        {labels.slow}
      </UbText>
      <UbButton variant="secondary" size="sm" onClick={() => window.location.reload()}>
        {labels.retry}
      </UbButton>
    </UbStack>
  );
}

function UbSlowLoadingNoteBase({ afterMs = SLOW_LOADING_MS }: Readonly<{ afterMs?: number }>) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), afterMs);
    return () => window.clearTimeout(timer);
  }, [afterMs]);
  return slow ? <SlowMessage /> : null;
}

export const UbSlowLoadingNote = memo(UbSlowLoadingNoteBase);
UbSlowLoadingNote.displayName = 'UbSlowLoadingNote';
