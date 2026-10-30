'use client';

import { memo, useCallback, type KeyboardEvent } from 'react';

import { UbGrid, UbPressable, UbShopKindIcon, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';

import { MAX_EXTRA_TYPES, SHOP_KIND_TILES, type BusinessType } from '../constants/businessTypes';

/**
 * B1 — "What do you sell?": the design's ten shop-kind tiles (`.tiles`,
 * `.tile`, `.tile.on`, `.tile.on2`), three columns on a phone and five from
 * `md`, as `pPick` and `dPick` draw them.
 *
 * Two modes, one grid. Picking the business's own kind is a `radiogroup`:
 * exactly one, arrows move AND select (T-PLT-03-8), only the chosen tile is in
 * the tab order. After "+ I also sell…" (`addingExtras`) the same tiles are
 * checkboxes for up to three more kinds (BP-22 §5 `shop.extra_types`), drawn
 * with the design's dashed `.tile.on2` border so the merchant can tell "what
 * I am" from "what I also sell" at a glance; the business's own tile stays
 * solid and cannot be ticked as an extra.
 */
export interface BusinessTypeGridProps {
  readonly value: BusinessType | '';
  readonly onChange: (value: BusinessType) => void;
  readonly extras?: readonly BusinessType[];
  readonly onExtrasChange?: (extras: BusinessType[]) => void;
  readonly addingExtras?: boolean;
  readonly invalid?: boolean;
  readonly describedBy?: string;
  readonly ariaLabel: string;
  readonly className?: string;
}

const KINDS = SHOP_KIND_TILES.map((tile) => tile.value);

function BusinessTypeGridBase({
  value,
  onChange,
  extras = [],
  onExtrasChange,
  addingExtras = false,
  invalid,
  describedBy,
  ariaLabel,
  className,
}: Readonly<BusinessTypeGridProps>) {
  const { t } = useTranslation();

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (addingExtras) return;
      const index = KINDS.indexOf(value as BusinessType);
      const last = KINDS.length - 1;
      let next = index < 0 ? 0 : index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        next = index >= last ? 0 : index + 1;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        next = index <= 0 ? last : index - 1;
      } else if (event.key === 'Home') {
        next = 0;
      } else if (event.key === 'End') {
        next = last;
      } else {
        return;
      }
      event.preventDefault();
      const target = KINDS[next];
      if (target) onChange(target);
    },
    [addingExtras, value, onChange]
  );

  const toggleExtra = useCallback(
    (kind: BusinessType) => {
      if (!onExtrasChange || kind === value) return;
      if (extras.includes(kind)) onExtrasChange(extras.filter((k) => k !== kind));
      else if (extras.length < MAX_EXTRA_TYPES) onExtrasChange([...extras, kind]);
    },
    [extras, onExtrasChange, value]
  );

  return (
    <UbGrid
      role={addingExtras ? 'group' : 'radiogroup'}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      onKeyDown={onKeyDown}
      columns={{ base: 3 }}
      gap={0}
      className={cn('gap-[10px] md:grid-cols-5', className)}
    >
      {SHOP_KIND_TILES.map((tile) => {
        const primary = value === tile.value;
        const extra = extras.includes(tile.value);
        const full = !extra && extras.length >= MAX_EXTRA_TYPES;
        return (
          <UbPressable
            key={tile.value}
            role={addingExtras ? 'checkbox' : 'radio'}
            aria-checked={addingExtras ? extra || primary : primary}
            aria-disabled={addingExtras && (primary || full) ? true : undefined}
            tabIndex={
              addingExtras ? 0 : primary || (!value && tile.value === KINDS[0]) ? 0 : -1
            }
            onClick={() => (addingExtras ? toggleExtra(tile.value) : onChange(tile.value))}
            data-kind={tile.value}
            className={cn(
              // design .tile: centred grid, min-height 96, radius 12, padding
              // 12 x 8, gap 6, 13 px / 600 / 1.2; .tile.on: 2 px accent, wash.
              'grid min-h-[96px] min-w-0 content-center justify-items-center gap-[6px] rounded-[12px] px-2 py-3 text-center',
              primary
                ? 'border-2 border-action bg-accent-quiet text-text-accent'
                : extra
                  ? 'border-2 border-dashed border-action bg-accent-quiet'
                  : 'border border-border-subtle bg-surface-card hover:bg-surface-hover'
            )}
          >
            <UbShopKindIcon kind={tile.picture} className="text-text-accent" />
            <UbText
              as="span"
              variant="body-sm-medium"
              className={cn(
                'text-[13px] font-semibold leading-[1.2]',
                primary && 'text-text-accent'
              )}
            >
              {t(tile.labelId)}
            </UbText>
            <UbText
              as="span"
              variant="caption"
              tone="tertiary"
              className="text-[11.5px] font-medium leading-[1.2]"
            >
              {t(tile.hintId)}
            </UbText>
          </UbPressable>
        );
      })}
    </UbGrid>
  );
}

BusinessTypeGridBase.displayName = 'BusinessTypeGrid';
export const BusinessTypeGrid = memo(BusinessTypeGridBase);
