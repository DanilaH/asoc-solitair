import { expect, it, vi } from 'vitest';
import { content8StarterDeal as deal } from '../../src/content/campaign-v8-starter';
import { applyBoard, dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { platformState } from '../../src/domain/services';
import { traceStarterBoosterFinal } from '../../tools/content/starter-booster-final';
import { advance } from '../../tools/qa/gameplay-oracle';
import type { Board, BoardCommand } from '../../src/domain/types';

const step = (board: Board, move: BoardCommand): Board => {
  const next = applyBoard(board, move, deal);
  if (typeof next === 'string') throw Error(next);
  expect(advance(board, move, deal)).toEqual(next.board);
  return next.board;
};

it('uses a fresh Unity seed only after Final and only for the resolved nonempty selection', () => {
  const range = vi.fn(() => 41);
  expect(traceStarterBoosterFinal(false, [3], range).status).toBe('PRE_FINAL');
  expect(traceStarterBoosterFinal(true, [], range).status).toBe('SKIPPED');
  expect(range).not.toHaveBeenCalled();
  expect(traceStarterBoosterFinal(true, [3, 4, 3], range)).toEqual({
    status: 'CONDITIONAL_SOURCE_MODEL', seed: 41, placement: 'ORIGINAL_STOCK_PLACEMENT_UNKNOWN',
    boosters: [{ selectedId: 3, booster: 'magnet', sourceCardType: 5 }, { selectedId: 4, booster: 'hammer', sourceCardType: 6 }],
  });
  expect(range).toHaveBeenCalledExactlyOnceWith(0, 2147483647);
  expect(() => traceStarterBoosterFinal(true, [3], () => 2147483647)).toThrow('Unity booster seed');
});

it('pulls one matching card with the magnet and reveals a distinct hidden card with the hammer', () => {
  const readyMagnet = deal.winningPath.slice(0, 2).reduce(step, deal.initial);
  expect(readyMagnet.stock).toEqual(['hammer-word', 'copper']);
  const pulled = step(readyMagnet, deal.winningPath[2]);
  expect(pulled.waste).toEqual(['copper']);
  expect(pulled.stock).toEqual(['hammer-word']);
  expect(pulled.movesLeft).toBe(readyMagnet.movesLeft! - 1);
  const readyHammer = deal.winningPath.slice(3, 6).reduce(step, pulled);
  expect(readyHammer.faceUp).not.toContain('nail');
  const hammered = step(readyHammer, deal.winningPath[6]);
  expect(hammered.faceUp).toContain('nail');
  expect(hammered.tableau).toEqual(readyHammer.tableau);
  for (const path of [deal.winningPath, ...deal.recoveryPaths!]) expect(path.reduce(step, deal.initial).phase).toBe('won');
});

it('undoes the magnet and its stock movement in one snapshot', () => {
  let save = freshSave(deal, 'starter-test-undo');
  platformState(save).completedCampaign = Array.from({ length: 27 }, (_, i) => campaignId(i + 1));
  for (const action of deal.winningPath.slice(0, 3)) save = dispatch(save, action, deal).next;
  save = dispatch(save, { type: 'undo' }, deal).next;
  expect(save.attempt.board.waste).toEqual(['iron']);
  expect(save.attempt.board.stock).toEqual(['hammer-word', 'copper']);
  save = dispatch(save, deal.winningPath[2], deal).next;
  expect(save.attempt.board.waste).toEqual(['copper']);
  expect(save.attempt.board.stock).toEqual(['hammer-word']);
});
