/**
 * Revamp 04 §2 "keeps your place per app" — the last top-level screen a person
 * had open in each app, per business, for this tab only.
 *
 * Switching to Library opens the Library list they were on, not always its
 * home. Session storage, not local: a new tab starts at the app's home, and
 * nothing here outlives the browser session. Every read and write is guarded,
 * because storage throws in a private window and in a locked-down WebView.
 */
const key = (tenant: string, app: string): string => `yourkhata:place:${tenant}:${app}`;

export function rememberAppPlace(
  tenant: string | null,
  app: string | null,
  path: string | null
): void {
  if (!tenant || !app || !path) return;
  try {
    window.sessionStorage.setItem(key(tenant, app), path);
  } catch {
    // No storage: the switch falls back to the app's home, which is today's behaviour.
  }
}

/** Where opening `app` should land: the remembered screen, else `home`. */
export function appPlace(tenant: string | null, app: string, home: string): string {
  if (!tenant) return home;
  try {
    const saved = window.sessionStorage.getItem(key(tenant, app));
    // Only an absolute in-app path: never a URL somebody wrote into storage.
    return saved && saved.startsWith('/') && !saved.startsWith('//') ? saved : home;
  } catch {
    return home;
  }
}
