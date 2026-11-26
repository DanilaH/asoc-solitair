import { recordReleaseLearning } from '../../src/app/c8-tutorial';
import { releaseProfile } from '../../src/config/profile';
import assert from 'node:assert/strict';
import { lesson, recordLearning } from '../../src/app/tutorial';
import { expect, it } from 'vitest';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import { applyBoard, dispatch, freshSave } from '../../src/domain/engine';
import { resolveHint } from '../../src/domain/hint';
import { campaignId, seenTutorial } from '../../src/domain/progression';
import { knownContinuation } from '../../src/domain/solver';
import { dealOrdinary } from '../../tools/content/plain-dealer';
import lineup from '../../docs/qa/content-v8/onboarding/lineup.json';
import { advance } from '../../tools/qa/gameplay-oracle';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';

function step(board: Board, command: BoardCommand, deal: Deal) {
  const result = applyBoard(board, command, deal);
  if (typeof result === 'string') throw Error(result);
  return result.board;
}

it('replays all 15 new layouts and verified recoveries with the independent oracle', () => {
  expect(content8Dealer.map(deal => deal.campaignLevel)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  for (const [index, deal] of content8Dealer.entries()) {
    const { seed, stock } = lineup.lessonRamp[index];
    const distribution = dealOrdinary(Object.keys(deal.cards), stock, deal.initial.tableau.map(pile => pile.length), seed);
    assert.deepEqual(distribution, { stock: deal.initial.stock, tableau: deal.initial.tableau });
  }
  for (const deal of content8Dealer) for (const route of [deal.winningPath, ...(deal.recoveryPaths ?? [])]) {
    let board = deal.initial;
    for (const action of route) {
      const before = board;
      board = step(board, action, deal);
      assert.deepEqual(board, advance(before, action, deal));
    }
    expect(board.phase).toBe('won');
  }
  expect(content8Dealer[4].winningPath.some(action => action.type === 'recycle')).toBe(true);
  expect(content8Dealer[5].initial.stock).toHaveLength(56);
  expect(content8Dealer[10].initial.stock).toHaveLength(62);
  expect(content8Dealer[14].initial.stock).toHaveLength(42);
}, 15000);

it('only finishes Hint training after the demonstrated move and keeps the original free claim', () => {
  const deal = content8Dealer[2];
  const save = freshSave(deal, 'hint-lesson');
  save.platform = { completedCampaign: [campaignId(1), campaignId(2)], receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0 };
  const action = deal.winningPath[0];
  const hint = dispatch(save, { type: 'hint', revision: save.revision, action }, deal);
  expect(hint.accepted).toBe(true);
  expect(hint.next.profile.hints).toBe(save.profile.hints);
  expect(hint.next.attempt.lessonHint).toEqual(action);
  expect(seenTutorial(hint.next, 'hint-practiced')).toBe(false);
  const practiced = dispatch(hint.next, action, deal);
  expect(practiced.next.attempt.lessonHint).toBeUndefined();
  expect(seenTutorial(practiced.next, 'hint-practiced')).toBe(true);
  const paid = dispatch(practiced.next, { type: 'hint', revision: practiced.next.revision, action: deal.winningPath[1] }, deal);
  expect(paid.accepted).toBe(true);
  expect(paid.next.profile.hints).toBe(save.profile.hints - 1);
});

it('finds verified large-deal hints after different opening decisions and leaves cap exhaustion unknown', () => {
  const decisions: [number, BoardCommand][] = [
    [6, { type: 'draw' }],
    [11, { type: 'transfer', from: { kind: 'tableau', index: 2 }, to: { kind: 'tableau', index: 3 } }],
    [15, { type: 'draw' }],
  ];
  for (const [level, move] of decisions) {
    const deal = content8Dealer[level - 1];
    const board = [...deal.winningPath.slice(0, 2), move].reduce((board, action) => step(board, action, deal), deal.initial);
    const originalOnly = { ...deal, recoveryPaths: [] };
    expect(knownContinuation(board, originalOnly)).toBeNull();
    expect(resolveHint(board, originalOnly, 0)).toEqual({ status: 'UNKNOWN' });
    const hint = resolveHint(board, deal);
    expect(hint.status).toBe('SOLVED');
    if (hint.status === 'SOLVED') expect(() => step(board, hint.action, deal)).not.toThrow();
  }
});

it('keeps the opening gates on an executable, budget-safe route through category, stock and planning practice', () => {
  for (const level of [1, 2, 5]) {
    const deal = content8Dealer[level - 1];
    let save = freshSave(deal, 'mandatory-' + level);
    const taught: string[] = [];
    for (const action of deal.winningPath) {
      const current = lesson(save, deal);
      expect(current?.accepts?.(action)).not.toBe(false);
      if (current?.accepts) assert.equal(current.accepts({ type: 'undo' }), false);
      if (current?.copy && current.action) taught.push(current.copy);
      const before = save.attempt.board;
      const move = dispatch(save, action, deal);
      assert(move.accepted);
      save = move.next;
      if (releaseProfile) recordReleaseLearning(save, before, action, deal, move.events);
      recordLearning(save, before, action, deal, move.events);
    }
    assert.equal(save.attempt.board.phase, 'won');
    assert(taught.length >= 3);
    if (level === 5) for (const key of ['learn:slots', 'learn:buffer', 'learn:recycle']) assert(seenTutorial(save, key));
  }
});

it('keeps required helper practice possible after an update or restart with an empty inventory', () => {
  const undoDeal = content8Dealer[3], jokerDeal = content8Dealer[7];
  const setup = (deal: Deal) => {
    const save = freshSave(deal, 'no-helpers');
    save.platform = { completedCampaign: Array.from({ length: deal.campaignLevel! - 1 }, (_, i) => campaignId(i + 1)),
      receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0 };
    return save;
  };
  let save = setup(undoDeal);
  save.profile.undos = 0;
  save = dispatch(save, undoDeal.winningPath[0], undoDeal).next;
  assert(!lesson(save, undoDeal)?.accepts?.({ type: 'draw' }));
  const undone = dispatch(save, { type: 'undo' }, undoDeal);
  assert(undone.accepted);
  assert.equal(undone.next.profile.undos, 0);
  assert.deepEqual(undone.next.attempt.board, undoDeal.initial);
  assert(seenTutorial(undone.next, 'undo-used'));

  save = setup(jokerDeal);
  save.profile.jokers = 0;
  const placed = dispatch(save, { type: 'place-joker', column: 0 }, jokerDeal);
  assert(placed.accepted);
  assert(!lesson(placed.next, jokerDeal)?.accepts?.({ type: 'draw' }));
  const action = lesson(placed.next, jokerDeal)?.action;
  assert(action);
  const used = dispatch(placed.next, action, jokerDeal);
  assert(used.accepted);
  assert.equal(used.next.profile.jokers, 0);
  assert(seenTutorial(used.next, 'joker-buffer'));
});
