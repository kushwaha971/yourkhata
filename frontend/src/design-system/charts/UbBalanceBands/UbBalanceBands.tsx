import { toPlotValue } from '../chartScale';
/** Part-to-whole horizontal bands with explicit wrapping labels and exact amounts. */
export function UbBalanceBands({
  bands,
  label,
}: Readonly<{
  bands: readonly { key: string; label: string; value: string; amount: string }[];
  label: string;
}>): React.JSX.Element {
  const total = bands.reduce((sum, b) => sum + Math.max(0, toPlotValue(b.amount)), 0);
  const colors = ['bg-give', 'bg-cta', 'bg-border-subtle'];
  return (
    <div role="group" aria-label={label} className="space-y-2">
      <div aria-hidden className="flex h-2 overflow-hidden rounded-full">
        {bands.map((b, i) => (
          <div
            key={b.key}
            className={`${colors[Math.min(i, 2)]} border-r border-surface-card last:border-r-0`}
            style={{
              width: `${total ? (Math.max(0, toPlotValue(b.amount)) / total) * 100 : 100 / bands.length}%`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
        {bands.map((b) => (
          <span key={b.key} className="ds-caption text-text-secondary">
            {b.label} <strong className="ds-num">{b.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
