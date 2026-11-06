'use client';

import { memo, useState } from 'react';

import { useUbLoadingLabels } from 'src/design-system/UbLoadingLabels';
import { UbSkeleton } from 'src/design-system/UbSkeleton';
import { UbSlowLoadingNote } from 'src/design-system/UbSlowLoadingNote';
import { UbStack } from 'src/design-system/UbStack';

import { UbDialog } from './UbDialog';

/**
 * A8 — `UbDrawerLoading`'s twin for dialogs and sheets: the real `UbDialog`
 * frame, in its own place, with a loading body, while a lazily loaded dialog's
 * code downloads. The rule is the same — use it only as the `loading` view of
 * a `dynamic()` dialog mounted while open, because `next/dynamic` gives that
 * view no props and it cannot know the dialog is closed.
 */
function UbDialogLoadingBase(): React.JSX.Element {
  const labels = useUbLoadingLabels();
  // Closable: a chunk that never arrives must not trap the merchant (A8 P4).
  // Closing only hides this shape; the screen still asks for the real one.
  const [shown, setShown] = useState(true);
  return (
    <UbDialog
      open={shown}
      onOpenChange={setShown}
      title={labels.loading}
      closeLabel={labels.close}
    >
      <UbStack gap={3} aria-busy data-ub-dialog-loading="">
        <UbSkeleton variant="form" count={1} label={labels.loading} />
        <UbSlowLoadingNote />
      </UbStack>
    </UbDialog>
  );
}

export const UbDialogLoading = memo(UbDialogLoadingBase);
UbDialogLoading.displayName = 'UbDialogLoading';
