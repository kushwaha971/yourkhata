import type { ComponentType } from 'react';

import dynamic from 'next/dynamic';

/**
 * A10 / FRD 00 PLT-X13 §7 — the client half of the dashboard-section registry.
 *
 * The server's `apps.reports.registry` decides WHICH sections a reader gets
 * (module on, codename held) and computes their data; this registry decides
 * HOW each one is drawn. A module registers its section component under the
 * same `<module>.<name>` key it registered on the server, and
 * `DashboardModuleSections` renders a section only when BOTH sides know the key
 * — a server section with no client component is skipped rather than drawn as
 * an empty box, and a client component the server did not return is never
 * shown (so no section of a switched-off module, ever).
 *
 * Every entry is `dynamic(, { ssr: false })` (10-architecture §6.8): a module's section — its
 * copy, its components — loads in its own chunk, only on the dashboard of a
 * tenant whose server response named it. Registering costs the dashboard route
 * a loader function, nothing more.
 *
 * Same rules as the server registries (ADR-042): keyed, idempotent for the same
 * entry, a different entry under a used key throws, and a reset for tests.
 */

export interface DashboardSectionProps {
  /** The section's `data` exactly as the module's server selector returned it. */
  readonly data: unknown;
  /** Drawn inside Home's Follow-ups panel: rows only, no card of its own. */
  readonly embedded?: boolean;
}

/**
 * Sections that are things to do today, drawn inside Home's Follow-ups panel
 * rather than below the register (G10: an advance order due tomorrow sat under
 * the day book while Follow-ups said "Nothing needs you right now").
 */
export const FOLLOWUP_SECTIONS: ReadonlySet<string> = new Set(['sales.advance_orders']);

export type DashboardSectionComponent = ComponentType<DashboardSectionProps>;

export interface DashboardSectionEntry {
  /** The module code the key belongs to; `nav.module.<module>` titles its group. */
  readonly module: string;
  readonly load: () => Promise<DashboardSectionComponent>;
}

interface Registered {
  readonly entry: DashboardSectionEntry;
  readonly Component: DashboardSectionComponent;
}

const KEY = /^([a-z][a-z0-9_]*)\.[a-z0-9][a-z0-9_]*$/;
const registry = new Map<string, Registered>();

export const registerDashboardSection = (key: string, entry: DashboardSectionEntry): void => {
  const match = KEY.exec(key);
  if (!match || match[1] !== entry.module) {
    throw new Error(`Dashboard section "${key}" must be "<module>.<name>" of ${entry.module}`);
  }
  const existing = registry.get(key);
  if (existing) {
    if (existing.entry.module === entry.module && existing.entry.load === entry.load) return;
    throw new Error(`Dashboard section "${key}" is registered twice`);
  }
  registry.set(key, { entry, Component: dynamic(entry.load, { ssr: false }) });
};

/** The component for a key the server returned, or `null` if no module drew it. */
export const dashboardSectionComponent = (key: string): DashboardSectionComponent | null =>
  registry.get(key)?.Component ?? null;

export const registeredDashboardSectionKeys = (): readonly string[] => [...registry.keys()];

let baseline: ReadonlyMap<string, Registered> | null = null;

/**
 * Tests only: back to what was registered when first called — never to empty,
 * so a real module's section survives a test that registered a fake.
 */
export const resetDashboardSectionsForTests = (): void => {
  baseline ??= new Map(registry);
  registry.clear();
  baseline.forEach((value, key) => registry.set(key, value));
};

// G10 — a café's advance orders, the day before (`sales.advance_orders`, server `apps/sales/apps.py`).
registerDashboardSection('sales.advance_orders', {
  module: 'sales',
  load: () => import('../sales/components/AdvanceOrdersSection').then((m) => m.AdvanceOrdersSection),
});
