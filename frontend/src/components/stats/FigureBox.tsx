import { UbGrid, UbStack, UbText } from 'src/design-system';

export interface Figure {
  readonly key: string;
  readonly label: string;
  /** Already formatted: "₹12,40,378.00". */
  readonly value: string;
  /** "as on 01/10/2026", "in this period", or a warning about the figure. */
  readonly caption: string;
  readonly tone?: 'success' | 'error';
}

/**
 * The answer a screen is opened for, always visible (08 §11, 09 §10.0): the
 * cash book's Opening · In · Out · Closing and a report's figure line. Not
 * folded into a "Details" line the way a list's summary is, because these
 * figures ARE the screen's answer.
 *
 * One ruled box: 2 × 2 on a phone, one line from `lg` (four, or two when only
 * two figures are given). The rules are the 1 px gap showing the hairline
 * behind the cells. Each figure sits on its own line under its label, so
 * ₹12,40,378.00 has a whole half-width to fit in at 320 px, and the caption
 * wraps under it rather than cutting.
 */
export function FigureBox({
  figures,
  label,
  testId,
  figureTestId,
}: Readonly<{
  figures: readonly Figure[];
  label: string;
  /** The box's test id; `figureTestId` prefixes each figure's ("x-in"). */
  testId?: string;
  figureTestId?: string;
}>): React.JSX.Element {
  return (
    <UbGrid
      columns={{ base: 2, lg: figures.length > 2 ? 4 : 2 }}
      role="group"
      aria-label={label}
      className="gap-px overflow-hidden rounded-lg border border-border-hairline bg-border-hairline"
      data-testid={testId}
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
            data-testid={figureTestId ? `${figureTestId}-${figure.key}` : undefined}
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
