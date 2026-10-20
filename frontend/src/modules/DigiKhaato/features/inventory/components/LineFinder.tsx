'use client';

import { UbCombobox } from 'src/design-system';

/**
 * "Find a line on this bill" — its own module so the editors load it only once
 * a bill is long enough to show it (the gate measured 0.7 KB on every editor's
 * route chunk when it was imported statically).
 */
export function LineFinder({
  options,
  onFind,
  labels,
}: Readonly<{
  options: readonly { value: string; label: string }[];
  onFind: (value: string) => void;
  labels: { readonly label: string; readonly search: string; readonly empty: string };
}>): React.JSX.Element {
  return (
    <UbCombobox
      value={null}
      onChange={onFind}
      options={options}
      aria-label={labels.label}
      placeholder={labels.label}
      searchPlaceholder={labels.search}
      emptyLabel={labels.empty}
    />
  );
}
