import { expect, it } from 'vitest';
import { content8ShuffleDeal as deal } from '../../src/content/campaign-v8-shuffle';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { canShuffle, commitShuffle, shuffledStock, type ShuffleRequest } from '../../src/domain/proof-shuffle';
import { platformState } from '../../src/domain/services';
import { proveShuffle } from '../../src/game/shuffle-proof';
import { decodeSave } from '../../src/platform/storage';

function fresh() {
  const localDeal = { ...deal, id: 'shuffle-proof-test-deal' };
  const save = freshSave(localDeal, 'shuffle-proof-test-attempt');
  platformState(save).completedCampaign = Array.from({ length: 28 }, (_, i) => campaignId(i + 1));
  const request: ShuffleRequest = {
    attemptId: save.attempt.id, revision: save.revision, dealId: localDeal.id, seed: 1432,
    board: save.attempt.board, deal: localDeal,
  };
  return { save, request, deal: localDeal };
}
it('requires the exact attempt, rejects an empty or over-budget proof and never modifies a failed proposal', () => {
  const { save, request, deal } = fresh();
  const original = structuredClone(save);
  const proof = proveShuffle(request);
  expect(proof?.length).toBeGreaterThan(0);
  expect(commitShuffle(save, deal, { ...request, attemptId: 'different-attempt' }, proof!)).toBe(false);
  expect(commitShuffle(save, deal, request, [])).toBe(false);
  expect(commitShuffle(save, deal, { ...request, revision: request.revision + 1 }, proof!)).toBe(false);
  expect(proveShuffle({ ...request, board: { ...request.board, movesLeft: 1 } })).toBeNull();
  expect(save).toEqual(original);
});

it('changes only stock and persists one free use through exact replay, reload and Undo', () => {
  const { save, request, deal } = fresh();
  const before = structuredClone(save);
  const proof = proveShuffle(request)!;
  expect(commitShuffle(save, deal, request, proof)).toBe(true);
  expect(save.attempt.board.stock).toEqual(shuffledStock(before.attempt.board.stock, 1432));
  expect(save.attempt.board.stock).not.toEqual(before.attempt.board.stock);
  expect([...save.attempt.board.stock].sort()).toEqual([...before.attempt.board.stock].sort());
  expect({ ...save.attempt.board, stock: before.attempt.board.stock }).toEqual(before.attempt.board);
  expect(save.profile).toEqual(before.profile);
  const restored = decodeSave(JSON.stringify(save), deal);
  expect(restored.attempt.shuffleUsed).toBe(true);
  expect(canShuffle(restored, deal)).toBe(false);
  expect(commitShuffle(restored, deal, request, proof)).toBe(false);
  const undone = dispatch(restored, { type: 'undo' }, deal);
  expect(undone.accepted).toBe(true);
  expect(undone.next.attempt.board).toEqual(before.attempt.board);
  expect(canShuffle(undone.next, deal)).toBe(false);
  const won = proof.reduce((next, action) => dispatch(next, action, deal).next, restored);
  expect(won.attempt.board.phase).toBe('won');
});
