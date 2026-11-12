/**
 * ADR-061 — the library's registrations into core's registries. The rebuilt
 * Library (12 Nov 2026) stands alone and registers nothing into the Shop's
 * screens (no party panel, no khata words). Kept so `src/modules/registrations.ts`
 * has one bare import per vertical (`src/tests/verticalRegistrations.test.ts`).
 */
export {};
