'use client';

import { UbDialog, UbDrawer, type UbDialogProps, type UbDrawerProps } from 'src/design-system';
import { cn } from 'src/utils/cn';

/*
 * Retired by design §A5 (27 Oct 2026): every drawer, sheet and dialog now
 * has ONE spacing scale, set in the dialog primitives (16 px from the edge on
 * a phone, 20 / 24 on desktop, the footer's own padding and safe area). This
 * "compact" density padded every child of the panel 16 px, which overrode the
 * desktop values and turned the phone sheet's 4 px grab handle into a 32 px
 * block. Kept as an empty class so the callers need no change.
 */
export const COMPACT_OVERLAY_CLASSNAME = '';

export function CompactDrawer(props: Readonly<UbDrawerProps>): React.JSX.Element {
  return <UbDrawer {...props} className={cn(COMPACT_OVERLAY_CLASSNAME, props.className)} />;
}

export function CompactDialog(props: Readonly<UbDialogProps>): React.JSX.Element {
  return <UbDialog {...props} className={cn(COMPACT_OVERLAY_CLASSNAME, props.className)} />;
}
