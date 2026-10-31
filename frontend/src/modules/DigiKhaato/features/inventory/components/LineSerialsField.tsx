'use client';

import { UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { ItemChipList } from './ItemChipList';

/**
 * D P3 — a tracked item's IMEI / serial numbers on a bill or purchase line,
 * one per piece, with the count the server will ask for ("1 of 2 entered").
 * Typed, pasted or scanned into the box; Enter adds the next.
 */
export function LineSerialsField({
  serials,
  qty,
  onChange,
}: Readonly<{
  serials: readonly string[];
  qty: number;
  onChange: (next: string[]) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const short = serials.length !== qty;
  return (
    <UbStack gap={1} data-testid="line-serials">
      <ItemChipList
        values={serials}
        onChange={onChange}
        label={t('items.picker.serials.label')}
        addLabel={t('items.picker.serials.add')}
        removeLabel={(value) => t('items.picker.serials.remove', { value })}
        placeholder={t('items.picker.serials.placeholder')}
        max={Math.max(qty, 1)}
        upper
        testId="line-serial"
      />
      <UbText as="span" variant="caption" tone={short ? 'warning' : 'tertiary'} data-testid="line-serials-count">
        {t('items.picker.serials.count', { entered: serials.length, total: qty })}
      </UbText>
    </UbStack>
  );
}
