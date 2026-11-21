import { expect, it } from 'vitest';
import { content8BoundDeal as deal } from '../../src/content/campaign-v8-bound';
import { isBoundCard } from '../../src/domain/bound-cards';
import { applyBoard, dispatch, freshSave, placeJoker } from '../../src/domain/engine';
import { frozenLayers } from '../../src/domain/frozen-cards';
import { campaignId } from '../../src/domain/progression';
import { platformState } from '../../src/domain/services';
import { advance } from '../../tools/qa/gameplay-oracle';
import type { Board, BoardCommand } from '../../src/domain/types';

const run = (board: Board, move: BoardCommand, variant = deal) => {
  const result = applyBoard(board, move, variant);
  if (typeof result === 'string') throw Error(result);
  expect(advance(board, move, variant)).toEqual(result.board);
  return result.board;
};

it('cuts only after the scissors reach a foundation and keeps both sequences independently solvable', () => {
  const bound = 'post-word';
  const source = { type: 'transfer', from: { kind: 'tableau', index: 1 }, to: { kind: 'foundation', index: 1 } } as const;
  const target = { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'tableau', index: 1 } } as const;
  expect(applyBoard(deal.initial, source, deal)).toContain('ножницы');
  expect(applyBoard(deal.initial, target, deal)).toContain('связанную');
  expect(placeJoker(deal.initial, 1, deal)).toContain('ножницами');
  const scissorsInWaste = deal.winningPath.slice(0, 3).reduce((board, move) => run(board, move), deal.initial);
  expect(isBoundCard(scissorsInWaste, deal, bound)).toBe(true);
  expect(isBoundCard(run(scissorsInWaste, deal.winningPath[3]), deal, bound)).toBe(false);
  expect(deal.winningPath.reduce((b, m) => run(b, m), deal.initial).phase).toBe('won');
  expect(deal.recoveryPaths![0].reduce((b, m) => run(b, m), deal.initial).phase).toBe('won');
});

it('restores the bond after Undo and handles ice separately on the same board', () => {
  const combined = { ...deal, frozen: { version: 1 as const, layers: { 'garden-word': 2 } } };
  let save = freshSave(combined, 'bound-undo');
  platformState(save).completedCampaign = Array.from({ length: 23 }, (_, i) => campaignId(i + 1));
  for (const move of combined.winningPath.slice(0, 4)) {
    const next = dispatch(save, move, combined);
    expect(next.accepted).toBe(true);
    save = next.next;
  }
  expect(isBoundCard(save.attempt.board, combined, 'post-word')).toBe(false);
  expect(frozenLayers(save.attempt.board, combined, 'garden-word')).toBe(1);
  const undo = dispatch(save, { type: 'undo' }, combined);
  expect(undo.accepted).toBe(true);
  expect(isBoundCard(undo.next.attempt.board, combined, 'post-word')).toBe(true);
  expect(frozenLayers(undo.next.attempt.board, combined, 'garden-word')).toBe(2);
  expect(combined.winningPath.reduce((b, m) => run(b, m, combined), combined.initial).phase).toBe('won');
});
