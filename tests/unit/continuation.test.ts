import { expect, it } from 'vitest';
import { recoverable, unrecoverable, losingPath, loadLoss, winningRescue } from '../fixtures/content8-loss';
import { BALANCE } from '../../src/domain/balance';
import { findContinue, verifiesContinue, type ContinueProof } from '../../src/domain/continuation';
import { applyReceipt, buyContinue, platformState, useContinue, type EarnedReceipt } from '../../src/domain/services';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { advance } from '../../tools/qa/gameplay-oracle';
import type { Board } from '../../src/domain/types';

const receipt: EarnedReceipt = {
  schema: 1, id: 'earned-rescue', attempt: 'loss', dealId: recoverable.id, mode: 'campaign', placement: 'continue',
};
const proof: ContinueProof = { attemptId: 'loss', deal: recoverable, path: winningRescue };

it('exhausts the full authored budget and gives an independently verified win on the last extra move', () => {
  const save = loadLoss(recoverable, 'loss');
  expect(losingPath).toHaveLength(recoverable.initial.movesLeft!);
  let oracle = recoverable.initial;
  for (const action of losingPath) oracle = advance(oracle, action, recoverable)!;
  expect(save.attempt.board).toEqual(oracle);
  expect(save.attempt.board).toMatchObject({ phase: 'exhausted', movesLeft: 0 });
  expect(findContinue(save.attempt, recoverable)).toEqual({ status: 'PROVEN_RECOVERABLE', path: winningRescue });
  expect(winningRescue).toHaveLength(10);
  expect(verifiesContinue(save.attempt, { ...proof, path: winningRescue.slice(0, 9) })).toBe(false);
  let after: Board = { ...oracle, phase: 'playing', movesLeft: 10 };
  for (const action of winningRescue) after = advance(after, action, recoverable)!;
  expect(after).toMatchObject({ phase: 'won', movesLeft: 0 });
});

it('distinguishes the search cap, a mathematical lower bound and a non-terminal board', () => {
  const impossible = loadLoss(unrecoverable, 'loss');
  expect(impossible.attempt.board.phase).toBe('exhausted');
  expect(Object.values(unrecoverable.cards).filter(card => card.leader).length).toBeGreaterThan(10);
  expect(findContinue(impossible.attempt, unrecoverable, 0)).toEqual({ status: 'UNSOLVABLE' });
  const early = content8Wave.find(deal => deal.campaignLevel === 22)!;
  const unknown = loadLoss(early, 'early');
  expect(findContinue(unknown.attempt, early, 0)).toEqual({ status: 'UNKNOWN' });
  expect(findContinue(freshSave(recoverable, 'not-exhausted').attempt, recoverable)).toEqual({ status: 'UNKNOWN' });
});

it('requires a proof for the exact attempt and preserves the earned budget through Undo', () => {
  const save = loadLoss(recoverable, 'loss');
  expect(applyReceipt(save, receipt)).toBe('applied');
  expect(save.platform?.continueCredits).toBe(1);
  expect(save.attempt.board.phase).toBe('exhausted');
  expect(useContinue(save, { ...proof, attemptId: 'old-attempt' })).toBe(false);
  expect(useContinue(save, { ...proof, path: [{ type: 'draw' }] })).toBe(false);
  expect(save.platform?.continueCredits).toBe(1);
  expect(useContinue(save, proof)).toBe(true);
  save.platform!.completedCampaign = Array.from({ length: 15 }, (_, i) => campaignId(i + 1));
  const undo = dispatch(save, { type: 'undo' }, recoverable);
  expect(undo.accepted, undo.reason).toBe(true);
  expect(undo.next.attempt.board.movesLeft).toBe(11);
  expect(undo.next.attempt.continued).toBe(true);
  expect(applyReceipt(undo.next, receipt, { continueProof: proof })).toBe('already-applied');
  expect(undo.next.platform?.continueCredits).toBe(0);
});

it('applies a matching earned receipt once and keeps a stale reward as a credit', () => {
  const save = loadLoss(recoverable, 'loss');
  applyReceipt(save, { ...receipt, id: 'old', attempt: 'other-attempt' }, { continueProof: proof });
  expect(save.platform?.continueCredits).toBe(1);
  expect(save.attempt.board.phase).toBe('exhausted');
  applyReceipt(save, receipt, { continueProof: proof });
  expect(save.attempt.board.movesLeft).toBe(10);
  expect(save.attempt.continued).toBe(true);
  applyReceipt(save, { ...receipt, id: 'duplicate-delivery' }, { continueProof: proof });
  expect(save.platform?.continueCredits).toBe(1);
  expect(useContinue(save, proof)).toBe(false);
});

it('checks the current proof and wallet, then buys the same ten-move allowance once', () => {
  const save = loadLoss(recoverable, 'loss');
  save.profile.coins = BALANCE.continueCoinPrice - 1;
  expect(buyContinue(save, proof)).toBe(false);
  expect(save.attempt.board.movesLeft).toBe(0);
  save.profile.coins = BALANCE.continueCoinPrice;
  expect(buyContinue(save, { ...proof, attemptId: 'stale' })).toBe(false);
  expect(buyContinue(save, { ...proof, path: proof.path.slice(0, -1) })).toBe(false);
  expect(save.profile.coins).toBe(BALANCE.continueCoinPrice);
  expect(buyContinue(save, proof)).toBe(true);
  expect(buyContinue(save, proof)).toBe(false);
  expect(save.profile.coins).toBe(0);
  expect(save.attempt.board.movesLeft).toBe(10);
  platformState(save).completedCampaign = Array.from({ length: 15 }, (_, i) => campaignId(i + 1));
  const undo = dispatch(save, { type: 'undo' }, recoverable);
  expect(undo.accepted, undo.reason).toBe(true);
  expect(undo.next.attempt.board.movesLeft).toBe(11);
  expect(undo.next.profile.coins).toBe(0);
});

it('preserves a video earned before a coin purchase as a stored credit without a second continuation', () => {
  const save = loadLoss(recoverable, 'loss');
  save.profile.coins = BALANCE.continueCoinPrice;
  expect(buyContinue(save, proof)).toBe(true);
  expect(applyReceipt(save, receipt, { continueProof: proof })).toBe('applied');
  expect(applyReceipt(save, { ...receipt, id: 'duplicate-earn' }, { continueProof: proof })).toBe('applied');
  expect(save.attempt.board.movesLeft).toBe(10);
  expect(save.platform?.continueCredits).toBe(1);
  expect(save.profile.coins).toBe(0);
});

it('uses an existing earned credit before purchasing and never charges a stale offer', () => {
  const save = loadLoss(recoverable, 'loss');
  save.profile.coins = BALANCE.continueCoinPrice;
  applyReceipt(save, { ...receipt, id: 'other', attempt: 'previous-attempt' });
  expect(save.platform?.continueCredits).toBe(1);
  expect(buyContinue(save, proof)).toBe(false);
  expect(save.profile.coins).toBe(BALANCE.continueCoinPrice);
  expect(useContinue(save, proof)).toBe(true);
  expect(save.platform?.continueCredits).toBe(0);
});
