/** Close only the browser owned by this harness, without losing completed results
 * when Chromium shutdown hangs. This deadline never applies to test assertions. */
export async function closeBrowserWithDeadline(browser, timeoutMs = 5000) {
  let timer;
  try {
    const closed = await Promise.race([
      browser.close().then(() => true).catch(() => false),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
    if (!closed) console.warn('Browser cleanup exceeded its deadline; completed checks are unchanged.');
    return closed;
  } finally {
    clearTimeout(timer);
  }
}
