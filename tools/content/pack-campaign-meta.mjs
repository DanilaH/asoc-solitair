import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const imports = [], exports = [];
for (const mode of ['campaign', 'daily']) {
  const from = `.authoring/campaign-meta/${mode}`, to = `src/content/campaign-meta-bank/${mode}`;
  const files = readdirSync(from).filter(name => /^\d+\.json$/.test(name)).sort((a, b) => parseInt(a) - parseInt(b));
  const size = mode === 'campaign' ? 8 : 20;
  assert.equal(files.length, mode === 'campaign' ? 120 : 400);
  mkdirSync(to, { recursive: true });
  const names = [];
  for (let index = 0; index < files.length; index += size) {
    const batch = files.slice(index, index + size).map((name, n) => {
      assert.equal(parseInt(name), index + n);
      return JSON.parse(readFileSync(`${from}/${name}`, 'utf8'));
    });
    const shard = String(index).padStart(3, '0'), name = mode + shard;
    names.push(name);
    imports.push(`import ${name} from './${mode}/${shard}';`);
    writeFileSync(`${to}/${shard}.ts`, 'export default ' + JSON.stringify(JSON.stringify(batch)) + ';\n');
  }
  exports.push(`export const ${mode}Shards = [${names.join(', ')}];`);
}
writeFileSync('src/content/campaign-meta-bank/index.ts', [...imports, '', ...exports, ''].join('\n'));
