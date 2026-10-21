'use client';
import { UbAmount, UbStack, UbText } from 'src/design-system';
/** A filtered register's server totals. No extra cards, icons or hidden count. */
export function RecordTotals({
  label,
  count,
  countLabel,
  figures,
  testId,
  columns = false,
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
  /** Two readable money columns on phones without a stack of stat cards. */
  columns?: boolean;
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
      <UbStack
        direction="row"
        align="baseline"
        className={
          columns
            ? 'grid w-full grid-cols-2 gap-x-3 gap-y-2 md:flex md:w-auto md:gap-x-5'
            : 'flex-wrap gap-x-5 gap-y-2'
        }
      >
        {figures.map((f) => (
          <UbAmount
            key={f.key}
            value={f.amount}
            label={f.label}
            tone={f.tone ?? 'neutral'}
            size="sm"
            className={
              columns
                ? 'flex-col-reverse items-start gap-1 md:flex-row-reverse md:items-baseline md:gap-1.5'
                : 'flex-row-reverse items-baseline gap-1.5'
            }
          />
        ))}
      </UbStack>
    </UbStack>
  );
}
