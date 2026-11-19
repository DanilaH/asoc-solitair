import assert from 'node:assert/strict';
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
