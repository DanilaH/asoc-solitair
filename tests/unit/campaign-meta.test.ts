import { describe, expect, it } from 'vitest';
import { commitAdaptiveRetry, quoteLayoutRetry } from '../../src/app/campaign-retry';
import { CAMPAIGN_META, DAILY_CALENDAR } from '../../src/config/campaign-meta';
import { campaignDeals, campaignIssuance, findDeal, layoutFingerprint, selectCampaignDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { beginDeal } from '../../src/domain/campaign';
import { freshSave } from '../../src/domain/engine';
import { claimTask, claimTaskMilestone, currentTasks, m1WeekRows, openWeeklyChest, recordTaskSignal, updatePreviewTasks, type TaskSignal } from '../../src/domain/events/daily-tasks';
import { addWinStreakProgress, claimWinStreak, streakStatus } from '../../src/domain/events/win-streak';
import { abandonCampaign, campaignRewards, finishDaily } from '../../src/domain/meta';
import { CAMPAIGN_LENGTH, campaignId, completedLevels } from '../../src/domain/progression';
import { claimShopCoins, prepareRewardOffer, retireUnrewardedOffer, settleRewardOffer } from '../../src/domain/reward-offers';
import { applyFullscreenShown, type FullscreenShown } from '../../src/domain/services';
import { switchMode } from '../../src/domain/sessions';
import { decodeSave } from '../../src/platform/storage';
import { profileAt } from '../fixtures/functional-audit-225';

const DAY = 86_400_000;
const date = (at: number) => new Date(at).toISOString().slice(0, 10);
const reopen = (save: ReturnType<typeof freshSave>) => decodeSave(JSON.stringify(save), findDeal);

describe.skipIf(!CAMPAIGN_META)('ordinary campaign expansion and meta', () => {
  it('opens L81 after a stored L80 victory and pins new and old identities', () => {
    expect(CAMPAIGN_LENGTH).toBe(200);
    const old = findDeal('campaign-c8-late-080') ?? campaignDeals[79];
    const save = profileAt(old);
    save.attempt.board.phase = 'won';
    save.platform!.completedCampaign.push(campaignId(80));
    const old81 = findDeal('campaign-c8-beyond-081') ?? findDeal('campaign-c8-beyond-081-ru');
    const base = campaignDeals[80], origin = save.attempt, coins = save.profile.coins;
    const next = selectCampaignDeal(save, base, origin);
    expect(next.campaignLevel).toBe(81);
    expect(next.id.endsWith('-m1')).toBe(true);
    beginDeal(save, next, 'm3-from-80', old);
    save.attempt.issuance = campaignIssuance(save, base, next, origin);
    expect(reopen(save).attempt).toEqual(save.attempt);
    expect(save.profile.coins).toBe(coins);
    expect(completedLevels(save)).toBe(80);
    if (old81) expect(findDeal(old81.id)).toBe(old81);
  });

  it.each([81, 92, 145, 200])('rotates three ordinary layouts at L%i at each penalty', level => {
    const base = campaignDeals[level - 1];
    for (const penalty of [-5, 0, 10]) {
      const save = profileAt(base), seen = new Set<string>();
      save.difficultyPenalty = penalty;
      let issued = selectCampaignDeal(save, base);
      save.attempt = freshSave(issued, 'm3-first').attempt;
      save.attempt.issuance = campaignIssuance(save, base, issued);
      seen.add(layoutFingerprint(issued));
      for (let index = 0; index < 2; index++) {
        save.attempt.board = { ...save.attempt.board, phase: 'exhausted', movesLeft: 0 };
        const quote = quoteLayoutRetry(save)!;
        expect(commitAdaptiveRetry(save, quote, 'm3-retry-' + index, 100 + index, quoteLayoutRetry)).toBe('started');
        issued = quote.selected;
        seen.add(layoutFingerprint(issued));
        expect(reopen(save).attempt.issuance?.dealId).toBe(issued.id);
      }
      expect(seen.size).toBe(3);
    }
  });

  it('maintains calendar identity, archive attempts and no double reward or backwards day', () => {
    const first = dailyForDay(DAILY_CALENDAR.first);
    expect(first.initial.rulesVersion).toBe(4);
    expect(dailyForDay('2026-11-27').initial.rulesVersion).toBe(3);
    const leap = dailyForDay('2028-02-29');
    expect(findDeal(leap.id)).toEqual(leap);
    const old = dailyForDay(DAILY_CALENDAR.first, 1);
    expect(findDeal(old.id)).toEqual(old);
    let save = profileAt(first);
    const base = campaignDeals[79];
    switchMode(save, 'campaign', base, 'm3-parked-campaign');
    save = reopen(save);
    expect(save.parked?.daily?.board).toEqual(first.initial);
    switchMode(save, 'daily', first, 'm3-resume-daily');
    expect(finishDaily(save, first.daily!.dayId)[0]?.coins).toBe(100);
    switchMode(save, 'daily', old, 'm3-same-date-v1');
    expect(finishDaily(save, old.daily!.dayId)).toEqual([]);
    switchMode(save, 'daily', dailyForDay('2026-11-27'), 'm3-backwards');
    expect(finishDaily(save, '2026-11-27')).toEqual([]);
  });

  it('claims five source-shaped milestones and a frozen chest with seven days of ordinary signals', () => {
    const save = profileAt(campaignDeals[10]), monday = Date.UTC(2026, 10, 30);
    const channels: Partial<Record<TaskSignal['kind'], TaskSignal['channel']>> = {
      DailyLogin: 'login', CollectDailyBonuses: 'daily-bonus', EarnCoins: 'wallet',
    };
    for (let day = 0; day < 7; day++) {
      const now = monday + day * DAY;
      updatePreviewTasks(save, now);
      const current = currentTasks(save)!;
      expect(current.day.tasks).toHaveLength(4);
      for (const task of current.day.tasks) {
        expect(recordTaskSignal(save, now, { id: task.id, kind: task.kind, channel: channels[task.kind] ?? 'board',
          amount: task.target, attemptId: save.attempt.id })).toBe(true);
        expect(claimTask(save, date(now), task.id)).toBe(true);
      }
    }
    const week = currentTasks(save)!.week;
    expect(week.totalMedals).toBe(1210);
    expect(week.milestones.map(item => item.medals)).toEqual([50, 100, 300, 600, 1000]);
    const before = save.profile.coins;
    for (const milestone of week.milestones) {
      expect(claimTaskMilestone(save, date(monday), milestone.id)).toBe(true);
      expect(claimTaskMilestone(save, date(monday), milestone.id)).toBe(false);
    }
    expect(save.profile.coins - before).toBe(100);
    const restored = reopen(save), chest = restored.dailyTasks!.inventory.chestKeys[0];
    expect(openWeeklyChest(restored, chest)).toEqual(week.milestones.at(-1)!.chest);
    expect(openWeeklyChest(restored, chest)).toBeUndefined();
    expect(new Set(Array.from({ length: 7 }, (_, day) => m1WeekRows(day).map(task => task.kind).join())).size).toBeGreaterThan(5);
  });

  it('keeps an in-flight legacy cycle and resets only the unfinished streak stage on finalized loss', () => {
    const save = profileAt(campaignDeals[10]);
    save.meta!.winCycle = 4;
    expect(campaignRewards(save).some(row => row.reason === 'campaign_win_cycle' && row.coins === 100)).toBe(true);
    expect(save.meta?.winStreak).toBeUndefined();
    addWinStreakProgress(save, 6);
    expect(streakStatus(save)).toMatchObject({ progress: 1, ready: 2 });
    const before = save.profile.coins;
    expect(reopen(save).meta).toEqual(save.meta);
    abandonCampaign(save);
    expect(streakStatus(save).progress).toBe(1);
    save.attempt.board = { ...save.attempt.board, phase: 'exhausted', movesLeft: 0 };
    abandonCampaign(save);
    expect(streakStatus(save)).toMatchObject({ progress: 0, ready: 2 });
    expect(claimWinStreak(save, 0)).toEqual({ coins: 100, hints: 1 });
    expect(claimWinStreak(save, 0)).toBeUndefined();
    expect(save.profile.coins - before).toBe(100);
  });

  it('round-trips 400 date awards and UTC task days with both 300-frame Undo histories', () => {
    const base = campaignDeals[130];
    const campaign = selectCampaignDeal(profileAt(base), base);
    const daily = dailyForDay(DAILY_CALENDAR.first);
    const save = profileAt(campaign, 'year-scale');
    const first = Date.parse(DAILY_CALENDAR.first + 'T12:00:00Z');
    save.attempt.undo = Array.from({ length: 300 }, () => structuredClone(save.attempt.board));
    switchMode(save, 'daily', daily, 'year-daily-0');
    for (let index = 0; index < 400; index++) {
      const now = first + DAY * index;
      const layout = dailyForDay(date(now));
      if (index) switchMode(save, 'daily', layout, 'year-daily-' + index);
      expect(finishDaily(save, date(now)).length).toBeGreaterThan(0);
      updatePreviewTasks(save, now);
      recordTaskSignal(save, now, { id: 'login', kind: 'DailyLogin', channel: 'login', amount: 1 });
    }
    save.attempt.undo = Array.from({ length: 300 }, () => structuredClone(save.attempt.board));
    const plain = JSON.stringify(save);
    const restored = reopen(save);
    expect(restored.attempt.undo).toHaveLength(300);
    expect(restored.parked?.campaign?.undo).toHaveLength(300);
    expect(restored.meta?.dailyDates).toHaveLength(400);
    expect(restored.dailyTasks?.weeks.length).toBeGreaterThan(56);
    expect(Buffer.byteLength(plain)).toBeLessThan(4_194_304);
    console.info('M3 year, dual Undo maximum:', Buffer.byteLength(plain), 'bytes');
  }, 30_000);

  it('S2-B rejects request growth, preserves historical +30 and accounts for a late verified show', () => {
    const base = campaignDeals[15], deal = selectCampaignDeal(profileAt(base), base);
    let save = profileAt(deal);
    const time = Date.UTC(2026, 10, 27);
    const old = { id: 'historic', dealId: deal.id, kind: 'shop-free-coins' as const, at: time, amount: 30, key: 'shop' };
    save.rewardOffers = { version: 1, definitions: 1, freeAfter: 0, themeUntil: 0, settledWins: [], pending: [old] };
    save.rewardOffers.shows = Array.from({ length: 64 }, (_, index) => ({
      id: 'other-' + index, kind: old.kind, dealId: deal.id, attemptId: save.attempt.id,
    }));
    const record: FullscreenShown = { schema: 1, id: 'past-show', placement: old.kind, attempt: old.id, dealId: deal.id,
      mode: 'campaign', kind: 'rewarded', shownAt: time + 1000 };
    for (let day = 0; day < 365 * 3; day++) {
      const now = time + day * DAY;
      claimShopCoins(save, deal, now, true);
      for (let request = 0; request < 100; request++) {
        const id = `probe-${day}-${request}`;
        expect(prepareRewardOffer(save, deal, old.kind, now, id, true, true)).toBeDefined();
        expect(prepareRewardOffer(save, deal, old.kind, now, id + '-dup', true, true)).toBeUndefined();
        expect(retireUnrewardedOffer(save, id)).toBe(true);
      }
    }
    expect(save.rewardOffers.pending).toEqual([old]);
    expect(JSON.stringify(save).length).toBeLessThan(50000);
    save = reopen(save);
    const coins = save.profile.coins;
    expect(applyFullscreenShown(save, record)).toBe('applied');
    expect(applyFullscreenShown(save, { ...record, id: 'out-of-order', shownAt: record.shownAt - 1 })).toBe('already-applied');
    expect(save.platform?.lastFullscreenAt).toBe(record.shownAt);
    expect(save.profile.coins).toBe(coins);
    expect(settleRewardOffer(save, record as FullscreenShown & { placement: 'shop-free-coins' }, time + DAY)).toBe(true);
    expect(save.profile.coins - coins).toBe(30);
  }, 30_000);
});
