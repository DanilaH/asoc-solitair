import { expect, it } from 'vitest';
import { releaseProfile } from '../../src/config/profile';
import { content7Deals } from '../../src/content/campaign-v7';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { dailyForDay } from '../../src/content/daily';
import { AZUR_BONUS_POOL, claimDailyBonus, openDailyBonusRound, revealDailyBonusCard, weightedBonusPrize } from '../../src/domain/events/daily-bonus';
import { azurTaskDays, scheduleTasks, recordTaskSignal, claimTask } from '../../src/domain/events/daily-tasks';
import { comboDisposition } from '../../src/domain/events/combo';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { switchMode } from '../../src/domain/sessions';
import { decodeSave } from '../../src/platform/storage';
import { findDeal } from '../../src/content/campaign';

it('preserves the compiled catalog and atomically grants medals and task bonus', () => {
  const rows = azurTaskDays.flat();
  expect(azurTaskDays.map(day => day.length)).toEqual([4, 4, 4, 4, 4, 4, 4]);
  expect(rows.reduce((n, row) => n + row.prize.quantity, 0)).toBe(1210);
  expect(rows.filter(row => row.kind !== 'MakePurchase').reduce((n, row) => n + row.prize.quantity, 0)).toBe(960);
  const deal = content7Deals[0], save = freshSave(deal, 'catalog');
  const now = Date.UTC(2026, 10, 23);
  expect(scheduleTasks(save, now, azurTaskDays[0])).toBe(true);
  expect(recordTaskSignal(save, now, { id: 'login', kind: 'DailyLogin', channel: 'login', amount: 1 })).toBe(true);
  const undo = save.profile.undos;
  expect(save.dailyTasks?.weeks[0].totalMedals).toBe(0);
  expect(claimTask(save, '2026-11-23', 'azur-1-1')).toBe(true);
  expect(save.dailyTasks?.weeks[0].totalMedals).toBe(5);
  expect(save.profile.undos).toBe(undo + 1);
  expect(claimTask(save, '2026-11-23', 'azur-1-1')).toBe(false);
});

it('holds the 16-row pool and resumes partial cards and pending winnings without a reroll or duplicate grant', () => {
  expect(AZUR_BONUS_POOL).toHaveLength(16);
  expect(AZUR_BONUS_POOL.reduce((n, row) => n + row.weight, 0)).toBe(93);
  expect(weightedBonusPrize([{ kind: 'Coins', quantity: 10, weight: -2 }, { kind: 'Joker', quantity: 1, weight: 0 }], () => 0)?.kind).toBe('Joker');
  const deal = content7Deals[0], now = Date.UTC(2026, 10, 23), day = 86_400_000;
  let save = freshSave(deal, 'bonus-round');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0, completedCampaign: [campaignId(1)] };
  const round = openDailyBonusRound(save, now, 'round', n => n - 1, 'azur-compiled-r1')!;
  const slot = (column: number, occurrence: number) => round.slots.flatMap((value, index) => value === column ? [index] : [])[occurrence];
  for (const index of [slot(0, 0), slot(1, 0), slot(0, 1), slot(2, 0), slot(1, 1)]) {
    expect(revealDailyBonusCard(save, round.roundId, index, now)).toBe(true);
    expect(save.dailyBonus?.won).toBeUndefined();
  }
  save = decodeSave(JSON.stringify(save), findDeal);
  expect(openDailyBonusRound(save, now, 'reroll', () => 0)?.roundId).toBe(round.roundId);
  expect(revealDailyBonusCard(save, round.roundId, slot(0, 2), now)).toBe(true);
  save = decodeSave(JSON.stringify(save), findDeal);
  expect(save.dailyBonus?.won).toBe(0);
  expect(openDailyBonusRound(save, now + day, 'new-day', () => 0)?.roundId).toBe(round.roundId);
  const jokers = save.profile.jokers;
  expect(claimDailyBonus(save, round.roundId, now + day)).toEqual({ kind: 'Joker', quantity: 1 });
  expect(claimDailyBonus(save, round.roundId, now + day)).toBeUndefined();
  expect(save.profile.jokers).toBe(jokers + 1);
  expect(openDailyBonusRound(save, now + day, 'new-day', () => 0)?.roundId).toBe('new-day');
  expect(openDailyBonusRound(save, now, 'rollback', () => 0)).toBeUndefined();
});

it.skipIf(!releaseProfile)('tracks a Hint before any journal or Tasks UI and preserves evidence across Daily and reload', () => {
  const deal = content8Wave[0];
  let save = freshSave(deal, 'before-tasks-ui');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0,
    completedCampaign: Array.from({ length: 15 }, (_, i) => campaignId(i + 1)) };
  const step = dispatch(save, { type: 'hint', revision: save.revision, action: deal.winningPath[0] }, deal);
  expect(step.accepted).toBe(true);
  save = step.next;
  expect(save.attempt.verifiedTaskHints).toBe(1);
  switchMode(save, 'daily', dailyForDay('2026-11-24'), 'daily');
  save = decodeSave(JSON.stringify(save), findDeal);
  switchMode(save, 'campaign', deal, 'resume');
  expect(save.attempt.verifiedTaskHints).toBe(1);
  const old = structuredClone(save);
  delete old.attempt.verifiedTaskHints;
  expect(decodeSave(JSON.stringify(old), findDeal).attempt.verifiedTaskHints).toBeUndefined();
});

it('prioritizes a draw with skipped waste over a productive combo flag', () => {
  const move = { IsCardRelocation: true, IsDeckDraw: false, InvolvesWildCard: false, PlacedOnCardOrFoundation: true, SkippedPlayableWasteCard: false };
  expect(comboDisposition(move)).toBe('advance');
  expect(comboDisposition({ ...move, InvolvesWildCard: true })).toBe('neutral');
  expect(comboDisposition({ ...move, IsCardRelocation: false, IsDeckDraw: true })).toBe('neutral');
  expect(comboDisposition({ ...move, IsDeckDraw: true, SkippedPlayableWasteCard: true })).toBe('reset');
});
