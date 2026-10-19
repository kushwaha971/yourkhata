'use client';
import { UbAmount, UbStack, UbText } from 'src/design-system';
/** A filtered register's server totals. No extra cards, icons or hidden count. */
export function RecordTotals({
  label,
  count,
  countLabel,
  figures,
  testId,
}: Readonly<{
  label: string;
  count: number;
  countLabel: string;
  figures: readonly {
    key: string;
    label: string;
    amount: string;
    tone?: 'neutral' | 'receivable' | 'payable';
  }[];
  testId?: string;
}>): React.JSX.Element {
  return (
    <UbStack
      direction="row"
      align="baseline"
      className="flex-wrap justify-between gap-3 py-2"
      aria-label={label}
      role="status"
      data-testid={testId}
    >
      <UbText variant="body-sm" tone="secondary">
        {count} {countLabel}
      </UbText>
      <UbStack direction="row" align="baseline" className="flex-wrap gap-x-5 gap-y-2">
        {figures.map((f) => (
          <UbAmount
            key={f.key}
            value={f.amount}
            label={f.label}
            tone={f.tone ?? 'neutral'}
            size="sm"
            className="flex-row-reverse items-baseline gap-1.5"
          />
        ))}
      </UbStack>
    </UbStack>
  );
}
