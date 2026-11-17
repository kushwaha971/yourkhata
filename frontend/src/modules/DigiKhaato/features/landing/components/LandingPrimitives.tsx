'use client';

import { memo, type ReactNode } from 'react';

import { UbBox, UbReveal, UbText } from 'src/design-system';
import { cn } from 'src/utils/cn';

// Plain strings in a server-safe module, so server-rendered pages (/solutions) can use them too.
export { LANDING_CONTAINER, LANDING_SCALE } from '../config/layout';

/** The section rhythm: generous. */
export const LANDING_SECTION = 'relative py-16 md:py-20 xl:py-24';

/** Existing italic emphasis uses Jakarta; Hindi remains upright in Mukta. */
export const SERIF_LEAD =
  'block font-serif-display font-normal italic tracking-[-0.01em] [&:lang(hi)]:font-medium [&:lang(hi)]:not-italic [&:lang(hi)]:tracking-normal';

/** The bold-sans key line under it. */
export const SANS_KEY = 'block font-semibold tracking-[-0.025em]';

export function LandingEyebrow({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  return (
    <UbText
      as="span"
      variant="inherit"
      className="ds-body-s-medium inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-quiet px-3 py-1 text-text-accent"
    >
      <UbBox as="span" aria-hidden className="h-1.5 w-1.5 rounded-full bg-action" />
      {children}
    </UbText>
  );
}

export interface LandingSectionHeadingProps {
  readonly id: string;
  readonly eyebrow: string;
  readonly lead: string;
  readonly keyLine: string;
  readonly align?: 'center' | 'start';
  readonly className?: string;
}

/** Eyebrow chip, then an italic-serif line over a bold-sans line, as one h2. */
function LandingSectionHeadingBase({
  id,
  eyebrow,
  lead,
  keyLine,
  align = 'center',
  className,
}: Readonly<LandingSectionHeadingProps>) {
  return (
    <UbReveal
      stagger
      className={cn(
        'flex flex-col gap-4',
        /* `start` belongs to the two-column sections (FAQ, Who it's for), whose
           heading sits beside its list only from `lg`. Stacked on a phone it
           is one more centred section heading, like every other one (owner,
           12 Oct 2026: "the chip and the title are not in the centre"). */
        align === 'center'
          ? 'items-center text-center'
          : 'items-center text-center lg:items-start lg:text-left',
        className
      )}
    >
      <UbBox>
        <LandingEyebrow>{eyebrow}</LandingEyebrow>
      </UbBox>
      <UbText
        as="h2"
        id={id}
        variant="inherit"
        tone="primary"
        className="max-w-[30ch] text-balance text-[clamp(1.875rem,1.25rem+2.4vw,3rem)] leading-[1.12]"
      >
        <UbText as="span" variant="inherit" tone="secondary" className={SERIF_LEAD}>
          {lead}
        </UbText>{' '}
        <UbText as="span" variant="inherit" className={SANS_KEY}>
          {keyLine}
        </UbText>
      </UbText>
    </UbReveal>
  );
}

LandingSectionHeadingBase.displayName = 'LandingSectionHeading';
export const LandingSectionHeading = memo(LandingSectionHeadingBase);
