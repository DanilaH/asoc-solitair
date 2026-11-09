import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { introDeal as deal } from '../src/content/intro';
import { applyBoard, assertBoard } from '../src/domain/engine';
import { RULES_VERSION, CONTENT_VERSION } from '../src/domain/types';
let board = structuredClone(deal.initial);
for (const action of deal.winningPath) {
  const result = applyBoard(board, action, deal);
  if (typeof result === 'string') throw Error(result);
  board = result.board;
  assertBoard(board, deal);
}
if (board.phase !== 'won') throw Error('Recorded path did not win');
const record = {
  dealId: deal.id, dealVersion: deal.version, rulesVersion: RULES_VERSION, contentVersion: CONTENT_VERSION,
  initialSha256: createHash('sha256').update(JSON.stringify(deal.initial)).digest('hex'),
  exactInitialState: deal.initial, winningPath: deal.winningPath, moveCount: deal.winningPath.length,
  budget: deal.initial.movesLeft, slack: board.movesLeft, replay: 'PASS', editorialStatus: deal.editorialStatus,
  independence: 'Path replay uses the game engine; card count/identity invariants are checked separately. No optimality or human-difficulty claim.',
};
await mkdir('docs/validation', { recursive: true });
await writeFile('docs/validation/intro-001.json', JSON.stringify(record, null, 2) + '\n');
console.info(`${deal.id}: PASS, ${record.moveCount} moves, slack ${record.slack}, no assistance`);
