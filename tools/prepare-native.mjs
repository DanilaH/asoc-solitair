import { copyFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const assets = new URL('native/android/app/src/main/assets/', root);
await mkdir(assets, { recursive: true });
await copyFile(new URL('src/platform/analytics-contract.json', root), new URL('solitaire-analytics-contract.json', assets));
console.info('Prepared shared native analytics contract');
