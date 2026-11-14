'use client';
import { UbCountLine, type UbCountLineItem } from 'src/design-system';
import { formatInr, isZeroAmount } from 'src/utils/money';
/**
 * Filtered server totals; status chips can carry the visible mobile count.
 *
 * `loading` keeps the line where it is with a shimmer in place of each figure.
 * The registers used to drop the line while a search ran and bring it back
 * when the answer came, so the table jumped up and down under the merchant's
 * thumb on every keystroke (owner, 25 Oct 2026).
 */
export function RecordTotals({
  label,
  count,
  countLabel,
  figures,
  testId,
  compactShort = false,
  countInMobileChips = false,
  loading = false,
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
  /** Avoid duplicate count chrome on short phones; status chips still show the count. */
  compactShort?: boolean;
  /** Keep the count accessible without repeating a count already visible in status chips. */
  countInMobileChips?: boolean;
  /** The figures are on their way: shimmer in place, never collapse. */
  loading?: boolean;
}>): React.JSX.Element {
  /* The design's count line: figures first, the count last ("This month ₹3,42,800
     Not paid ₹18,450 Bills 412"), and the line keeps its place while loading. */
  // Blank while loading: the grey bar keeps its width and no false zero is read out.
  const blank = '\u00A0'.repeat(8);
  const items: UbCountLineItem[] = [
    ...figures.map((f) => ({
      id: f.key,
      template: `${f.label} {amount}`,
      values: {
        amount: {
          text: loading ? blank : formatInr(f.amount),
          tone: isZeroAmount(f.amount) ? 'neutral' : (f.tone ?? 'neutral'),
        },
      },
    })),
    {
      id: 'count',
      template: `${countLabel} {count}`,
      values: { count: { text: loading ? blank : String(count) } },
      className: countInMobileChips
        ? 'max-md:sr-only'
        : compactShort
          ? 'max-md:[@media(max-height:640px)]:sr-only'
          : undefined,
    },
  ];
  return <UbCountLine items={items} label={label} loading={loading} data-testid={testId} />;
}
