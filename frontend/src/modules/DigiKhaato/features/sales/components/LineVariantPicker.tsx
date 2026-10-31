'use client';

import { UbButton, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';
import { formatQuantity } from 'src/utils/quantity';

import type { ItemListRow } from '../../inventory/types/item.types';

/**
 * D P2 — design D2: a garment line names its size and colour ("Size M · Blue")
 * and shows every size with what is in stock, so swapping M for L is one tap.
 * A size with none in stock is struck through but still tappable: the
 * business's negative-stock rule, not this picker, decides whether it sells.
 */
export function LineVariantPicker({
  current,
  variants,
  onPick,
}: Readonly<{
  current: ItemListRow;
  variants: readonly ItemListRow[];
  onPick: (row: ItemListRow) => void;
}>): React.JSX.Element | null {
  const { t } = useTranslation();
  const size = current.attributes?.size;
  const colour = current.attributes?.colour;
  const caption = [size ? t('sales.line.size', { size }) : null, colour].filter(Boolean).join(' · ');
  if (!caption) return null;
  const sizes = variants.filter((row) => row.attributes?.colour === colour);
  const colours = [
    ...new Map(
      variants
        .filter((row) => row.attributes?.size === size && row.attributes?.colour)
        .map((row) => [row.attributes?.colour as string, row])
    ).values(),
  ];
  const chip = (row: ItemListRow, label: string, stock?: string | null) => {
    const picked = row.id === current.id;
    const none = stock !== undefined && Number(stock ?? 0) <= 0;
    return (
      <UbButton
        key={row.id}
        variant={picked ? 'secondary' : 'outlineNeutral'}
        size="sm"
        onClick={() => !picked && onPick(row)}
        aria-pressed={picked}
        className={cn('h-8 rounded-full', picked && 'border-accent-line bg-accent-quiet text-text-accent')}
      >
        <UbText as="span" variant="inherit" className={cn(none && 'line-through opacity-60')}>
          {label}
        </UbText>
        {stock !== undefined && (
          <UbText as="span" variant="caption" tone="tertiary" className="ml-1">
            {formatQuantity(stock ?? '0')}
          </UbText>
        )}
      </UbButton>
    );
  };
  return (
    <UbStack gap={1} data-testid="line-variant">
      <UbText variant="caption" tone="accent">
        {caption}
      </UbText>
      {sizes.length > 1 && (
        <UbStack direction="row" gap={1.5} className="flex-wrap" aria-label={t('sales.line.sizes')}>
          {sizes.map((row) => chip(row, row.attributes?.size ?? '', row.onHand))}
        </UbStack>
      )}
      {colours.length > 1 && (
        <UbStack direction="row" gap={1.5} className="flex-wrap" aria-label={t('sales.line.colours')}>
          {colours.map((row) => chip(row, row.attributes?.colour ?? ''))}
        </UbStack>
      )}
    </UbStack>
  );
}
