'use client';

import { UbCombobox } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

/**
 * "Find a line on this bill" — its own module so the editors load it only once
 * a bill is long enough to show it (the gate measured 0.7 KB on every editor's
 * route chunk when it was imported statically).
 */
export function InvoiceLineFinder({
  options,
  onFind,
}: Readonly<{
  options: readonly { value: string; label: string }[];
  onFind: (value: string) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UbCombobox
      value={null}
      onChange={onFind}
      options={options}
      aria-label={t('sales.line.find')}
      placeholder={t('sales.line.find')}
      searchPlaceholder={t('sales.line.findSearch')}
      emptyLabel={t('sales.line.findEmpty')}
    />
  );
}
