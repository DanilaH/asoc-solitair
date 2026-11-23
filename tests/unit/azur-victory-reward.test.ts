import { expect, test } from 'vitest';
import type { StorageAdapter } from '@danilah/mini-games-kit/platform';
import { campaignDeals } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { dispatch, freshSave } from '../../src/domain/engine';
import { AZUR_VICTORY_DEFAULTS, AZUR_VICTORY_SAVE_KEY, quoteVictoryReward, victoryDifficulty } from '../../src/domain/azur-victory-reward';
import { SAVE_KEY, SaveStore } from '../../src/platform/storage';

const config = AZUR_VICTORY_DEFAULTS;
const deal = campaignDeals[4];
const beforeLast = (item = deal, id = 'independent-qa-win') => item.winningPath.slice(0, -1).reduce(
  (save, command) => dispatch(save, command, item).next, freshSave(item, id),
);

test('compiled-source numbers match an independent table across original codes and move counts', () => {
  const bases = new Map([[1, 25], [2, 50], [3, 100], [4, 200]]);
  for (const difficulty of [0, 1, 2, 3, 4, 5, -1, Number.NaN]) {
    const base = bases.get(difficulty) ?? 100;
    for (const remaining of [0, 1, 5, 10, null]) {
      const bonus = (remaining ?? 0) * 5;
      expect(quoteVictoryReward(config, difficulty, remaining)).toEqual({ base, bonus, total: base + bonus });
      expect(quoteVictoryReward({ ...config, enabled: false }, difficulty, remaining)).toEqual({ base, bonus: 0, total: base });
    }
  }
});

test('reward values reject negative, fractional, non-finite and signed 32-bit overflow', () => {
  for (const bad of [-1, 1.5, Number.NaN, Infinity, 2 ** 31]) {
    expect(() => quoteVictoryReward(config, 1, bad)).toThrow(RangeError);
    expect(() => quoteVictoryReward({ ...config, hard: bad }, 1, 0)).toThrow(RangeError);
  }
  const lastSafe = Math.floor((0x7fff_ffff - 200) / 5);
  expect(quoteVictoryReward(config, 4, lastSafe).total).toBe(200 + 5 * lastSafe);
  expect(() => quoteVictoryReward(config, 4, lastSafe + 1)).toThrow(RangeError);
  expect(() => quoteVictoryReward(config, 1, 0x7fff_ffff)).toThrow(RangeError);
});

test('maps authored difficulty and onboarding metadata, independent of the campaign level number', () => {
  expect(victoryDifficulty({ ...deal, campaignLevel: 61, difficultyTier: 'normal', training: 'stock' })).toBe(1);
  expect(victoryDifficulty({ ...deal, campaignLevel: 1, difficultyTier: 'normal', training: undefined })).toBe(2);
  expect(victoryDifficulty({ ...deal, difficultyTier: 'hard' })).toBe(3);
  expect(victoryDifficulty({ ...deal, difficultyTier: 'superhard' })).toBe(4);
  expect(victoryDifficulty({ ...deal, campaignLevel: undefined })).toBe(0);
});

test('daily remains separate and QA wins change only the ordinary win amount', () => {
  const initial = beforeLast(), action = deal.winningPath.at(-1)!;
  const regular = dispatch(initial, action, deal), qa = dispatch(initial, action, deal, '', config);
  const regularWin = regular.next.attempt.payout!.find(item => item.reason === 'win')!;
  const qaWin = qa.next.attempt.payout!.find(item => item.reason === 'win')!;
  const remaining = qa.next.attempt.board.movesLeft ?? 0;
  expect(qaWin.coins).toBe((deal.training ? 25 : deal.difficultyTier === 'hard' ? 100 : deal.difficultyTier === 'superhard' ? 200 : 50) + 5 * remaining);
  expect(qaWin.key).toBe(regularWin.key);
  expect(qa.next.profile.coins - regular.next.profile.coins).toBe(qaWin.coins - regularWin.coins);
  expect(qa.next.attempt.board).toEqual(regular.next.attempt.board);
  expect(qa.next.attempt.undo).toEqual(regular.next.attempt.undo);
  expect(qa.next.attempt.payout!.filter(item => item.reason !== 'win')).toEqual(regular.next.attempt.payout!.filter(item => item.reason !== 'win'));
  expect(dispatch(qa.next, action, deal, '', config).accepted).toBe(false);
  expect(dispatch(qa.next, { type: 'undo' }, deal, '', config).accepted).toBe(false);
  const replay = dispatch(qa.next, { type: 'restart', attemptId: 'new-qa-attempt' }, deal, '', config).next;
  expect(replay.profile).toEqual(qa.next.profile);
  expect(replay.attempt.payout).toBeUndefined();

  const today = '2026-11-23', daily = dailyForDay(today);
  const dailyStart = beforeLast(daily), last = daily.winningPath.at(-1)!;
  expect(dispatch(dailyStart, last, daily, today, config)).toEqual(dispatch(dailyStart, last, daily, today));
});

test('QA storage does not read the ordinary key and a copied winning journal cannot issue twice', async () => {
  const initial = beforeLast(), raw = JSON.stringify(initial), action = deal.winningPath.at(-1)!;
  const values = new Map([[SAVE_KEY, raw]]);
  const readKeys: string[] = [];
  const backing: StorageAdapter = {
    async getItem(key) { readKeys.push(key); return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
  const qaStore = new SaveStore(backing, deal, () => initial, AZUR_VICTORY_SAVE_KEY);
  await qaStore.open();
  await qaStore.mutate(save => Object.assign(save, dispatch(save, action, deal, '', config).next));
  const earned = structuredClone(qaStore.state.profile);
  expect(values.get(SAVE_KEY)).toBe(raw);
  expect(readKeys).not.toContain(SAVE_KEY);

  const onReplica = values.get(AZUR_VICTORY_SAVE_KEY)!;
  const otherDevice = new Map([[AZUR_VICTORY_SAVE_KEY, onReplica]]);
  const otherStore = new SaveStore({
    async getItem(key) { return otherDevice.get(key) ?? null; },
    async setItem(key, value) { otherDevice.set(key, value); },
    async removeItem(key) { otherDevice.delete(key); },
  }, deal, () => initial, AZUR_VICTORY_SAVE_KEY);
  await otherStore.open();
  await otherStore.mutate(save => Object.assign(save, dispatch(save, action, deal, '', config).next));
  expect(otherStore.state.profile).toEqual(earned);
  expect(otherStore.state.profile.rewards.filter(key => key === `win:${initial.attempt.id}`)).toHaveLength(1);
});
