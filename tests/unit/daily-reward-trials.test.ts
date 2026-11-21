import { expect, it, vi } from 'vitest';
import { dailyForDay, dailyPool } from '../../src/content/daily';
import { claimLoginReward, earnFortuneRetry, emptyDailyTrials, openDailyBonus, openFortuneRound,
  pickFortune, requestFortuneRetry, revealDailyBonus } from '../../tools/content/daily-reward-trials';

const first = '2026-11-21', second = '2026-11-22';

it('provides a once-per-day AZUR-shaped reveal with one winning column and no grant on open', () => {
  const state = emptyDailyTrials(100), rng = vi.fn(() => 2);
  const round = openDailyBonus(state, first, 3, rng);
  expect(rng).toHaveBeenCalledExactlyOnceWith(3);
  expect(round.wallet).toBe(100);
  expect(openDailyBonus(round, first, 3, rng)).toBe(round);
  expect(revealDailyBonus(round, first, -1)).toBe(round);
  expect(revealDailyBonus(round, first, 1).wallet).toBe(100);
  const winning = revealDailyBonus(round, first, 2);
  expect(winning.wallet).toBe(125);
  expect(revealDailyBonus(winning, first, 2)).toBe(winning);
});

it('keeps login prizes separate from all 28 product puzzle IDs and resets its own gap', () => {
  const puzzle = dailyForDay(first), next = dailyForDay(second);
  expect(dailyPool).toHaveLength(28);
  expect(puzzle.id).not.toBe(next.id);
  const block = claimLoginReward(emptyDailyTrials(100), first);
  const dayTwo = claimLoginReward(block, second);
  expect(dayTwo.login).toEqual({ lastClaim: second, dayIndex: 2, received: 2 });
  expect(dayTwo.wallet).toBe(120);
  expect(claimLoginReward(dayTwo, first)).toBe(dayTwo);
  expect(claimLoginReward(dayTwo, '2026-11-24').login.dayIndex).toBe(1);
});

it('credits the second Fortune reveal only for its durable earned receipt and exact prior round', () => {
  const opened = openFortuneRound(emptyDailyTrials(100), first, () => 0);
  expect(opened.fortune[0].amounts.slice().sort((a, b) => a - b)).toEqual([4, 6, 10]);
  const firstPick = pickFortune(opened, first, 0);
  const intent = requestFortuneRetry(firstPick, first, 'retry-one', 1);
  expect(intent.wallet).toBe(firstPick.wallet);
  const later = openFortuneRound(intent, second, () => 0);
  expect(earnFortuneRetry(later, { day: second, requestId: 'retry-one', receiptId: 'earned-one' })).toBe(later);
  const earned = earnFortuneRetry(JSON.parse(JSON.stringify(later)), { day: first, requestId: 'retry-one', receiptId: 'earned-one' });
  expect(earned.wallet).toBe(100 + opened.fortune[0].amounts[0] + opened.fortune[0].amounts[1]);
  expect(earnFortuneRetry(earned, { day: first, requestId: 'retry-one', receiptId: 'duplicate' })).toBe(earned);
  expect(pickFortune(earned, first, 2)).toBe(earned);
});
