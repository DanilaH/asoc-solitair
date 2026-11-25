import { describe, expect, it } from 'vitest';
import { campaignDeals, findDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { platformState } from '../../src/domain/services';
import { switchMode } from '../../src/domain/sessions';
import { claimDailyBonus, dailyBonusState, openDailyBonusRound, revealDailyBonusCard } from '../../src/domain/events/daily-bonus';
import { acceptedTaskSignals, claimTask, claimTaskMilestone, pendingTaskRewards, recordTaskSignal, scheduleTasks, taskRewardState, updatePreviewTasks, releaseTasks, type TaskTarget } from '../../src/domain/events/daily-tasks';
import { claimLegacyLiveOpsReward, legacyLiveOpsRewards } from '../../src/domain/events/campaign-liveops';
import { eventKey, observeEvents, recordEventWin, type EventDefinition } from '../../src/domain/events/ledger';
import { freeCampaignBonusState, recordFreeCampaignClear, settleFreeCampaignBonus } from '../../src/domain/commerce/storefront';
import { decodeSave, SaveStore } from '../../src/platform/storage';
import type { Save } from '../../src/domain/types';

const DAY = 86_400_000, now = Date.UTC(2026, 10, 23), yesterday = now - DAY;
function profile(level = 2) {
  const save = freshSave(campaignDeals[level - 1], 'retention-fixture');
  platformState(save).completedCampaign = Array.from({ length: level - 1 }, (_, i) => campaignId(i + 1));
  return save;
}
function wonBonus(save: Save, at = yesterday) {
  const round = openDailyBonusRound(save, at, 'saved-prize', () => 0)!;
  for (const [index, column] of round.slots.entries()) if (column === 0) expect(revealDailyBonusCard(save, round.roundId, index, at)).toBe(true);
  expect(round.columns[0]).toEqual({ kind: 'Coins', quantity: 10 });
  return round.roundId;
}
const visit: TaskTarget = { id: 'visit', kind: 'DailyLogin', target: 1, prize: { kind: 'Medals', quantity: 1 } };
const milestones = [{ id: 'week', medals: 5, prize: { kind: 'Coins' as const, quantity: 20 }, bundle: [{ kind: 'MoveHint' as const, quantity: 2 }] }];
function oldTasks(save: Save) {
  for (const date of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-22']) {
    const at = Date.parse(date);
    scheduleTasks(save, at, [{ ...visit, ...(date === '2026-11-22' ? { bonus: { kind: 'Undo' as const, quantity: 2 } } : {}) }], milestones);
    recordTaskSignal(save, at, { id: 'login', kind: 'DailyLogin', channel: 'login', amount: 1 });
    if (date !== '2026-11-22') expect(claimTask(save, date, 'visit')).toBe(true);
  }
  scheduleTasks(save, now, [visit], milestones);
}
const legacy: EventDefinition = {
  id: 'old-race', version: 1, sourceFeatureId: 'hitapps-weekend-race', minCampaignLevel: 16, daily: false,
  schedule: { clock: 'local', zone: 'UTC', start: now - 60 * DAY, end: now - 59 * DAY },
  milestones: [{ id: 'earned', threshold: 1, reward: { coins: 17, hints: 2 } }, { id: 'unfinished', threshold: 2, reward: { coins: 90 } }],
};
function oldEvent(save: Save, definition = legacy) {
  const at = definition.schedule.start + 1;
  recordEventWin(save, [definition], { id: 'campaign:16', campaignLevel: 16, mode: 'campaign' }, { localMs: at });
  observeEvents(save, [], { localMs: now });
}

describe('shared Daily Bonus lifecycle', () => {
  it('expires an open unfinished round without acting on a new random layout', () => {
    const save = profile(), round = openDailyBonusRound(save, yesterday, 'old-open', () => 0)!;
    revealDailyBonusCard(save, round.roundId, 0, yesterday);
    expect(dailyBonusState(save, yesterday)).toMatchObject({ phase: 'playing', canReveal: true });
    const snapshot = structuredClone(save);
    expect(dailyBonusState(save, now)).toMatchObject({ phase: 'expired', canReveal: false, canStartRound: true, nextResetAt: now + DAY });
    expect(revealDailyBonusCard(save, round.roundId, 1, now)).toBe(false);
    expect(save).toEqual(snapshot);
    expect(openDailyBonusRound(save, now, 'explicit-new-day', () => 0)?.roundId).toBe('explicit-new-day');
    expect(revealDailyBonusCard(save, round.roundId, 1, now)).toBe(false);
    expect(save.dailyBonus?.revealed).toEqual([]);
  });

  it('retains an old won prize across reload, then exposes a new day only after its claim', () => {
    let save = profile(); const id = wonBonus(save), before = save.profile.coins;
    save = decodeSave(JSON.stringify(save), findDeal);
    expect(dailyBonusState(save, now + 3 * DAY)).toMatchObject({ phase: 'ready', roundId: id, canClaim: true, canStartRound: false, prize: { kind: 'Coins', quantity: 10 } });
    expect(openDailyBonusRound(save, now, 'must-not-reroll', () => 0)?.roundId).toBe(id);
    expect(claimDailyBonus(save, id, now)).toEqual({ kind: 'Coins', quantity: 10 });
    expect(claimDailyBonus(save, id, now)).toBeUndefined();
    expect(save.profile.coins).toBe(before + 10);
    expect(dailyBonusState(save, now)).toMatchObject({ phase: 'available', canStartRound: true });
    expect(openDailyBonusRound(save, now, 'today', () => 0)?.roundId).toBe('today');
  });

  it('gives future saved dates precedence over won/claimed states and leaves them intact', () => {
    const save = profile(), id = wonBonus(save, now + DAY);
    const future = structuredClone(save);
    expect(dailyBonusState(save, now)).toMatchObject({ phase: 'future', canOpen: false, canClaim: false, availableAt: now + DAY });
    expect(claimDailyBonus(save, id, now)).toBeUndefined();
    expect(openDailyBonusRound(save, now, 'rollback', () => 0)).toBeUndefined();
    expect(save).toEqual(future);
    expect(claimDailyBonus(save, id, now + DAY)).toBeDefined();
    expect(dailyBonusState(save, now)).toMatchObject({ phase: 'future', canClaim: false });
    expect(dailyBonusState(save, now + DAY)).toMatchObject({ phase: 'claimed', canOpen: false, nextResetAt: now + 2 * DAY });
    expect(dailyBonusState(profile(1), now).phase).toBe('locked');
    expect(dailyBonusState(save, Number.NaN).phase).toBe('unavailable');
  });
});

describe('frozen task rewards and current-day presentation', () => {
  it('reveals the old week milestone after its last old task claim without moving medals to this week', () => {
    const save = profile(); oldTasks(save);
    const balance = save.profile.coins, hints = save.profile.hints, undos = save.profile.undos;
    const snapshot = structuredClone(save), state = taskRewardState(save, now);
    expect(state).toMatchObject({ clock: 'current', todayCompleted: 0, todayTotal: 1, readyCount: 1, nextDayAt: now + DAY, nextWeekAt: now + 7 * DAY });
    expect(state.previous).toMatchObject([{ kind: 'task', utc: '2026-11-22', weekStart: '2026-11-16', id: 'visit',
      prizes: [{ kind: 'Medals', quantity: 1 }, { kind: 'Undo', quantity: 2 }] }]);
    state.previous[0].prizes[0].quantity = 99;
    expect(save).toEqual(snapshot);
    expect(claimTask(save, '2026-11-22', 'visit')).toBe(true);
    expect(taskRewardState(save, now).week?.totalMedals).toBe(0);
    expect(taskRewardState(save, now).previous).toMatchObject([{ kind: 'milestone', weekStart: '2026-11-16', id: 'week',
      prizes: [{ kind: 'Coins', quantity: 20 }, { kind: 'MoveHint', quantity: 2 }] }]);
    expect(claimTaskMilestone(save, '2026-11-16', 'week')).toBe(true);
    expect(claimTask(save, '2026-11-22', 'visit')).toBe(false);
    expect(claimTaskMilestone(save, '2026-11-16', 'week')).toBe(false);
    expect(taskRewardState(save, now).readyCount).toBe(0);
    expect(save.profile.coins).toBe(balance + 20);
    expect(save.profile.hints).toBe(hints + 2);
    expect(save.profile.undos).toBe(undos + 2);
    expect(decodeSave(JSON.stringify(save), findDeal)).toEqual(save);
  });

  it('never relabels a stale/future assignment as today or invents incomplete and absent claims', () => {
    const save = profile();
    scheduleTasks(save, yesterday, [visit], milestones);
    expect(taskRewardState(save, now)).toMatchObject({ clock: 'stale', today: undefined, readyCount: 0, previous: [] });
    recordTaskSignal(save, yesterday, { id: 'visit', kind: 'DailyLogin', channel: 'login', amount: 1 });
    expect(taskRewardState(save, now).previous).toHaveLength(1);
    scheduleTasks(save, now + DAY, [visit], milestones);
    const snapshot = structuredClone(save);
    expect(taskRewardState(save, now)).toMatchObject({ clock: 'future', today: undefined, availableAt: now + DAY, readyCount: 1 });
    expect(pendingTaskRewards(save)).toHaveLength(1);
    expect(save).toEqual(snapshot);
    expect(claimTask(save, '2026-11-23', 'visit')).toBe(false);
  });
});

describe('automatic free campaign bonus', () => {
  it('settles an old ready record before the first new-month clear, preserving paid fields on settlement', () => {
    const save = profile(), before = save.profile.coins;
    save.storeProgress = { version: 1, season: '2026-10', clears: 3, piggy: 30, premiumClaimed: 'premium-owned', piggyGrant: 'piggy-owned' };
    expect(settleFreeCampaignBonus(save, now)).toEqual({ season: '2026-10', coins: 10 });
    expect(save.storeProgress).toMatchObject({ freeClaimed: true, premiumClaimed: 'premium-owned', piggyGrant: 'piggy-owned', piggy: 30 });
    expect(freeCampaignBonusState(save, now)).toMatchObject({ phase: 'progress', clears: 0, season: '2026-11' });
    expect(settleFreeCampaignBonus(save, now)).toBeUndefined();
    expect(recordFreeCampaignClear(save, now)).toEqual({ recorded: true, grants: [] });
    expect(save.storeProgress).toMatchObject({ season: '2026-11', clears: 1 });
    expect(recordFreeCampaignClear(save, now).grants).toEqual([]);
    expect(recordFreeCampaignClear(save, now).grants).toEqual([{ season: '2026-11', coins: 10 }]);
    expect(recordFreeCampaignClear(save, now).grants).toEqual([]);
    expect(save.profile.coins).toBe(before + 20);
    expect(freeCampaignBonusState(save, now)).toMatchObject({ phase: 'claimed', progress: 3, clears: 4 });
  });

  it('can perform old settlement, new-month reset, and one clear in one mutation without a boot settlement', () => {
    const save = profile(), before = save.profile.coins;
    save.storeProgress = { version: 1, season: '2026-10', clears: 8, piggy: 30 };
    expect(recordFreeCampaignClear(save, now)).toEqual({ recorded: true, grants: [{ season: '2026-10', coins: 10 }] });
    expect(save.profile.coins).toBe(before + 10);
    expect(save.storeProgress).toMatchObject({ season: '2026-11', clears: 1 });
    expect(save.storeProgress?.freeClaimed).toBeUndefined();
    expect(freeCampaignBonusState(save, now).phase).toBe('progress');
  });

  it('keeps future and unpayable earned records, and does not award an incomplete past month', () => {
    const save = profile();
    save.storeProgress = { version: 1, season: '2026-12', clears: 3, piggy: 30 };
    const future = structuredClone(save);
    expect(settleFreeCampaignBonus(save, now)).toBeUndefined();
    expect(recordFreeCampaignClear(save, now)).toEqual({ recorded: false, grants: [] });
    expect(freeCampaignBonusState(save, now).phase).toBe('future');
    expect(save).toEqual(future);
    save.storeProgress!.season = '2026-10';
    save.profile.coins = Number.MAX_SAFE_INTEGER;
    const unpayable = structuredClone(save);
    expect(recordFreeCampaignClear(save, now).recorded).toBe(false);
    expect(save).toEqual(unpayable);
    save.profile.coins = 100;
    save.storeProgress!.clears = 2;
    expect(recordFreeCampaignClear(save, now)).toEqual({ recorded: true, grants: [] });
    expect(save.profile.coins).toBe(100);
    expect(save.storeProgress?.clears).toBe(1);
  });

  it('retains a reachable 2/3 goal at 79/80 and hides new impossible goals at campaign end', () => {
    const save = profile(80);
    save.storeProgress = { version: 1, season: '2026-11', clears: 2, piggy: 20 };
    expect(freeCampaignBonusState(save, now)).toMatchObject({ phase: 'progress', visible: true, remainingFirstClears: 1 });
    save.storeProgress.clears = 1;
    expect(freeCampaignBonusState(save, now)).toMatchObject({ phase: 'exhausted', visible: false });
    platformState(save).completedCampaign.push(campaignId(80));
    save.storeProgress = { version: 1, season: '2026-10', clears: 3, piggy: 30 };
    expect(settleFreeCampaignBonus(save, now)).toEqual({ season: '2026-10', coins: 10 });
    expect(freeCampaignBonusState(save, now)).toMatchObject({ phase: 'exhausted', visible: false, clears: 0 });
  });
});

describe('legacy event claim-only access', () => {
  it('lists frozen earned rewards without new events and never exposes Picture through the generic claim', () => {
    const save = profile();
    oldEvent(save);
    const picture = { ...legacy, id: 'picture', sourceFeatureId: 'hitapps-puzzle-event' };
    // Add both historical records before observing a later clock.
    const other = profile(); oldEvent(other, picture);
    save.events!.events.push(other.events!.events[0]);
    const snapshot = structuredClone(save), ready = legacyLiveOpsRewards(save);
    expect(ready).toMatchObject([{ eventKey: eventKey(legacy), source: legacy.sourceFeatureId, id: 'earned', reward: { coins: 17, hints: 2 } }]);
    ready[0].reward.coins = 999;
    expect(save).toEqual(snapshot);
    expect(claimLegacyLiveOpsReward(save, eventKey(picture), 'earned')).toBe(false);
    expect(claimLegacyLiveOpsReward(save, eventKey(legacy), 'unfinished')).toBe(false);
    expect(claimLegacyLiveOpsReward(save, eventKey(legacy), 'earned')).toBe(true);
    expect(claimLegacyLiveOpsReward(save, eventKey(legacy), 'earned')).toBe(false);
    expect(legacyLiveOpsRewards(save)).toEqual([]);
    expect(save.events!.events).toHaveLength(2);
    expect(save.events!.events[1].claimed).toEqual([]);
    expect(legacyLiveOpsRewards(profile())).toEqual([]);
  });
});

describe('earned retention rights through the authoritative SaveStore', () => {
  const cases = [
    { name: 'saved old Bonus', amount: 10, prepare(save: Save) { wonBonus(save); },
      claim(save: Save) { return claimDailyBonus(save, 'saved-prize', now); } },
    { name: 'old weekly milestone', amount: 20, prepare(save: Save) { oldTasks(save); claimTask(save, '2026-11-22', 'visit'); },
      claim(save: Save) { return claimTaskMilestone(save, '2026-11-16', 'week'); } },
    { name: 'old monthly free bonus', amount: 10, prepare(save: Save) { save.storeProgress = { version: 1, season: '2026-10', clears: 3, piggy: 30 }; },
      claim(save: Save) { return settleFreeCampaignBonus(save, now); } },
    { name: 'legacy event prize', amount: 17, prepare(save: Save) { oldEvent(save); },
      claim(save: Save) { return claimLegacyLiveOpsReward(save, eventKey(legacy), 'earned'); } },
  ];
  it.each(cases)('preserves $name through failed/ambiguous writes, duplicate taps, and active/parked reload', async ({ prepare, claim, amount }) => {
    let initial = profile();
    const deal = campaignDeals[1];
    initial = dispatch(initial, deal.winningPath[0], deal).next;
    switchMode(initial, 'daily', dailyForDay('2026-11-23'), 'parked-retention');
    prepare(initial);
    let raw = JSON.stringify(initial);
    let failure: 'none' | 'before' | 'after' = 'none';
    const disk = {
      getItem: async () => raw,
      setItem: async (_key: string, value: string) => {
        if (failure === 'before') throw Error('disk-before');
        raw = value;
        if (failure === 'after') throw Error('disk-after');
      },
      removeItem: async () => undefined,
    };
    const open = async () => {
      const store = new SaveStore(disk, findDeal, () => profile());
      await store.open(); return store;
    };
    const store = await open(), before = structuredClone(store.state), balance = store.state.profile.coins;
    const receive = (next: Save) => Boolean(claim(next));
    failure = 'before';
    await expect(store.mutate(receive)).rejects.toThrow();
    expect(store.state).toEqual(before);
    failure = 'after';
    expect(await store.mutate(receive)).toBe(true);
    failure = 'none';
    expect(await store.mutate(receive)).toBe(false);
    expect(store.state.profile.coins).toBe(balance + amount);
    const restored = await open();
    expect(await restored.mutate(receive)).toBe(false);
    expect(restored.state.profile.coins).toBe(balance + amount);
    expect(restored.state.attempt).toEqual(before.attempt);
    expect(restored.state.parked).toEqual(before.parked);
  });
});


it('schedules ordinary new days in an old source week while carrying its frozen rewards', () => {
  let save = profile(10);
  updatePreviewTasks(save, now, true);
  const original = save.dailyTasks!.weeks[0];
  expect(original.catalog).toBe('azur-compiled-r1');
  const earned = original.days[0].tasks[0];
  earned.progress = earned.target;
  const frozen = structuredClone(original);
  save = decodeSave(JSON.stringify(save), findDeal);
  for (const at of [now + DAY, now + 5 * DAY]) {
    updatePreviewTasks(save, at);
    expect(taskRewardState(save, at).today?.tasks.map(task => task.kind))
      .toEqual(['DailyLogin', 'DrawCards', 'ExecuteMoves', expect.stringMatching(/^(WinNoHints|CompleteLevels|CollectThemes)$/)]);
  }
  expect(save.dailyTasks!.weeks[0].milestones).toEqual(frozen.milestones);
  expect(save.dailyTasks!.weeks[0].days[0]).toEqual(frozen.days[0]);
  expect(claimTask(save, frozen.days[0].utc, earned.id)).toBe(true);
  expect(claimTask(save, frozen.days[0].utc, earned.id)).toBe(false);
});

it.skipIf(!releaseTasks)('issues a replayable assignment at 80/80 and never counts a replay as a first clear', () => {
  const tuesday = now + DAY, date = '2026-11-24';
  const deal = dailyForDay(date);
  let save = profile(80);
  switchMode(save, 'daily', deal, 'first-daily');
  updatePreviewTasks(save, tuesday);
  expect(taskRewardState(save, tuesday).today?.tasks.at(-1)?.kind).toBe('WinNoHints');
  const hint = dispatch(save, { type: 'hint', action: deal.winningPath[0], revision: save.revision }, deal, date);
  expect(hint.accepted).toBe(true);
  save = hint.next;
  save.attempt.verifiedTaskHints = 1;
  const winDaily = () => {
    for (const action of deal.winningPath) {
      const result = dispatch(save, action, deal, date);
      expect(result.accepted).toBe(true);
      for (const signal of acceptedTaskSignals(save, result, action, deal)) recordTaskSignal(result.next, tuesday, signal);
      save = result.next;
    }
  };
  winDaily();
  save = dispatch(save, { type: 'restart', attemptId: 'no-hint-replay' }, deal, date).next;
  winDaily();
  expect(taskRewardState(save, tuesday).today?.tasks.at(-1)).toMatchObject({ kind: 'WinNoHints', progress: 0 });

  const endgame = profile(80);
  platformState(endgame).completedCampaign.push(campaignId(80));
  updatePreviewTasks(endgame, tuesday);
  expect(taskRewardState(endgame, tuesday).today?.tasks.at(-1)).toMatchObject({
    kind: 'CollectThemes', target: 1, prize: { kind: 'Medals', quantity: 2 },
  });
  updatePreviewTasks(endgame, tuesday + 2 * DAY);
  expect(taskRewardState(endgame, tuesday + 2 * DAY).today?.tasks.at(-1)).toMatchObject({
    kind: 'CollectThemes', prize: { kind: 'Undo', quantity: 1 },
  });
});
