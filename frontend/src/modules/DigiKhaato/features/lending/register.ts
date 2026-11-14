/**
 * ADR-061 — the lending vertical's registrations into core's registries. The
 * rebuilt Loans & Collections (12 Nov 2026) stands alone and registers nothing
 * into the Shop's screens. Kept so `src/modules/registrations.ts` has one bare
 * import per vertical (`src/tests/verticalRegistrations.test.ts`).
 */
export {};
