import type { Category, Unit } from '../types/item.types';

/**
 * 09 §8.5 — the categories and units page is "find → add": a merchant types
 * what they are looking for, and when it is not there the same words become
 * the new row. These are the pure halves of that, shared by the page, the add
 * dialog's "Already exists" check and the tests.
 */

/** Case and spacing do not make a different name: "Dry  Fruits" is "dry fruits". */
export const masterKey = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');

/**
 * Categories whose name, or a child's name, holds the query. A parent stays
 * when only a child matches, so the child is shown where it lives; a parent
 * that matches keeps all its children.
 */
export const filterCategories = (
  categories: readonly Category[],
  query: string
): readonly Category[] => {
  const q = masterKey(query);
  if (!q) return categories;
  return categories.flatMap((parent) => {
    if (masterKey(parent.name).includes(q)) return [parent];
    const children = parent.children.filter((child) => masterKey(child.name).includes(q));
    return children.length ? [{ ...parent, children }] : [];
  });
};

/** Units whose code or name holds the query. */
export const filterUnits = (units: readonly Unit[], query: string): readonly Unit[] => {
  const q = masterKey(query);
  if (!q) return units;
  return units.filter(
    (unit) => masterKey(unit.code).includes(q) || masterKey(unit.name).includes(q)
  );
};

/** The standard GST units first (locked), then the shop's own, as 09 §8.5 lays them out. */
export const splitUnits = (
  units: readonly Unit[]
): { readonly standard: readonly Unit[]; readonly own: readonly Unit[] } => ({
  standard: units.filter((unit) => unit.isSystem),
  own: units.filter((unit) => !unit.isSystem),
});

/**
 * A category of this name already sits beside the new one (same parent). The
 * server would hand the existing row back rather than make a second; saying
 * "Already exists" first tells the merchant why nothing new appeared.
 */
export const categoryExists = (
  categories: readonly Category[],
  name: string,
  parentId: string | null
): boolean => {
  const key = masterKey(name);
  if (!key) return false;
  const siblings = parentId
    ? (categories.find((parent) => parent.id === parentId)?.children ?? [])
    : categories;
  return siblings.some((row) => masterKey(row.name) === key);
};

/** Unit codes are unique across the standard list and the shop's own. */
export const unitCodeExists = (units: readonly Unit[], code: string): boolean => {
  const key = masterKey(code);
  return Boolean(key) && units.some((unit) => masterKey(unit.code) === key);
};

/** What the search box seeds the add dialog with: a short code, or a name. */
export const unitSeed = (query: string): { readonly code: string; readonly name: string } => {
  const text = query.trim();
  return /^[A-Za-z0-9]{1,8}$/.test(text)
    ? { code: text.toUpperCase(), name: '' }
    : { code: '', name: text };
};
