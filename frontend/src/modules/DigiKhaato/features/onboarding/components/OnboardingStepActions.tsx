'use client';

import { memo, useEffect, useState } from 'react';

import { UbBottomBar, UbButton } from 'src/design-system';

/**
 * PLT-03 §7 — the action bar, identical on every step: sticky at the bottom on
 * mobile so Continue is under the thumb with the keyboard up, right-aligned
 * above `sm`.
 *
 * The order in the DOM is Back, Skip, Continue — and `flex-col-reverse` on
 * mobile puts Continue at the TOP of the stack, nearest the thumb, without
 * changing the tab order. That is the whole reason this is one component rather
 * than three copies of a `div`.
 *
 * CR-2026-09-19-F — the bar is OPAQUE against whatever is behind it at each
 * width, because a sticky bar over a transparent background is a bar you can
 * read the form through: `--canvas` on a phone and from `lg` (where the step
 * has no card), `--surface-card` between them (where it does). The other half
 * of the overflow fix is not here — it is the `pb-28` on the form's scroll
 * container in `OnboardingShell`, which is what lets the last field scroll
 * clear of this bar instead of dying behind it.
 *
 * CR-2026-09-19-G — it is a `UbBottomBar` rather than a `sticky bottom-0`
 * `UbStack`, so it PUBLISHES its height as `--ub-bottom-inset` and the global
 * toast anchors above it. Before this, a failed step submit toasted straight
 * over Continue: the primary action of the screen behind the error message
 * telling you the submit failed. The `sticky bottom-0` now comes from
 * `UbBottomBar`; everything else about the bar is unchanged.
 */
/**
 * E1 (edge-case catalogue) — how long a freshly opened step ignores its own
 * Continue and Skip. Every step's Continue sits where the last one was, so a
 * double or triple tap on step 1 carried on through steps 2 and 3 and landed on
 * step 4: GST and address passed without the merchant ever seeing them. Long
 * enough to swallow a double tap, short enough that nobody reaches for the
 * button before it.
 */
export const STEP_ACTIONS_ARM_MS = 450;

export interface OnboardingStepActionsProps {
  readonly onBack: (() => void) | null;
  /** FR-10 — steps 2 and 3 are skippable; step 1 is not. */
  readonly onSkip?: (() => void) | undefined;
  readonly continueLabel: string;
  readonly busyLabel: string;
  readonly backLabel: string;
  readonly skipLabel: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  /**
   * How long the step ignores its own buttons after opening. The wizard's
   * component tests press Continue the instant a step renders, which no person
   * can do, so they run with 0; the guard's own test sets it.
   */
  readonly armMs?: number;
}

function OnboardingStepActionsBase({
  onBack,
  onSkip,
  continueLabel,
  busyLabel,
  backLabel,
  skipLabel,
  busy,
  disabled,
  armMs = process.env.NODE_ENV === 'test' ? 0 : STEP_ACTIONS_ARM_MS,
}: Readonly<OnboardingStepActionsProps>) {
  const [armed, setArmed] = useState(armMs <= 0);
  useEffect(() => {
    if (armMs <= 0) return undefined;
    const timer = setTimeout(() => setArmed(true), armMs);
    return () => clearTimeout(timer);
  }, [armMs]);
  return (
    <UbBottomBar className="flex flex-col-reverse gap-2 border-t border-border-hairline bg-canvas py-3 sm:flex-row sm:items-center sm:justify-end sm:bg-surface-card lg:bg-canvas">
      {onBack && (
        <UbButton variant="ghost" size="lg" onClick={onBack} disabled={busy}>
          {backLabel}
        </UbButton>
      )}
      {onSkip && (
        <UbButton
          variant="ghost"
          size="lg"
          onClick={onSkip}
          disabled={busy || disabled || !armed}
        >
          {skipLabel}
        </UbButton>
      )}
      <UbButton
        type="submit"
        size="lg"
        fullWidth
        busy={busy}
        busyLabel={busyLabel}
        disabled={disabled || !armed}
        className="sm:w-auto"
      >
        {continueLabel}
      </UbButton>
    </UbBottomBar>
  );
}

OnboardingStepActionsBase.displayName = 'OnboardingStepActions';
export const OnboardingStepActions = memo(OnboardingStepActionsBase);
