import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { measureCustomers } = await import('./revamp-customers.mjs');
const base=process.env.E2E_FRONTEND??'http://127.0.0.1:3000';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local QA only');
const out=process.env.E2E_SHOTS??'/tmp/private-udhaar-look';
mkdirSync(out,{recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROME});
const result=[];
try {
 const ctx=await browser.newContext(); const page=await ctx.newPage();
 await page.goto(base+'/login/email');await page.fill('input[type=email]','scale@digikhaato.test');await page.fill('input[type=password]','Scale-Run-2026!');await page.click('button[type=submit]');await page.waitForURL(u=>!u.pathname.startsWith('/login'));const storageState=await ctx.storageState();await ctx.close();
 for(const locale of ['en','hi'])for(const width of (locale==='en'?[390,320,1024,1280]:[320,1280]))for(const theme of ['light','dark']){
  const context=await browser.newContext({storageState,viewport:{width,height:width<768?844:800},isMobile:width<768,hasTouch:width<768});
  await context.addCookies([{name:'ub_locale',value:locale,domain:new URL(base).hostname,path:'/'},{name:'ub_theme_choice',value:theme,domain:new URL(base).hostname,path:'/'}]);const p=await context.newPage();await p.goto(base+'/khata',{waitUntil:'networkidle'});await p.getByTestId('khata-people-summary').waitFor();await p.evaluate(()=>document.fonts.ready);
  const m=await measureCustomers(p,'main');const cards=await p.getByTestId('khata-people-summary').evaluate(el=>({border:getComputedStyle(el).borderBottomWidth,cards:[...el.children].map(c=>({height:c.getBoundingClientRect().height,text:c.textContent,color:getComputedStyle(c.querySelector('[lang="en-IN"]')).color})),searches:document.querySelectorAll('main input[type=search]').length}));
  result.push({locale,width,theme,...m,cards});await p.screenshot({path:`${out}/${locale}-${width}-${theme}.png`});await context.close();
 }
} finally { writeFileSync(out+'/measurements.json',JSON.stringify(result,null,2));await browser.close();}
const failed=result.filter(r=>r.overflow||r.cut.length||r.lowContrast.length||r.cards.border!=='0px'||r.cards.cards.length!==2||r.cards.cards.some(c=>c.height<90));
console.log(JSON.stringify({frames:result.length,failures:failed},null,2));if(failed.length)process.exitCode=1;
