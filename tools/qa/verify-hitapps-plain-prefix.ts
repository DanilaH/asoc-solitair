import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dealOrdinary } from '../content/plain-dealer';

const locales = ['DA', 'DE', 'EN', 'ES', 'FR', 'IT', 'JA', 'KO', 'NL', 'PL', 'PT', 'RU', 'TR', 'ZH'];
const seeds = [0, 1, 42, 43];
const expected = 'ac7cf98c3c522a6f8593c2a98d38ccd966c130feea9f6a9948b04651b98fabf5';
const sourceXapk = '22aaff3a6d5b70f217b8feb7348538f5ab3352d4e8c766406cbddcbcd71e49f0';
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

interface Geometry {
  locale: string;
  position: number;
  stockSize: number;
  columnSizes: number[];
}
const path = process.argv[2];
if (!path) throw Error('Pass the JSON geometry export of the 188 authenticated ordinary LevelBundles');
const input = JSON.parse(readFileSync(path, 'utf8')) as { sourceXapk: string; rows: Geometry[] };
if (input.sourceXapk !== sourceXapk || !Array.isArray(input.rows) || input.rows.length !== 188)
  throw Error('Expected the pinned Hitapps XAPK and 188 ordinary geometries');

const seen = new Set<string>();
const boards: [string, number, number, string][] = [];
const order = (a: Geometry, b: Geometry) => locales.indexOf(a.locale) - locales.indexOf(b.locale) || a.position - b.position;
for (const row of input.rows.slice().sort(order)) {
  const { locale, position, stockSize, columnSizes } = row;
  const key = locale + '/' + position;
  if (!locales.includes(locale) || !Number.isInteger(position) || position < 2 || position > (locale === 'EN' ? 31 : 15) ||
    seen.has(key) || !Number.isInteger(stockSize) || stockSize < 0 || stockSize > 256 || !Array.isArray(columnSizes) ||
    columnSizes.length < 1 || columnSizes.length > 5 || columnSizes.some(n => !Number.isInteger(n) || n < 0 || n > 256))
    throw Error('Invalid or duplicate ordinary geometry ' + key);
  seen.add(key);
  const ids = Array.from({ length: stockSize + columnSizes.reduce((a, b) => a + b, 0) }, (_, index) => index);
  for (const seed of seeds) {
    const { stock, tableau } = dealOrdinary(ids, stockSize, columnSizes, seed);
    boards.push([locale, position, seed, sha({ stock_ids: stock, tableau_ids: tableau })]);
  }
}
const aggregate = sha(boards);
if (aggregate !== expected) throw Error('Pinned ordinary board aggregate mismatch: ' + aggregate);
console.log(JSON.stringify({ boards: boards.length, aggregate, proof: 'CONDITIONAL_MODEL_REPLAY' }));
