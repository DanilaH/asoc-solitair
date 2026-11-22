import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import type { HitappsDirectorRecord } from '../../src/content/campaign-v8-hitapps-director';
import { adjustedMoveBudget, C8_DIFFICULTY } from '../../src/domain/difficulty';
import type { Board } from '../../src/domain/types';

type Trial = Omit<HitappsDirectorRecord, 'stock' | 'tableau' | 'budget'> & { initial: Board };
const files = process.argv.slice(2);
assert(files.length, 'Pass the authoring catalog JSON files');
const trials = (await Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8')) as Trial[]))).flat();
const order = ['tight', 'relief', 'easy'];
assert.equal(new Set(trials.map(trial => trial.baseId + ':' + trial.direction)).size, trials.length);
const primary = [...content8Wave, ...content8Late];
const entries = primary.flatMap(base => {
  const pool = trials.filter(trial => trial.baseId === base.id).sort((a, b) => order.indexOf(a.direction) - order.indexOf(b.direction));
  const baseSize = base.winningPath.length;
  const baseBudget = base.initial.movesLeft!;
  const baseSpare = baseBudget - baseSize;
  let reliefSpare = adjustedMoveBudget(baseBudget, C8_DIFFICULTY.easyPenalty, true) - baseSize;
  return pool.flatMap(({ initial, ...trial }) => {
    const spare = initial.movesLeft! - trial.route.split(' ').length;
    if (trial.direction === 'tight' && spare > baseSpare || trial.direction === 'relief' && spare < baseSpare ||
        trial.direction === 'easy' && spare < reliefSpare) return [];
    if (trial.direction === 'relief') reliefSpare = spare;
    return [{ ...trial, stock: initial.stock, tableau: initial.tableau, budget: initial.movesLeft!, level: base.campaignLevel! }];
  });
});
for (const [start, end] of [[16, 31], [32, 48], [49, 64], [65, 80]]) {
  const packed = entries.filter(row => row.level >= start && row.level <= end).map(({ level: _level, ...row }) => JSON.stringify(row));
  await writeFile(`src/content/campaign-v8-hitapps-${String(start).padStart(3, '0')}.json`, '[\n' + packed.join(',\n') + '\n]\n');
}
console.log(JSON.stringify({ generated: trials.length, admitted: entries.length, levels: new Set(entries.map(row => row.level)).size,
  directions: Object.fromEntries(order.map(direction => [direction, entries.filter(row => row.direction === direction).length])) }));
