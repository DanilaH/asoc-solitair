import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import { applyBoard, legalCommands } from '../../src/domain/engine';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import type { Board, BoardCommand } from '../../src/domain/types';
import { advance } from './gameplay-oracle';

const evidence = [];
for (const level of [5, 6, 11, 15]) {
  const deal = content8Dealer[level - 1], witness = deal.winningPath;
  function play(board: Board, action: BoardCommand) {
    const next = applyBoard(board, action, deal);
    assert(typeof next !== 'string');
    assert.deepEqual(next.board, advance(board, action, deal));
    return next.board;
  }
  function preceding(index: number) { return witness.slice(0, index).reduce(play, deal.initial); }
  let miss;
  // Try later discard choices first, where recovery remains easy for an unaided player.
  let tried = 0;
  for (let i = witness.length - 1; i >= 0 && tried < 12; i--) {
    const intended = witness[i];
    if (intended.type !== 'transfer' || intended.from.kind !== 'waste' || intended.to.kind !== 'foundation') continue;
    const before = preceding(i);
    if (!before.stock.length) continue;
    const after = play(before, { type: 'draw' });
    tried++;
    const recovery = findReferenceRoute(deal, after, 750);
    if (recovery.status !== 'FOUND' || !recovery.path.some(move => move.type === 'recycle')) continue;
    const extra = i + 1 + recovery.path.length - witness.length;
    if (extra < 1 || extra > 9) continue;
    assert.equal(recovery.path.reduce(play, after).phase, 'won');
    const covered = before.waste.at(-1)!;
    miss = { step: i + 1, covered: deal.cards[covered].text, covering: deal.cards[after.waste.at(-1)!].text,
      extra, remaining: after.movesLeft, recycleAt: recovery.path.findIndex(move => move.type === 'recycle') + i + 2,
      path: [...witness.slice(0, i), { type: 'draw' }, ...recovery.path] };
    break;
  }
  const start = Math.floor(witness.length * .65);
  let board = preceding(start);
  const failPath = witness.slice(0, start);
  while (board.phase === 'playing') {
    const action = legalCommands(board, deal).find(action => action.type === 'draw' || action.type === 'recycle');
    assert(action);
    failPath.push(action);
    board = play(board, action);
  }
  assert.equal(board.phase, 'exhausted');
  evidence.push({ level, miss: miss ?? 'NOT FOUND', exhaustion: { fromStep: start + 1, draws: failPath.slice(start).filter(x => x.type === 'draw').length,
    recycles: failPath.slice(start).filter(x => x.type === 'recycle').length, path: failPath } });
  await writeFile('.authoring/content8-onboarding/consequences.json', JSON.stringify(evidence, null, 2) + '\n');
}
for (const { level, miss, exhaustion } of evidence)
  console.log({ level, miss: typeof miss === 'string' ? miss : { ...miss, path: miss.path.length },
    exhaustion: { ...exhaustion, path: exhaustion.path.length } });
