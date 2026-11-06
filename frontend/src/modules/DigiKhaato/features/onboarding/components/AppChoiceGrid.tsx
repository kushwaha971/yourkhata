'use client';

import { memo, useCallback } from 'react';

import { Check } from 'lucide-react';

import { UbBox, UbGrid, UbPressable, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';

import { appChoiceConfig } from '../constants/appChoices';

import type { OfferedApp } from '../types/onboarding.types';

/**
 * Step 1 — "What do you want to use?" (owner, 11 Oct 2026).
 *
 * A GROUP OF CHECKBOXES, not the radiogroup the business-type tiles are: a
 * business may run one of these or several (a coaching centre with a reading
 * room and a fee book), and the control has to say so before it is touched.
 * So every tile is its own tab stop and Space toggles it, which is what a
 * checkbox does; nothing is ticked for the merchant, because a pre-ticked app
 * is an app they were given rather than one they chose.
 *
 * The tiles are the server's list in the server's order. See `appChoices.ts`
 * for why an app this file has never heard of still gets a tile.
 */
export interface AppChoiceGridProps {
  readonly apps: readonly OfferedApp[];
  readonly value: readonly string[];
  readonly onChange: (value: string[]) => void;
  readonly describedBy?: string;
  readonly ariaLabel: string;
}

function AppChoiceGridBase({
  apps,
  value,
  onChange,
  describedBy,
  ariaLabel,
}: Readonly<AppChoiceGridProps>) {
  const { t } = useTranslation();

  const toggle = useCallback(
    (code: string) => {
      // Kept in the server's order whatever order they were ticked in.
      const next = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
      onChange(apps.map((app) => app.code).filter((c) => next.includes(c)));
    },
    [apps, value, onChange]
  );

  return (
    <UbGrid
      role="group"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      columns={{ base: 1, sm: apps.length > 2 ? 3 : 2 }}
      gap={2}
    >
      {apps.map((app) => {
        const config = appChoiceConfig(app.code);
        const Icon = config.icon;
        const selected = value.includes(app.code);
        return (
          <UbPressable
            key={app.code}
            role="checkbox"
            aria-checked={selected}
            onClick={() => toggle(app.code)}
            className={cn(
              // A phone draws each app as a row — picture beside the words —
              // because four 104 px cards stacked above the shop tiles made
              // step 1 the longest screen in sign-up (B, 30 Oct 2026). From
              // sm the cards sit three across and keep their column shape.
              'relative grid min-h-[64px] grid-cols-[20px_1fr] items-start gap-x-3 gap-y-0.5 rounded-card border p-3 pr-9 text-left',
              'sm:flex sm:min-h-[104px] sm:flex-col sm:gap-1',
              selected
                ? 'border-action bg-accent-quiet'
                : 'border-border-subtle bg-surface-card [@media(hover:hover)]:hover:bg-surface-hover'
            )}
          >
            {/* The tick is the state, drawn: a tinted border alone does not
                say "chosen" to somebody who cannot tell the two tints apart. */}
            <UbBox
              aria-hidden
              className={cn(
                'absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded border',
                selected
                  ? 'border-action bg-action text-text-inverse'
                  : 'border-border-strong bg-surface-card'
              )}
            >
              {selected && <Check className="h-3.5 w-3.5" />}
            </UbBox>
            <Icon
              aria-hidden
              className={cn('row-span-2 mt-px h-5 w-5', selected ? 'text-text-accent' : 'text-text-tertiary')}
            />
            <UbText as="span" variant="body-sm-medium">
              {t(app.labelId)}
            </UbText>
            <UbText as="span" variant="caption" tone="tertiary">
              {t(config.hintId)}
            </UbText>
          </UbPressable>
        );
      })}
    </UbGrid>
  );
}

AppChoiceGridBase.displayName = 'AppChoiceGrid';
export const AppChoiceGrid = memo(AppChoiceGridBase);
