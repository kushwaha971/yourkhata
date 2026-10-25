'use client';
import { UbAmount, UbSkeleton, UbStack, UbText } from 'src/design-system';
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
  columns = false,
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
  /** Two readable money columns on phones without a stack of stat cards. */
  columns?: boolean;
  /** Avoid duplicate count chrome on short phones; status chips still show the count. */
  compactShort?: boolean;
  /** Keep the count accessible without repeating a count already visible in status chips. */
  countInMobileChips?: boolean;
  /** The figures are on their way: shimmer in place, never collapse. */
  loading?: boolean;
}>): React.JSX.Element {
  return (
    <UbStack
      direction="row"
      align="baseline"
      className={`flex-wrap justify-between gap-3 py-2 ${compactShort ? 'max-md:py-1 max-md:[@media(max-height:640px)]:gap-1' : ''}`}
      aria-label={label}
      role="status"
      aria-busy={loading || undefined}
      data-testid={testId}
    >
      {/* Baseline, so the line's own baseline is the count's TEXT while the
          shimmer stands in for the number — centred, the shimmer's bottom
          edge became the baseline and the line grew 2 px on a laptop. */}
      <UbStack
        direction="row"
        align="baseline"
        className={`gap-1.5 ${
          countInMobileChips
            ? 'sr-only md:not-sr-only'
            : compactShort
              ? 'max-md:[@media(max-height:640px)]:sr-only'
              : ''
        }`}
      >
        {loading && <UbSkeleton variant="figure" className="[&>*]:w-6" />}
        <UbText variant="body-sm" tone="secondary">
          {loading ? countLabel : `${count} ${countLabel}`}
        </UbText>
      </UbStack>
      <UbStack
        direction="row"
        align="baseline"
        className={
          columns
            ? 'grid w-full grid-cols-2 gap-x-3 gap-y-2 md:flex md:w-auto md:gap-x-5'
            : compactShort
              ? // R-DEC-33: a phone's money strip keeps to one line where it can.
                'flex-wrap gap-x-3 gap-y-1 md:gap-x-5 md:gap-y-2'
              : 'flex-wrap gap-x-5 gap-y-2'
        }
      >
        {figures.map((f) =>
          loading ? (
            <UbStack key={f.key} direction="row" align="center" className="gap-1.5">
              <UbText as="span" variant="body-sm" tone="secondary">
                {f.label}
              </UbText>
              <UbSkeleton variant="figure" />
            </UbStack>
          ) : (
            <UbAmount
              key={f.key}
              value={f.amount}
              label={f.label}
              tone={f.tone ?? 'neutral'}
              size="sm"
              inline={!columns}
              className={
                columns
                  ? 'flex-col-reverse items-start gap-1 md:flex-row-reverse md:items-baseline md:gap-1.5'
                  : 'flex-row-reverse items-baseline gap-1.5'
              }
            />
          )
        )}
      </UbStack>
    </UbStack>
  );
}
