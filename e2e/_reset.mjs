import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:process.env.PW_CHROME});const c=await b.newContext();const p=await c.newPage();const B='http://localhost:3005';
await p.goto(B+'/login/email');await p.fill('input[type=email]','qa-jeweller@adcert.test');await p.fill('input[type=password]','AdCert-Test-2026!');await p.keyboard.press('Enter');await p.waitForURL(u=>!u.pathname.startsWith('/login'));
const g=await c.request.get(B+'/api/v1/tenants/current/settings');const etag=g.headers()['etag'];
const h={'X-CSRF-Token':(await c.cookies()).find(x=>x.name==='ub_csrf')?.value??'','If-Match':etag};
const r=await c.request.put(B+'/api/v1/tenants/current/settings',{headers:h,data:{values:{'shop.wholesale':{value:false},'shop.messages':{},'shop.features.jewellery':{value:true},'shop.jewel':{making_type:'pct',making_value:'',wastage_pct:'',wastage_limit_pct:'',pan_limit:'200000'}}}});console.log('reset',r.status());await b.close();
