import { UbGrid, UbStack, UbText } from 'src/design-system';

export interface CashbookFigure {
  readonly key: string;
  readonly label: string;
  /** Already formatted: "₹12,40,378.00". */
  readonly value: string;
  /** "as on 01/10/2026", "in this period", or the negative-closing warning. */
  readonly caption: string;
  readonly tone?: 'success' | 'error';
}

/**
 * 08 §11 — Opening · In · Out · Closing, always visible: these four figures
 * are what the merchant opens the cash book for, so they are not folded into
 * a "Details" line the way a list's summary is.
 *
 * One ruled box: 2 × 2 on a phone, one line of four from `lg`. The rules are
 * the 1 px gap showing the hairline behind the cells. Each figure sits on its
 * own line under its label, so ₹12,40,378.00 has a whole half-width to fit in
 * at 320 px, and the caption wraps under it rather than cutting.
 */
export function CashbookFigures({
  figures,
  label,
}: Readonly<{ figures: readonly CashbookFigure[]; label: string }>): React.JSX.Element {
  return (
    <UbGrid
      columns={{ base: 2, lg: 4 }}
      role="group"
      aria-label={label}
      className="gap-px overflow-hidden rounded-lg border border-border-hairline bg-border-hairline"
      data-testid="cashbook-figures"
    >
      {figures.map((figure) => (
        <UbStack key={figure.key} gap={0.5} className="min-w-0 bg-surface-card px-3 py-2.5">
          <UbText as="span" variant="label" tone="secondary">
            {figure.label}
          </UbText>
          <UbText
            as="span"
            variant="metric-sm"
            tone={figure.tone ?? 'primary'}
            className="ds-num whitespace-nowrap"
            data-testid={`cashbook-figure-${figure.key}`}
          >
            {figure.value}
          </UbText>
          <UbText as="span" variant="caption" tone={figure.tone === 'error' ? 'error' : 'tertiary'}>
            {figure.caption}
          </UbText>
        </UbStack>
      ))}
    </UbGrid>
  );
}
