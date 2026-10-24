/**
 * 09 §10.0 — a report's rows on a phone, grouped under a band per date, in the
 * order the server sent them. Shared by the day book and the registers.
 */
export const groupByDate = <T extends { readonly date: string }>(
  rows: readonly T[]
): readonly { readonly date: string; readonly rows: readonly T[] }[] => {
  const groups: { date: string; rows: T[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.date) last.rows.push(row);
    else groups.push({ date: row.date, rows: [row] });
  }
  return groups;
};
