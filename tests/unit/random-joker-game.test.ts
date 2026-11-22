import { expect, it, vi } from 'vitest';
import { findDeal } from '../../src/content/campaign';
import { placeRandomJoker, proveRandomJoker, settleRandomJoker } from '../../src/domain/random-joker';
import { advance } from '../../tools/qa/gameplay-oracle';
import { randomJokerFixture } from '../fixtures/owner-random-joker';

it('validates the separate face-up card and clears Undo only on a proved atomic success', async () => {
  const { save, column, path, deal } = randomJokerFixture();
  const original = structuredClone(save);
  expect(save.attempt.undo.length).toBeGreaterThan(0);
  const proof = { attemptId: save.attempt.id, revision: save.revision, column, id: 'azj-certificate', path };
  expect(placeRandomJoker(save.attempt, deal, bound => bound, () => proof.id)).toBeUndefined();
  expect(settleRandomJoker(save, deal, { ...proof, path: [] })).toBe(false);
  expect(settleRandomJoker(save, deal, { ...proof, revision: -1 })).toBe(false);
  expect(save).toEqual(original);
  const candidate = placeRandomJoker(save.attempt, deal, () => column, () => proof.id)!;
  expect(proveRandomJoker(candidate, deal, performance.now() + 220)).toBeDefined();
  expect(settleRandomJoker(save, deal, proof)).toBe(true);
  expect(save.attempt.board.joker?.card).toEqual({ version: 1, id: proof.id, faceUp: true, nativeType: 2 });
  expect(save.attempt.undo).toEqual([]);
  expect(save.profile).toEqual(original.profile);
  expect(settleRandomJoker(save, deal, proof)).toBe(false);
  let board = save.attempt.board;
  for (const move of path) {
    const advanced = advance(board, move, deal);
    expect(advanced).not.toBeNull();
    board = advanced!;
  }
  expect(board.phase).toBe('won');
  expect(findDeal(deal.id)).toBe(deal);
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  vi.resetModules();
  try {
    const { decodeSave } = await import('../../src/platform/storage');
    expect(decodeSave(JSON.stringify(save), findDeal).attempt).toEqual(save.attempt);
  } finally { vi.unstubAllEnvs(); }
}, 20_000);
