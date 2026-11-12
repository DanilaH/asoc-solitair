import { describe, expect, it } from 'vitest';
import { campaignDeals, findDeal } from '../../src/content/campaign';
import { dailyForDay, dailyPool } from '../../src/content/daily';
import { dispatch, freshSave } from '../../src/domain/engine';
import { beginDeal } from '../../src/domain/campaign';
import { switchMode } from '../../src/domain/sessions';
import { currentDailyStreak, dayNumber, finishDaily, milestoneRewards } from '../../src/domain/meta';
import { decodeSave, SaveStore } from '../../src/platform/storage';
import { applyReceipt, useContinue } from '../../src/domain/services';
import type { Deal, Save } from '../../src/domain/types';
function play(save: Save, deal: Deal, today = '') {
  for (const cmd of deal.winningPath) { const result = dispatch(save, cmd, deal, today); expect(result.accepted, result.reason).toBe(true); save = result.next; }
  return save;
}
function completed(save: Save, n: number) {
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, n).map(d => d.id) };
}
describe('compact campaign goals', () => {
  it('pays the fifth win and tenth milestone in one durable result, with no duplicate on replay/reload', () => {
    let save = freshSave(campaignDeals[9], 'ten'); completed(save, 9); save.meta!.winCycle = 4;
    save = play(save, campaignDeals[9]);
    expect(save.meta!.winCycle).toBe(0); expect(save.meta!.cycles).toBe(1); expect(save.profile.hints).toBe(4);
    expect(save.attempt.payout!.map(r => r.reason)).toEqual(['win', 'campaign_milestone', 'campaign_win_cycle']);
    const restored = decodeSave(JSON.stringify(save), findDeal); expect(restored).toEqual(save);
    const wallet = save.profile.coins;
    expect(dispatch(restored, campaignDeals[9].winningPath.at(-1)!, campaignDeals[9]).accepted).toBe(false);
    expect(restored.profile.coins).toBe(wallet); expect(milestoneRewards(restored)).toEqual([]);
    beginDeal(save, campaignDeals[9], 'replay-ten'); save = play(save, campaignDeals[9]);
    expect(save.meta!.winCycle).toBe(0); expect(save.meta!.cycles).toBe(1); expect(save.profile.hints).toBe(4);
    expect(save.attempt.payout!.map(r => r.reason)).toEqual(['win']);
  });
  it('pausing and temporary exhaustion preserve the cycle; Undo/continue preserve it; restart resets it', () => {
    const deal = campaignDeals[2]; let save = freshSave(deal, 'cycle'); completed(save, 2); save.meta!.winCycle = 4;
    const oneMove = structuredClone(save); oneMove.attempt.board.movesLeft = 1;
    save = dispatch(oneMove, deal.winningPath[0], deal).next; expect(save.attempt.board.phase).toBe('exhausted'); expect(save.meta!.winCycle).toBe(4);
    completed(save, 3); const undone = dispatch(save, { type: 'undo' }, deal).next;
    expect(undone.meta!.winCycle).toBe(4); expect(undone.attempt.board.phase).toBe('playing');
    save.platform!.continueCredits = 1; expect(useContinue(save)).toBe(true); expect(save.meta!.winCycle).toBe(4);
    const restored = decodeSave(JSON.stringify(save), findDeal); expect(restored.meta!.winCycle).toBe(4);
    expect(dispatch(restored, { type: 'restart', attemptId: 'reset-cycle' }, deal).next.meta!.winCycle).toBe(0);
  });
  it('explicitly replacing an unfinished campaign resets the cycle while opening a daily does not', () => {
    let save = freshSave(campaignDeals[4], 'abandon'); completed(save, 4); save.meta!.winCycle = 3;
    const original = structuredClone(save.attempt); switchMode(save, 'daily', dailyForDay('2026-11-09'), 'daily'); expect(save.meta!.winCycle).toBe(3);
    switchMode(save, 'campaign', campaignDeals[4], 'campaign-mode'); expect(save.attempt).toEqual(original);
    beginDeal(save, campaignDeals[3], 'other-level'); expect(save.meta!.winCycle).toBe(0);
  });
  it('migrates the 0.4 save once, preserving attempts/receipts and granting earned cosmetics/milestones without inventing a win cycle', () => {
    const save = freshSave(campaignDeals[19], 'old20'); completed(save, 20); save.platform!.receipts = ['already-earned']; save.rulesVersion = 2; save.contentVersion = 3; save.balanceVersion = 2; delete save.meta;
    save.attempt.board.rulesVersion = 2;
    const before = structuredClone(save), next = decodeSave(JSON.stringify(save), findDeal);
    expect(next.attempt).toEqual(before.attempt); expect(next.platform).toEqual(before.platform); expect(next.profile.coins).toBe(before.profile.coins + 80);
    expect(next.profile.rewards).toContain('milestone:10'); expect(next.profile.rewards).toContain('milestone:20'); expect(next.meta!.winCycle).toBe(0);
    expect(decodeSave(JSON.stringify(next), findDeal)).toEqual(next);
  });
});
describe('fixed daily content and independent attempts', () => {
  it('maps local dates to a frozen 28-day rotation, supports leap days and rejects unknown content/dates', () => {
    expect(dailyPool).toHaveLength(28);
    const ids = new Set(Array.from({ length: 28 }, (_, i) => dailyForDay(`2026-11-${String(i + 1).padStart(2, '0')}`).daily!.poolId)); expect(ids.size).toBe(28);
    expect(dailyForDay('2026-12-07').initial).toEqual(dailyForDay('2026-11-09').initial);
    expect(dailyForDay('2026-11-09')).toEqual(dailyForDay('2026-11-09')); expect(dayNumber('2028-02-29')).toBeGreaterThan(0);
    expect(() => dailyForDay('2026-02-29')).toThrow(); expect(() => dailyForDay('2026-11-09', 99)).toThrow();
  });
  it('keeps exact campaign and daily board/Undo/attempt identity through switches, reload, and late rewarded receipts', () => {
    const campaign = campaignDeals[3], daily = dailyForDay('2026-11-09'); let save = freshSave(campaign, 'camp'); completed(save, 3);
    save = dispatch(save, campaign.winningPath[0], campaign).next; const storedCampaign = structuredClone(save.attempt);
    switchMode(save, 'daily', daily, 'day'); save = dispatch(save, daily.winningPath[0], daily, '2026-11-09').next; const storedDaily = structuredClone(save.attempt);
    save = decodeSave(JSON.stringify(save), findDeal); switchMode(save, 'campaign', campaign, 'camp-resume'); expect(save.attempt).toEqual(storedCampaign); expect(save.parked!.daily).toEqual(storedDaily);
    applyReceipt(save, { schema: 1, id: 'late-day', attempt: 'day', dealId: daily.id, placement: 'continue', mode: 'daily' });
    expect(save.platform!.continueCredits).toBe(1); expect(save.attempt).toEqual(storedCampaign);
    switchMode(save, 'daily', daily, 'daily-resume'); expect(save.attempt).toEqual(storedDaily); expect(save.parked!.campaign).toEqual(storedCampaign);
    expect(decodeSave(JSON.stringify(save), findDeal)).toEqual(save);
  });
  it('first daily win pays once, replay and stale-date training pay nothing and do not touch the campaign cycle', () => {
    const day = '2026-11-09', daily = dailyForDay(day); let save = freshSave(daily, 'day-win'); save.meta!.winCycle = 4;
    save = play(save, daily, day); expect(save.meta!.dailyDates).toEqual([day]); expect(save.meta!.winCycle).toBe(4); expect(save.attempt.payout!.map(r => r.reason)).toEqual(['daily_completion']);
    save = dispatch(save, { type: 'restart', attemptId: 'daily-replay' }, daily, day).next;
    const wallet = save.profile.coins; save = play(save, daily, day); expect(save.profile.coins).toBe(wallet); expect(save.attempt.payout).toEqual([]); expect(save.meta!.winCycle).toBe(4);
    save = dispatch(save, { type: 'restart', attemptId: 'daily-stale' }, daily, day).next;
    save = play(save, daily, '2026-11-10'); expect(save.profile.coins).toBe(wallet); expect(save.meta!.dailyDates).toEqual([day]);
  });
  it('rewards days 3, 7, 14, resets only the current streak after a gap, and does not advance streak on clock rollback', () => {
    let save = freshSave(dailyForDay('2026-11-01'), 'calendar');
    const reasons: string[] = [];
    for (let i = 1; i <= 14; i++) { const day = `2026-11-${String(i).padStart(2, '0')}`; save.attempt.daily!.dayId = day; reasons.push(...finishDaily(save, day).map(r => r.label)); }
    expect(reasons).toContain('3 дня подряд'); expect(reasons).toContain('7 дней подряд'); expect(reasons).toContain('14 дней подряд'); expect(save.profile.undos).toBe(7);
    expect(currentDailyStreak(save, '2026-11-16')).toBe(0); const wallet = save.profile.coins;
    save.attempt.daily!.dayId = '2026-11-16'; finishDaily(save, '2026-11-16'); expect(save.meta!.dailyStreak).toBe(1); expect(save.profile.coins).toBe(wallet + 20);
    save.attempt.daily!.dayId = '2026-10-01'; finishDaily(save, '2026-10-01'); expect(save.meta!.lastDaily).toBe('2026-11-16'); expect(save.meta!.dailyStreak).toBe(1);
    save.attempt.daily!.dayId = '2026-11-07'; expect(finishDaily(save, '2026-11-07')).toEqual([]);
  });
  it('failed disk writes cannot replace either attempt; retry is one coordinated commit', async () => {
    let raw = JSON.stringify(freshSave(campaignDeals[0], 'save-failure')), fail = false;
    const store = new SaveStore({ getItem: async () => raw, setItem: async (_k, v) => { if (fail) throw Error('disk'); raw = v; }, removeItem: async () => undefined }, findDeal, () => freshSave(campaignDeals[0], 'default'));
    await store.open(); const before = structuredClone(store.state); fail = true;
    await expect(store.mutate(next => switchMode(next, 'daily', dailyForDay('2026-11-09'), 'day'))).rejects.toThrow(); expect(store.state).toEqual(before);
    fail = false; await store.mutate(next => switchMode(next, 'daily', dailyForDay('2026-11-09'), 'day')); expect(store.state.parked!.campaign).toEqual(before.attempt); expect(store.state.attempt.daily!.dayId).toBe('2026-11-09');
  });
});
