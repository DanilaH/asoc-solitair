import { expect, it } from 'vitest';
import { assertBoard, freshAttempt } from '../../src/domain/engine';
import type { Card, Deal } from '../../src/domain/types';
import { magnetHint, useTrialMagnet, type MagnetTrial } from '../../tools/content/unico-magnet-trial';

function card(id: string, category: string, leader = false): Card {
  return { id, category, leader, text: id, explanation: id };
}

const cards = [card('A', 'a', true), card('a1', 'a'), card('a2', 'a'), card('B', 'b', true), card('b1', 'b'), card('b2', 'b')];
const deal: Deal = {
  id: 'magnet-trial-1', version: 1, title: 'Trial', editorialStatus: 'test', winningPath: [],
  cards: Object.fromEntries(cards.map(value => [value.id, value])),
  initial: { rulesVersion: 3, tableau: [['B']], foundations: [['A'], []], stock: ['b2'], waste: ['a1', 'a2', 'b1'],
    collected: [], faceUp: ['A', 'a1', 'a2', 'B', 'b1'], phase: 'playing', movesLeft: 8 },
};
const trial = (): MagnetTrial => ({ version: 1, attempt: freshAttempt(deal, 'attempt-1') });

it('moves the nearest legal buried member, preserves the remaining waste and records one undo snapshot', () => {
  const before = trial();
  const hint = magnetHint(before, deal, 0)!;
  expect(hint.card).toBe('a2');
  const result = useTrialMagnet(before, deal, hint);
  expect(result.attempt.board.waste).toEqual(['a1', 'b1']);
  expect(result.attempt.board.foundations[0]).toEqual(['a2', 'A']);
  expect(result.attempt.board.stock).toEqual(['b2']);
  expect(result.attempt.board.movesLeft).toBe(7);
  expect(result.attempt.undo).toEqual([before.attempt.board]);
  expect(result.receipt).toEqual({ scheme: 'magnet-trial-v1', attemptId: 'attempt-1', dealId: deal.id, card: 'a2' });
  assertBoard(result.attempt.board, deal);
  expect(before.attempt.board.waste).toEqual(['a1', 'a2', 'b1']);
  expect(magnetHint({ ...result, receipt: undefined }, deal, 0)?.card).toBe('a1');

  const reloaded = JSON.parse(JSON.stringify(result)) as MagnetTrial;
  expect(useTrialMagnet(reloaded, deal, hint)).toBe(reloaded);
  reloaded.attempt.board = reloaded.attempt.undo.pop()!;
  expect(reloaded.attempt.board).toEqual(before.attempt.board);
  expect(magnetHint(reloaded, deal, 0)).toBeUndefined();
});

it('skips an illegal ordered rank; empty slots, ordinary top transfers and legacy saves remain outside trial', () => {
  const ordered = { ...deal, cards: { ...deal.cards, A: { ...deal.cards.A, ordered: true },
    a1: { ...deal.cards.a1, ordered: true, rank: 1 }, a2: { ...deal.cards.a2, ordered: true, rank: 2 } } };
  const before = trial();
  expect(magnetHint(before, ordered, 0)?.card).toBe('a1');
  expect(magnetHint(before, deal, 1)).toBeUndefined();
  expect(magnetHint(before, deal, -1)).toBeUndefined();
  before.attempt.board.waste = ['b1', 'a1'];
  expect(magnetHint(before, deal, 0)).toBeUndefined();
  before.attempt.board.rulesVersion = 2;
  before.attempt.board.waste = ['a1', 'b1'];
  expect(magnetHint(before, deal, 0)).toBeUndefined();
});

it('rejects stale attempts, changed budgets or a forged card without mutating the trial', () => {
  const before = trial();
  const hint = magnetHint(before, deal, 0)!;
  expect(useTrialMagnet(before, deal, { ...hint, card: 'a1' })).toBe(before);
  expect(useTrialMagnet(before, deal, { ...hint, attemptId: 'parked' })).toBe(before);
  expect(useTrialMagnet(before, { ...deal, id: 'other' }, hint)).toBe(before);
  before.attempt.board.movesLeft = 1;
  expect(useTrialMagnet(before, deal, hint)).toBe(before);
  before.attempt.board.movesLeft = 0;
  before.attempt.board.phase = 'exhausted';
  expect(magnetHint(before, deal, 0)).toBeUndefined();
});
