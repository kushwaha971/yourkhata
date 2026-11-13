/**
 * The shared person page (`/parties/{id}`) reads the open app's book (DEC-019).
 * The old `/khata` list, which these harnesses opened to put the session in the
 * Udhaar book, went with the Money Book rebuild (12 Nov 2026), so the session is
 * moved there the way the app switcher does it: `POST /auth/switch-app`.
 * Returns the response status, so a harness can say why it could not go on.
 */
export async function enterUdhaarBook(page, base) {
  const ctx = page.context();
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
  const res = await ctx.request.post(`${base}/api/v1/auth/switch-app`, { headers: { 'X-CSRF-Token': csrf }, data: { app: 'khata' } });
  return res.status();
}
