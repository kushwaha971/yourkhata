'use client';
import { useId, useMemo } from 'react';

import { toPlotValue } from '../chartScale';
/** Compact hourly columns. Same zero baseline; current partial bucket is marked. */
export function UbCompactColumns({
  points,
  label,
}: Readonly<{
  points: readonly { key: string; label: string; amount: string; partial?: boolean }[];
  label: string;
}>): React.JSX.Element {
  const id = useId();
  const values = useMemo(() => points.map((p) => toPlotValue(p.amount)), [points]);
  const max = Math.max(0, ...values),
    min = Math.min(0, ...values);
  const range = max - min || 1;
  const y = (v: number) => 8 + ((max - v) / range) * 84;
  const step = 280 / Math.max(1, points.length);
  return (
    <svg role="img" aria-labelledby={id} viewBox="0 0 296 116" className="h-auto w-full">
      <title id={id}>{label}</title>
      <line x1="8" x2="288" y1={y(0)} y2={y(0)} className="stroke-border-subtle" />
      {points.map((p, i) => (
        <rect
          key={p.key}
          x={8 + i * step + 2}
          y={Math.min(y(values[i] ?? 0), y(0))}
          width={Math.max(1, step - 5)}
          height={Math.max(0, Math.abs(y(values[i] ?? 0) - y(0)))}
          rx="2"
          className={p.partial ? 'fill-cta' : 'fill-primary'}
        >
          <title>
            {p.label}: {p.amount}
          </title>
        </rect>
      ))}
      <text x="8" y="110" className="fill-text-secondary text-[11px]">
        {points[0]?.label}
      </text>
      <text x="288" y="110" textAnchor="end" className="fill-text-secondary text-[11px]">
        {points.at(-1)?.label}
      </text>
    </svg>
  );
}
