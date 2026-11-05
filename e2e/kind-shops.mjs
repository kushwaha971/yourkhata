// One local test shop per business kind, for the design measure and sweep. Writes each
// generated login to /tmp/e2e-shots/kind-shops.json; never run against anything but a local stack.
import { mkdirSync, writeFileSync } from 'node:fs';
import { addBusiness, addParty, newUser, must } from './lib/fixtures.mjs';

const KINDS = { medical: 'medical', mobile: 'electronics', garments: 'garments', hardware: 'hardware', auto: 'auto_parts', wholesale: 'wholesale', cafe: 'food', other: 'other' };
const out = {};
for (const [design, type] of Object.entries(KINDS)) {
  const user = await newUser({ name: `QA ${design}`, prefix: `qa-kind-${design}` });
  await addBusiness(user, { shop: `QA ${design}`, type });
  await addParty(user.token, { name: `Ramesh Patil ${design}`, mobile: undefined });
  out[design] = { email: user.email, password: user.password, type };
  console.log(design, type, user.email);
}
mkdirSync('/tmp/e2e-shots', { recursive: true });
writeFileSync('/tmp/e2e-shots/kind-shops.json', JSON.stringify(out, null, 1));
