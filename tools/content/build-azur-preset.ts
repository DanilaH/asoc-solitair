import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { applyBoard, assertBoard } from '../../src/domain/engine';
import { advance } from '../qa/gameplay-oracle';
import { buildAzurPresetExample } from './azur-preset-example';

const deal = buildAzurPresetExample();
let board = deal.initial;
assertBoard(board, deal);
for (const move of deal.winningPath) {
  const next = applyBoard(board, move, deal);
  if (typeof next === 'string') throw Error(next);
  assert.deepEqual(next.board, advance(board, move, deal));
  board = next.board;
}
assert.equal(board.phase, 'won');

const snapshot = JSON.stringify(deal, null, 2) + '\n';
const directory = '.authoring/azur-preset';
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/${deal.id}.json`, snapshot);
console.log(JSON.stringify({
  id: deal.id, cards: Object.keys(deal.cards).length, columns: deal.initial.tableau.map(column => column.length),
  stock: deal.initial.stock.length, moves: deal.winningPath.length, budget: deal.initial.movesLeft,
  sha256: createHash('sha256').update(snapshot).digest('hex'),
}));
