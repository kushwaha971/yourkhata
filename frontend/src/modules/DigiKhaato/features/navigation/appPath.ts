import type { AppManifest } from './appManifest';

/** The owning app of an unambiguous route; shared person pages use the session app. */
export const matchAppPath = (pathname: string | null, manifests: readonly AppManifest[]): string | null =>
  (pathname && manifests.find((app) => app.routePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)))?.code) || null;
