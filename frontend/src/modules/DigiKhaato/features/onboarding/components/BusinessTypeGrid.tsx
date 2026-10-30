'use client';

import { memo, useCallback, useMemo, type KeyboardEvent } from 'react';

import { UbGrid, UbPressable, UbShopKindIcon, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';

import { SHOP_KIND_TILES, WHOLESALE_TILE, type BusinessType } from '../constants/businessTypes';

/**
 * B1 — "What do you sell?": the design's shop-kind tiles (`.tiles`, `.tile`,
 * `.tile.on`), three columns on a phone and five from `md`, as `pPick` and
 * `dPick` draw them.
 *
 * A `radiogroup` of kinds: exactly one (R-DEC-64, one business is one kind),
 * arrows move AND select (T-PLT-03-8), only the chosen tile is in the tab
 * order. The Wholesale card looks like every other card (owner, 30 Oct: "don't
 * make it different") but is a switch, not a kind: with `onWholesaleChange` it
 * is a checkbox that stays lit beside the one kind it is "wholesale of".
 */
export interface BusinessTypeGridProps {
  readonly value: BusinessType | '';
  readonly onChange: (value: BusinessType) => void;
  readonly exclude?: readonly BusinessType[];
  /** R-DEC-64 — the Wholesale card as an on/off beside the kind. */
  readonly wholesale?: boolean;
  readonly onWholesaleChange?: (on: boolean) => void;
  readonly invalid?: boolean;
  readonly describedBy?: string;
  readonly ariaLabel: string;
  readonly className?: string;
}

function BusinessTypeGridBase({
  value,
  onChange,
  exclude,
  wholesale = false,
  onWholesaleChange,
  invalid,
  describedBy,
  ariaLabel,
  className,
}: Readonly<BusinessTypeGridProps>) {
  const { t } = useTranslation();
  const tiles = useMemo(
    () => SHOP_KIND_TILES.filter((tile) => !exclude?.includes(tile.value)),
    [exclude]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const kinds = tiles
        .map((tile) => tile.value)
        .filter((kind) => !(onWholesaleChange && kind === WHOLESALE_TILE));
      const index = kinds.indexOf(value as BusinessType);
      const last = kinds.length - 1;
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
      const target = kinds[next];
      if (target) onChange(target);
    },
    [tiles, value, onChange, onWholesaleChange]
  );

  return (
    <UbGrid
      role="radiogroup"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      onKeyDown={onKeyDown}
      columns={{ base: 3 }}
      gap={0}
      className={cn('gap-[10px] md:grid-cols-5', className)}
    >
      {tiles.map((tile, index) => {
        const isSwitch = Boolean(onWholesaleChange) && tile.value === WHOLESALE_TILE;
        const selected = isSwitch ? wholesale : value === tile.value;
        return (
          <UbPressable
            key={tile.value}
            role={isSwitch ? 'checkbox' : 'radio'}
            aria-checked={selected}
            tabIndex={isSwitch || selected || (!value && index === 0) ? 0 : -1}
            onClick={() => (isSwitch ? onWholesaleChange?.(!wholesale) : onChange(tile.value))}
            data-kind={tile.value}
            className={cn(
              // design .tile: centred grid, min-height 96, radius 12, padding
              // 12 x 8, gap 6, 13 px / 600 / 1.2; .tile.on: 2 px accent, wash.
              'grid min-h-[96px] min-w-0 content-center justify-items-center gap-[6px] rounded-[12px] px-2 py-3 text-center',
              selected
                ? 'border-2 border-action bg-accent-quiet'
                : 'border border-border-subtle bg-surface-card hover:bg-surface-hover'
            )}
          >
            <UbShopKindIcon kind={tile.picture} className="text-text-accent" />
            <UbText
              as="span"
              variant="body-sm-medium"
              className={cn(
                'text-[13px] font-semibold leading-[1.2]',
                selected && 'text-text-accent'
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
