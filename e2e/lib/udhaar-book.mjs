/**
 * Puts the browser's session in the Money Book the way the app switcher does:
 * `POST /auth/switch-app`. `e2e/old-udhaar-gone.mjs` uses it to open the old
 * Udhaar addresses from a Money Book session and see that they no longer draw.
 * Returns the response status, so a harness can say why it could not go on.
 */
export async function enterUdhaarBook(page, base, app = 'khata') {
  const ctx = page.context();
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
  const res = await ctx.request.post(`${base}/api/v1/auth/switch-app`, { headers: { 'X-CSRF-Token': csrf }, data: { app } });
  return res.status();
}
