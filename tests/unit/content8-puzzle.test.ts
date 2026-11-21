import { expect, it } from 'vitest';
import { content8PuzzleDeal as deal } from '../../src/content/campaign-v8-puzzle';
import { applyBoard, dispatch, freshSave, packet } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { platformState } from '../../src/domain/services';
import { advance } from '../../tools/qa/gameplay-oracle';
import type { Board, BoardCommand } from '../../src/domain/types';

const step = (board: Board, action: BoardCommand) => {
  const next = applyBoard(board, action, deal);
  if (typeof next === 'string') throw Error(next);
  expect(advance(board, action, deal)).toEqual(next.board);
  return next.board;
};

it('replays both winning paths and treats the joined puzzle as a normal-sized moving packet', () => {
  for (const path of [deal.winningPath, ...deal.recoveryPaths!]) {
    expect(path.reduce(step, deal.initial).phase).toBe('won');
  }
  const afterDraw = deal.winningPath.slice(0, 2).reduce(step, deal.initial);
  const unpaired: BoardCommand = { type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: 'foundation', index: 0 } };
  expect(applyBoard(afterDraw, unpaired, deal)).toContain('верхнюю половину');
  const joined = step(afterDraw, deal.winningPath[2]);
  expect(packet(joined, 1, deal)).toEqual(['kite-bottom', 'kite-top']);
});

it('requires the correct direction and restores the waste half when Undo splits a pairing', () => {
  const swapped = structuredClone(deal.initial);
  swapped.tableau[1] = ['kite-top'];
  swapped.stock = ['kite-bottom'];
  swapped.faceUp = swapped.faceUp.map(id => id === 'kite-bottom' ? 'kite-top' : id);
  const afterDraw = step(swapped, { type: 'draw' });
  expect(applyBoard(afterDraw, deal.winningPath[2], deal)).toContain('верхнюю половину');
  expect(advance(afterDraw, deal.winningPath[2], deal)).toBeNull();

  let save = freshSave(deal, 'puzzle-undo');
  platformState(save).completedCampaign = Array.from({ length: 24 }, (_, i) => campaignId(i + 1));
  for (const action of deal.winningPath.slice(0, 3)) save = dispatch(save, action, deal).next;
  const undone = dispatch(save, { type: 'undo' }, deal);
  expect(undone.accepted).toBe(true);
  expect(undone.next.attempt.board.waste).toEqual(['kite-top']);
  expect(undone.next.attempt.board.tableau[1]).toEqual(['kite-bottom']);
  const recycled = step(undone.next.attempt.board, { type: 'recycle' });
  expect(recycled.stock).toEqual(['kite-top']);
  expect(recycled.faceUp).not.toContain('kite-top');
});
