'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import dynamic from 'next/dynamic';

import { MoreHorizontal } from 'lucide-react';

import { useIsMobileLayer } from 'src/design-system/motion/useMediaQuery';
import { UbBottomBar } from 'src/design-system/UbBottomBar';
import { UbButton } from 'src/design-system/UbButton';
import { UbDialogLoading } from 'src/design-system/UbDialog';
import { UbFab } from 'src/design-system/UbFab';
import { useAppRouter } from 'src/hooks/useAppRouter';

/** Fetched on the first ⋯ press: the sheet is a Radix dialog, not first paint. */
const UbActionSheet = dynamic(
  () => import('src/design-system/UbActionSheet/UbActionSheet').then((m) => m.UbActionSheet),
  { ssr: false, loading: () => <UbDialogLoading /> }
);

export interface UbPageHeaderMobile {
  /** The ⋯ button's name and the sheet's title — "More actions". */
  readonly menuLabel: string;
  readonly closeLabel: string;
  /**
   * The screen's one primary action, as the phone's floating button. On a
   * desktop the same action is the `primaryAction` element at the end of the
   * header's row, exactly as before. `header` is the design's worded amber
   * button (`.btn.cta.lg.w`, 46 px), held under the rows above the bottom menu.
   */
  readonly primaryPlacement?: 'floating' | 'header';
  readonly primary?: {
    readonly label: string;
    readonly icon: ReactNode;
    readonly onClick?: () => void;
    readonly href?: string;
  };
}

const PAGE_CTA_HEIGHT = 62;

/**
 * docs/mobile-redesign/05 — a list screen's header actions below `lg`: a ⋯
 * that opens them as worded rows (`UbActionSheet`), and the primary action as
 * the floating button in the thumb's reach. Everything here is `lg:hidden`;
 * the desktop header draws its actions inline, untouched.
 */
export function UbPageHeaderMobileActions({
  mobile,
  actions,
}: Readonly<{ mobile: UbPageHeaderMobile; actions?: ReactNode }>): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useAppRouter();
  const { primary } = mobile;
  // Rendered only on a phone, so a desktop DOM has no second "Add" and no ⋯.
  const isMobile = useIsMobileLayer();
  const docked = isMobile && Boolean(primary) && mobile.primaryPlacement === 'header';
  // Registers fit the viewport, so they give up the button's height (R-DEC-30).
  useLayoutEffect(() => {
    if (!docked) return undefined;
    const root = document.documentElement.style;
    root.setProperty('--ub-page-cta', `${PAGE_CTA_HEIGHT}px`);
    return () => {
      root.removeProperty('--ub-page-cta');
    };
  }, [docked]);
  if (!isMobile) return null;

  return (
    <>
      {actions ? (
        <div className="flex shrink-0 items-center lg:hidden">
          <UbButton
            ref={trigger}
            variant="ghost"
            iconOnly
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => {
              setOpened(true);
              setOpen(true);
            }}
            className="h-11 w-11 text-text-secondary"
            icon={<MoreHorizontal aria-hidden className="h-5 w-5" />}
          >
            {mobile.menuLabel}
          </UbButton>
          {opened && (
            <UbActionSheet
              open={open}
              onOpenChange={setOpen}
              title={mobile.menuLabel}
              closeLabel={mobile.closeLabel}
              returnFocusRef={trigger}
            >
              {actions}
            </UbActionSheet>
          )}
        </div>
      ) : null}
      {primary && mobile.primaryPlacement === 'header' ? (
        <UbBottomBar
          sticky={false}
          data-testid="page-cta"
          className="fixed inset-x-0 bottom-[var(--ub-nav-offset)] z-20 bg-canvas px-4 py-2 lg:hidden"
        >
          <UbButton
            variant="primary"
            className="h-[46px] w-full rounded-lg text-[15px] font-semibold"
            onClick={() => {
              if (primary.onClick) primary.onClick();
              else if (primary.href) router.push(primary.href);
            }}
          >
            {primary.label}
          </UbButton>
        </UbBottomBar>
      ) : primary ? (
        <UbFab
          mobileOnly
          label={primary.label}
          icon={primary.icon}
          onClick={() => {
            if (primary.onClick) primary.onClick();
            else if (primary.href) router.push(primary.href);
          }}
        />
      ) : null}
    </>
  );
}
