import type { AccessLevel, AccessPart } from '../types/accessGroup.types';

type Translate = (id: string, values?: Record<string, string | number>) => string;

/**
 * "Full: Sales, Payments · View only: Stock · Off: Purchases" — what a group
 * lets its members do, grouped by level so every part is named exactly once
 * and nothing has to be cut to fit a row.
 */
export const accessSummary = (
  t: Translate,
  parts: readonly AccessPart[],
  levels: Readonly<Record<string, AccessLevel>>
): string => {
  const by: Record<AccessLevel, string[]> = { full: [], view: [], off: [] };
  for (const p of parts) by[levels[p.part] ?? 'full'].push(t(`team.access.part.${p.part}.short`));
  return (['full', 'view', 'off'] as const)
    .filter((level) => by[level].length > 0)
    .map((level) => `${t(`team.access.level.${level}`)}: ${by[level].join(', ')}`)
    .join(' · ');
};
