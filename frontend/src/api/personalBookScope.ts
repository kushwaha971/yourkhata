/** Explicit private-book namespace. A client app choice never selects an owner:
 * the server derives ownership exclusively from the authenticated user. */
export function personalBookUrl(url: string | undefined, app: string | null | undefined): string | undefined {
  if (!url || app !== 'khata' || url.startsWith('/personal/')) return url;
  if (!/^\/(?:parties|ledger-entries|ledger|reminders)(?:\/|\?|$)/.test(url)) return url;
  const query = url.split('?')[1];
  if (new URLSearchParams(query).get('book') === 'shop') return url;
  return `/personal${url}`;
}
