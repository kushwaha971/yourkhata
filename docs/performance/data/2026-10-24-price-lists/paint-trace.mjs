// Desktop /items/price-lists: when the skeleton goes, when the table with the
// list name paints (performance.now), and long tasks. Run with NODE_PATH=$(npm root -g).
// Found the ~300 ms Suspense hold between rows-ready and table-painted.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base='http://localhost:3000', name='QA86 Perf list';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${base}/login/email`);
await page.fill('input[type=email]', 'scale@digikhaato.test');
await page.fill('input[type=password]', 'Scale-Run-2026!');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.addInitScript((n) => {
  window.__ev = []; new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__ev.push({lt:Math.round(e.startTime),d:Math.round(e.duration)}))).observe({type:'longtask',buffered:true});
  const mo = new MutationObserver(() => {
    const els=[...document.querySelectorAll('main *')].filter(e=>e.children.length===0 && e.textContent===n);
    const vis=els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});
    const k=`${document.querySelectorAll('[aria-busy=true]').length}:${els.length}/${vis.length}/${document.querySelector('table')?'table':'-'}`;
    if (window.__ev.filter(x=>x.k).at(-1)?.k!==k) window.__ev.push({k,t:Math.round(performance.now())});
  });
  document.addEventListener('DOMContentLoaded',()=>mo.observe(document.body,{subtree:true,childList:true,attributes:true}));
}, name);
const reqs=[]; page.on('request',r=>{ if(r.url().includes('/api/')) reqs.push([Date.now(), r.url().replace(base,'')]) });
for (let i=0;i<2;i++){
  await page.goto(`${base}/items`); await page.waitForLoadState('networkidle');
  reqs.length=0; const t0=Date.now();
  await page.goto(`${base}/items/price-lists`);
  await page.getByText(name,{exact:true}).locator('visible=true').first().waitFor(); await page.waitForTimeout(1500);
  console.log('t',Date.now()-t0, JSON.stringify(await page.evaluate(()=>window.__ev)));
  console.log(reqs.map(([t,u])=>`${t-t0} ${u}`).join('\n'));
}
await b.close();
