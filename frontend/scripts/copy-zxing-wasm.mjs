// ADR-064 — the iPhone camera's barcode reader (zxing-wasm, via the
// barcode-detector ponyfill) is served from our own origin, never a CDN: the
// .wasm is copied out of node_modules into public/vendor before every build.
// It is fetched only when a phone without a built-in reader opens the camera.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'node_modules/zxing-wasm/package.json'), 'utf8'));
const out = join(root, 'public/vendor');
mkdirSync(out, { recursive: true });
copyFileSync(join(root, 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'), join(out, `zxing_reader-${version}.wasm`));
console.log(`zxing_reader-${version}.wasm → public/vendor`);
