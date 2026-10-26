'use client';

import { memo, type ReactNode } from 'react';

import { X } from 'lucide-react';

import { cn } from 'src/utils/cn';

/**
 * A task screen's phone bar (design `.phead`, head 'back' with close): × to
 * leave, the title with a line under it, and one trailing control (a ⋯). It
 * replaces the shell's bar on the routes an app names in `pageHeaderPattern`,
 * so the business switcher and bell are not a tap from leaving half a bill.
 *
 * 58 px tall, 14 px sides, 10 px gaps; the × is a 40 px square with a 44 px
 * hit area; the title 16 px semibold, the subtitle 12 px in the tertiary ink.
 */
export interface UbTaskBarProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly onClose: () => void;
  readonly closeLabel: string;
  readonly trailing?: ReactNode;
  readonly className?: string;
}

function UbTaskBarBase({
  title,
  subtitle,
  onClose,
  closeLabel,
  trailing,
  className,
}: Readonly<UbTaskBarProps>) {
  return (
    <header
      data-testid="task-bar"
      data-print="hide"
      className={cn(
        'sticky top-0 z-30 flex h-[58px] shrink-0 items-center gap-2.5 border-b border-border-hairline bg-surface-card px-3.5',
        className
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="ub-hit grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-text-primary focus-visible:shadow-focus focus-visible:outline-none"
      >
        <X aria-hidden className="h-5 w-5" />
      </button>
      <div className="grid min-w-0 flex-1 leading-[1.25]">
        <h1 className="break-words text-base font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="break-words text-xs text-text-tertiary">{subtitle}</p>}
      </div>
      {trailing}
    </header>
  );
}

UbTaskBarBase.displayName = 'UbTaskBar';
export const UbTaskBar = memo(UbTaskBarBase);
