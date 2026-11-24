import { claimMilestone, eventKey, observeEvents, recordEventWin, settledFirstWin, type EventDefinition } from './ledger';
import type { Deal, Save } from '../types';

const DAY = 86_400_000, WEEK = 7 * DAY, MONDAY_EPOCH = 4 * DAY, GRACE = 4 * WEEK;
const race = 'hitapps-weekend-race', lava = 'hitapps-lava-quest', gold = 'hitapps-gold-rush-event';
export const liveOpsTitles = { [race]: 'Гонка выходного дня', [lava]: 'Лавовое испытание', [gold]: 'Золотая лихорадка' } as const;
export type LiveOpsSource = keyof typeof liveOpsTitles;

/** Compatibility claims never create a new occurrence or include Picture's separate owner. */
export function legacyLiveOpsRewards(save: Save) {
  return (save.events?.events ?? []).flatMap(record => {
    const source = record.definition.sourceFeatureId;
    if (!Object.hasOwn(liveOpsTitles, source)) return [];
    return record.definition.milestones.filter(milestone => milestone.threshold <= record.wins.length && !record.claimed.includes(milestone.id))
      .map(milestone => ({ eventKey: eventKey(record.definition), source: source as LiveOpsSource,
        title: liveOpsTitles[source as LiveOpsSource], id: milestone.id, threshold: milestone.threshold,
        progress: record.wins.length, endedAt: record.definition.schedule.end, reward: { ...milestone.reward } }));
  }).sort((a, b) => a.endedAt - b.endedAt || a.eventKey.localeCompare(b.eventKey) || a.id.localeCompare(b.id));
}

export function claimLegacyLiveOpsReward(save: Save, key: string, id: string): boolean {
  const record = save.events?.events.find(event => eventKey(event.definition) === key);
  if (!record || !Object.hasOwn(liveOpsTitles, record.definition.sourceFeatureId)) return false;
  return claimMilestone(save, key, id);
}

export function liveOpsDefinitions(now: number): EventDefinition[] {
  if (!Number.isSafeInteger(now) || now < 0 || now > 8.64e15 - WEEK) return [];
  const occurrence = Math.floor((now - MONDAY_EPOCH) / WEEK), start = occurrence * WEEK + MONDAY_EPOCH, end = start + WEEK;
  if (occurrence < 0) return [];
  const definitions = [
    [race, 'race', [{ id: 'stage-1', threshold: 2, reward: { coins: 10 } }, { id: 'stage-2', threshold: 4, reward: { coins: 20 } }]],
    [lava, 'lava', [{ id: 'streak-2', threshold: 2, reward: { coins: 10 } }, { id: 'streak-4', threshold: 4, reward: { coins: 24 } }]],
    [gold, 'gold', [{ id: 'gold-win', threshold: 1, reward: { coins: 15 } }]],
  ] as const;
  return definitions.map(([sourceFeatureId, type, milestones]) => ({
    id: `${type}-${occurrence}`, version: 1, sourceFeatureId,
    schedule: { start: sourceFeatureId === race ? start + 5 * DAY : start, end, clock: 'local', zone: 'UTC' }, daily: false, minCampaignLevel: 16, milestones,
  }));
}

export interface LavaRun { key: string; wins: number[] }
export function validLavaRun(value: LavaRun) {
  return Boolean(value && /^hitapps-lava-quest:lava-[0-9]+:1$/.test(value.key) &&
    Array.isArray(value.wins) && value.wins.length <= 4 && new Set(value.wins).size === value.wins.length &&
    value.wins.every(level => Number.isSafeInteger(level) && level >= 16));
}
export function recordLiveOpsLoss(save: Save) {
  if (save.lavaRun?.wins.length) save.lavaRun.wins = [];
}

export function recordLiveOpsWin(before: Save, after: Save, deal: Deal, now: number) {
  const result = settledFirstWin(before, after, deal);
  if (!result || result.mode !== 'campaign' || !result.campaignLevel || result.campaignLevel < 16 ||
      now < (after.events?.clocks.local ?? 0)) return;
  const defs = liveOpsDefinitions(now), raceEvent = defs[0], lavaEvent = defs[1], goldEvent = defs[2];
  if (!raceEvent || !lavaEvent || !goldEvent) return;
  const time = { localMs: now };
  observeEvents(after, defs, time);
  recordEventWin(after, [raceEvent], result, time);
  const lavaKey = eventKey(lavaEvent);
  if (after.lavaRun?.key !== lavaKey) after.lavaRun = { key: lavaKey, wins: [] };
  if ((after.attempt.director?.restarts ?? 0) > 0 || after.attempt.continued) recordLiveOpsLoss(after);
  else if (!after.lavaRun.wins.includes(result.campaignLevel)) {
    after.lavaRun.wins = [...after.lavaRun.wins, result.campaignLevel].slice(-4);
    if (after.lavaRun.wins.length >= 2) {
      // Materialize only streak milestones backed by a completed consecutive run.
      const record = after.events!.events.find(item => eventKey(item.definition) === lavaKey)!;
      for (const level of after.lavaRun.wins.slice(record.wins.length)) {
        recordEventWin(after, [lavaEvent], { id: 'campaign:' + level, campaignLevel: level, mode: 'campaign' }, time);
      }
    }
  }
  const marked = deal.golden?.ids;
  if (marked?.length && marked.every(id => after.attempt.board.collected.includes(id))) recordEventWin(after, [goldEvent], result, time);
  // Settle before archival. An earned, unclaimed milestone remains available after the window.
  if (after.events) after.events.events = after.events.events.filter(event =>
    !Object.hasOwn(liveOpsTitles, event.definition.sourceFeatureId) || now - event.definition.schedule.end <= GRACE ||
    event.definition.milestones.some(item => item.threshold <= event.wins.length && !event.claimed.includes(item.id)));
}
