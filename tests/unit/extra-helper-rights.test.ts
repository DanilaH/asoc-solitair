import { expect, it } from 'vitest';
import { buyUnlimitedAccess, expireUnlimited } from '../../src/domain/campaign-recovery';
import { buyRandomJokerAccess, settleRandomJoker } from '../../src/domain/random-joker';
import { randomJokerFixture } from '../fixtures/owner-random-joker';

const extraHelpers = { version: 1, randomJokerCoins: 250, unlimitedCoins: 120, unlimitedMs: 60_000 } as const;
it('keeps the separately bought Joker through a bad proof and consumes only that right after success', () => {
  const fixture = randomJokerFixture();
  const { save, column, path } = fixture;
  const deal = { ...fixture.deal, id: 'extra-helpers-rights', extraHelpers };
  save.attempt.dealId = deal.id;
  save.profile.coins = 500;
  const manual = save.profile.jokers;
  expect(buyRandomJokerAccess(save, deal, 'acquired', 100)).toBe(true);
  expect(buyRandomJokerAccess(save, deal, 'repeat', 101)).toBe(false);
  expect(save.profile.coins).toBe(250);
  const identity = { attemptId: save.attempt.id, revision: save.revision, column, id: 'azj-earned' };
  expect(settleRandomJoker(save, deal, { ...identity, path: [] })).toBe(false);
  expect(save.attempt.randomJokerAccess?.consumed).toBeUndefined();
  expect(save.attempt.undo.length).toBeGreaterThan(0);
  expect(settleRandomJoker(save, deal, { ...identity, path })).toBe(true);
  expect(save.attempt.randomJokerAccess?.consumed).toBe(true);
  expect(save.profile.jokers).toBe(manual);
  expect(save.attempt.undo).toEqual([]);
});

it('starts and expires the ordinary coin Unlimited without storefront or purchase state', () => {
  const { save, deal: original } = randomJokerFixture();
  const deal = { ...original, id: 'extra-helpers-recovery', extraHelpers,
    recovery: { version: 1, freeRecycles: 1, restoreBase: 60, restoreIncrement: 30 } as const };
  save.attempt.dealId = deal.id;
  save.profile.coins = 125;
  const finite = save.attempt.board.movesLeft;
  expect(buyUnlimitedAccess(save, deal, 'rw', 100)).toBe(true);
  expect(save.profile.coins).toBe(5);
  expect(save.commerce).toBeUndefined();
  expect(save.attempt.board.movesLeft).toBeNull();
  expect(save.attempt.unlimitedAccess).toMatchObject({ id: 'rw', source: 'coins', consumed: true, until: 60_100 });
  expect(buyUnlimitedAccess(save, deal, 'repeat', 200)).toBe(false);
  expect(expireUnlimited(save, 60_100)).toBe(true);
  expect(save.attempt.board.movesLeft).toBe(finite);
});
