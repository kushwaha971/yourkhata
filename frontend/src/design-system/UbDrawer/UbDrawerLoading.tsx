'use client';

import { memo, useState } from 'react';

import { useUbLoadingLabels } from 'src/design-system/UbLoadingLabels';
import { UbSkeleton } from 'src/design-system/UbSkeleton';
import { UbSlowLoadingNote } from 'src/design-system/UbSlowLoadingNote';
import { UbStack } from 'src/design-system/UbStack';

import { UbDrawer } from './UbDrawer';

/**
 * A8 — the drawer that is on screen while a lazily loaded drawer's code is
 * still downloading (design §A8: "the button shows it was pressed at once, the
 * page stays, and the drawer slides in with its own loading shape").
 *
 * It is a real `UbDrawer` — the same bottom sheet on a phone and right-hand
 * panel on a desktop, in the same place — so when the real one mounts the
 * frame does not move; only its body fills in. Measured before it existed: a
 * first tap on "Add customer" showed nothing at all for the 1.3 s its chunk
 * took on a held network, and a merchant at a counter taps again.
 *
 * Use it as the `loading` view of a `dynamic()` drawer that is mounted only
 * while it is open (`{open && <Drawer/>}`). A drawer that is always mounted
 * must not use it: `next/dynamic` gives its `loading` view no props, so it
 * cannot know the drawer is closed and would show this on every page load.
 */
function UbDrawerLoadingBase(): React.JSX.Element {
  const labels = useUbLoadingLabels();
  // Closable: a chunk that never arrives must not trap the merchant (A8 P4).
  // Closing only hides this shape; the screen still asks for the real one.
  const [shown, setShown] = useState(true);
  return (
    <UbDrawer
      open={shown}
      onOpenChange={setShown}
      title={labels.loading}
      closeLabel={labels.close}
    >
      <UbStack gap={4} aria-busy data-ub-drawer-loading="">
        {/* `form`: a label and a field per row, the shape of every form drawer. */}
        <UbSkeleton variant="form" count={3} label={labels.loading} />
        <UbSlowLoadingNote />
      </UbStack>
    </UbDrawer>
  );
}

export const UbDrawerLoading = memo(UbDrawerLoadingBase);
UbDrawerLoading.displayName = 'UbDrawerLoading';
