import { expect, it } from 'vitest';
import { introDeal } from '../../src/content/intro';
import { withCurrentRules } from '../../src/content/current-rules';
import { applyBoard, freshAttempt } from '../../src/domain/engine';
import { loadLoss, recoverable, winningRescue } from '../fixtures/content8-loss';
import { activateTrialUnlimited, observeTrialUnlimited, settleTrialRevive, stockRestorePrice, trialReviveOffer, trialStockRecycle,
  trialUnlimitedMove } from '../../tools/content/recovery-trial';

it('requires a distinct finite right before restoring stock and preserves the ordinary Rules3 behavior', () => {
  const deal = { ...withCurrentRules(introDeal), id: 'stock-trial-v1' };
  let board = freshAttempt(deal, 'stock').board;
  while (board.stock.length) {
    const next = applyBoard(board, { type: 'draw' }, deal);
    if (typeof next === 'string') throw Error(next);
    board = next.board;
  }
  const attempt = { ...freshAttempt(deal, 'stock'), board };
  const state = { rules: { version: 1 as const, freeRecycles: 1, restoreBase: 12, restoreIncrement: 3 },
    attempt, recycles: 0, restores: 0, coins: 15 };
  expect(stockRestorePrice(state)).toBeUndefined();
  const first = trialStockRecycle(state, deal, 'ordinary');
  expect(first).toMatchObject({ recycles: 1, restores: 0, coins: 15 });
  expect(first.attempt.board.stock).toEqual(board.waste);
  expect(first.attempt.undo).toEqual([board]);
  expect(first.attempt.board.movesLeft).toBe(board.movesLeft! - 1);

  const later = { ...first, attempt };
  expect(trialStockRecycle(later, deal, 'ordinary')).toBe(later);
  expect(typeof applyBoard(board, { type: 'recycle' }, deal)).toBe('object');
  expect(stockRestorePrice(later)).toBe(0);
  const trial = trialStockRecycle(later, deal, 'restore', 0);
  expect(trial).toMatchObject({ recycles: 1, restores: 1, coins: 15 });
  const encore = { ...trial, attempt };
  expect(stockRestorePrice(encore)).toBe(12);
  expect(trialStockRecycle(encore, deal, 'restore', 0)).toBe(encore);
  const paid = trialStockRecycle(encore, deal, 'restore', 12);
  expect(paid).toMatchObject({ restores: 2, coins: 3 });
  const unaffordable = { ...paid, attempt };
  expect(stockRestorePrice(unaffordable)).toBe(15);
  expect(trialStockRecycle(unaffordable, deal, 'restore', 15)).toBe(unaffordable);
});

it('quotes segmented revive only for known cohorts with a proven outcome and clean cooldown/cap', () => {
  const policy = { version: 1 as const, revision: 'test', enabled: true, minLevel: 16, cooldownMs: 30, dailyCap: 1,
    options: { payer: { coins: 15, coinMoves: 10, videoMoves: 9 }, nonpayer: { coins: 24, coinMoves: 8, videoMoves: 10 } } };
  const attempt = loadLoss(recoverable, 'revive').attempt;
  const context = { attempt, now: 200, segment: 'payer' as const, history: [] };
  const offer = trialReviveOffer(policy, context, recoverable, 'coins', winningRescue);
  expect(offer).toMatchObject({ attemptId: 'revive', cost: 15, moves: 10 });
  expect(trialReviveOffer({ ...policy, enabled: false }, context, recoverable, 'coins', winningRescue)).toBeUndefined();
  expect(trialReviveOffer(policy, { ...context, segment: undefined }, recoverable, 'coins', winningRescue)).toBeUndefined();
  expect(trialReviveOffer(policy, { ...context, history: [{ attemptId: 'past', at: 50 }] }, recoverable, 'coins', winningRescue)).toBeUndefined();
  expect(trialReviveOffer({ ...policy, dailyCap: 2 }, { ...context, history: [{ attemptId: 'past', at: 199 }] }, recoverable, 'coins', winningRescue)).toBeUndefined();
  expect(trialReviveOffer(policy, context, recoverable, 'coins', winningRescue.slice(0, 9))).toBeUndefined();
  expect(trialReviveOffer(policy, context, recoverable, 'video', winningRescue)).toBeUndefined();
  expect(trialReviveOffer(policy, { ...context, segment: 'nonpayer' }, recoverable, 'video', winningRescue)).toMatchObject({ cost: 0, moves: 10 });
  const coinTrial = { ...context, coins: 25 };
  const confirm = { kind: 'coins' as const, offerId: offer!.id };
  expect(settleTrialRevive(coinTrial, policy, recoverable, winningRescue.slice(1), confirm)).toBe(coinTrial);
  const accepted = settleTrialRevive(coinTrial, policy, recoverable, winningRescue, confirm);
  expect(accepted.coins).toBe(10);
  expect(accepted.attempt).toMatchObject({ board: { movesLeft: 10, phase: 'playing' }, continued: true });
  expect(settleTrialRevive(accepted, policy, recoverable, winningRescue, confirm)).toBe(accepted);
  const videoTrial = { ...coinTrial, segment: 'nonpayer' as const };
  const videoOffer = trialReviveOffer(policy, videoTrial, recoverable, 'video', winningRescue)!;
  expect(settleTrialRevive(videoTrial, policy, recoverable, winningRescue,
    { kind: 'video', offerId: videoOffer.id, earnedReceiptId: '' })).toBe(videoTrial);
  const earned = settleTrialRevive(videoTrial, policy, recoverable, winningRescue,
    { kind: 'video', offerId: videoOffer.id, earnedReceiptId: 'fake-for-trial' });
  expect(earned.history).toEqual([{ attemptId: 'revive', at: 200, receiptId: 'fake-for-trial' }]);
  expect(earned.coins).toBe(videoTrial.coins);

});

it('binds timed unlimited to one attempt, persists elapsed time and restores finite budgets without reactivation', () => {
  const attempt = freshAttempt(introDeal, 'unlimited'), state = { version: 1 as const, attempt, observedAt: 4, used: [] };
  const grant = { id: 'qa-time', attemptId: attempt.id, dealId: introDeal.id, term: 'time' as const, until: 10 };
  expect(activateTrialUnlimited(state, { ...grant, attemptId: 'other' }, 5)).toBe(state);
  const active = activateTrialUnlimited(state, grant, 5);
  expect(active.attempt.board.movesLeft).toBeNull();
  const progress = trialUnlimitedMove(active, 8, introDeal, introDeal.winningPath[0]);
  expect(progress.attempt.board.movesLeft).toBeNull();
  expect(trialUnlimitedMove(progress, 7, introDeal, { type: 'undo' })).toBe(progress);
  const undone = trialUnlimitedMove(progress, 9, introDeal, { type: 'undo' });
  expect(undone.attempt.board).toEqual(active.attempt.board);
  const reloaded: typeof progress = JSON.parse(JSON.stringify(progress));
  const ended = observeTrialUnlimited(reloaded, 10);
  expect(ended.attempt.board.movesLeft).toBe(attempt.board.movesLeft);
  expect(ended.attempt.undo).toEqual([attempt.board]);
  expect(ended.active).toBeUndefined();
  expect(activateTrialUnlimited(ended, { ...grant, until: 100 }, 11)).toBe(ended);
  expect(observeTrialUnlimited(ended, 7)).toBe(ended);
});

it('supports a genuine unlimited attempt from exhausted to won and never changes the originating finite attempt', () => {
  const attempt = loadLoss(recoverable, 'all').attempt;
  const before = { version: 1 as const, attempt, used: [], observedAt: 0 };
  let current = activateTrialUnlimited(before, { id: 'qa-attempt', attemptId: attempt.id, dealId: attempt.dealId, term: 'attempt' }, 1);
  for (const action of winningRescue) current = trialUnlimitedMove(current, 2, recoverable, action);
  expect(current.attempt.board).toMatchObject({ movesLeft: null, phase: 'won' });
  expect(trialUnlimitedMove(current, 2, recoverable, { type: 'undo' })).toBe(current);
  expect(attempt.board).toMatchObject({ movesLeft: 0, phase: 'exhausted' });
});
