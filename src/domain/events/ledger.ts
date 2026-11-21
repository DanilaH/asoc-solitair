import { campaignId } from '../progression';
import type { Deal, Save } from '../types';

const resources = ['coins', 'hints', 'undos', 'jokers'] as const;
type EventResource = typeof resources[number];
export type EventReward = Partial<Record<EventResource, number>>;

export interface EventDefinition {
  id: string;
  version: number;
  sourceFeatureId: string;
  schedule: { clock: 'local' | 'server'; zone: string; start: number; end: number };
  minCampaignLevel: number;
  daily: boolean;
  milestones: readonly { id: string; threshold: number; reward: EventReward }[];
}

export interface EventTime { localMs: number; verifiedServerMs?: number }
interface EventWin { id: string; mode: 'campaign'|'daily'; campaignLevel?: number }
interface EventRecord {
  definition: EventDefinition;
  wins: { id: string; day: string }[];
  claimed: string[];
}

export interface EventLedger {
  schema: 1;
  clocks: { local?: number; server?: number };
  events: EventRecord[];
}

const keyText = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: number) => natural(value) && value <= 8.64e15;
export const eventKey = ({ sourceFeatureId, id, version }: EventDefinition) => `${sourceFeatureId}:${id}:${version}`;

export function eventDay(zone: string, at: number): string | undefined {
  if (!timestamp(at)) return;
  try {
    const pieces = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(at);
    const get = (type: Intl.DateTimeFormatPartTypes) => pieces.find(piece => piece.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch { return; }
}

function validDefinition(def: EventDefinition): boolean {
  return Boolean(def && keyText(def.id) && keyText(def.sourceFeatureId) && natural(def.version) &&
    def.version > 0 && natural(def.minCampaignLevel) && typeof def.daily === 'boolean' && def.schedule &&
    ['local', 'server'].includes(def.schedule.clock) && typeof def.schedule.zone === 'string' &&
    eventDay(def.schedule.zone, def.schedule.start) && timestamp(def.schedule.end) && def.schedule.start < def.schedule.end &&
    Array.isArray(def.milestones) && def.milestones.length &&
    def.milestones.every(item => item && keyText(item.id) && natural(item.threshold) && item.threshold > 0 && item.reward &&
      Object.entries(item.reward).length && Object.entries(item.reward).every(([kind, value]) =>
        resources.includes(kind as EventResource) && typeof value === 'number' && natural(value) && value > 0)) &&
    new Set(def.milestones.map(item => item.id)).size === def.milestones.length);
}

export function validEventLedger(value: EventLedger): boolean {
  if (!value || value.schema !== 1 || !value.clocks || !Array.isArray(value.events) ||
    !Object.entries(value.clocks).every(([clock, time]) => ['local', 'server'].includes(clock) && timestamp(time))) return false;
  const ids = new Set<string>();
  return value.events.every(record => {
    if (!record || !validDefinition(record.definition) || !Array.isArray(record.wins) || !Array.isArray(record.claimed)) return false;
    const key = eventKey(record.definition);
    if (ids.has(key)) return false;
    ids.add(key);
    return record.wins.every(win => win && typeof win.id === 'string' && /^(campaign:[1-9]\d*|daily:\d{4}-\d{2}-\d{2})$/.test(win.id) &&
      typeof win.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(win.day)) &&
      new Set(record.wins.map(win => win.id)).size === record.wins.length &&
      record.claimed.every(id => record.definition.milestones.some(item => item.id === id && item.threshold <= record.wins.length)) &&
      new Set(record.claimed).size === record.claimed.length;
  });
}

export function settledFirstWin(before: Save, after: Save, deal: Deal): EventWin | undefined {
  if (before.attempt.id !== after.attempt.id || before.attempt.dealId !== deal.id || after.attempt.dealId !== deal.id ||
    before.attempt.board.phase !== 'playing' || after.attempt.board.phase !== 'won') return;
  if (after.attempt.daily) {
    const { dayId } = after.attempt.daily;
    if (before.attempt.daily?.dayId !== dayId || before.meta?.dailyDates.includes(dayId) || !after.meta?.dailyDates.includes(dayId) ||
      !after.attempt.payout?.some(grant => grant.reason === 'daily_completion')) return;
    return { id: `daily:${dayId}`, mode: 'daily' };
  }
  if (!deal.campaignLevel || !after.attempt.payout?.some(grant => grant.reason === 'win')) return;
  const id = campaignId(deal.campaignLevel);
  if (before.platform?.completedCampaign.includes(id) || !after.platform?.completedCampaign.includes(id)) return;
  return { id: `campaign:${deal.campaignLevel}`, mode: 'campaign', campaignLevel: deal.campaignLevel };
}

function clockFor(clock: EventDefinition['schedule']['clock'], time: EventTime): number | undefined {
  const now = clock === 'server' ? time.verifiedServerMs : time.localMs;
  return now !== undefined && timestamp(now) ? now : undefined;
}

export function observeEvents(save: Save, definitions: readonly EventDefinition[], time: EventTime): void {
  if (definitions.length === 0 && !save.events) return;
  const clocks: EventLedger['clocks'] = { ...save.events?.clocks };
  for (const clock of ['local', 'server'] as const) {
    const now = clockFor(clock, time);
    if (now !== undefined && now >= (clocks[clock] ?? 0)) clocks[clock] = now;
  }
  const events = [...(save.events?.events ?? [])];
  for (const definition of definitions) {
    if (!validDefinition(definition) || events.some(record => eventKey(record.definition) === eventKey(definition))) continue;
    const now = clockFor(definition.schedule.clock, time);
    if (now === undefined || now < (clocks[definition.schedule.clock] ?? 0) ||
      now < definition.schedule.start || now >= definition.schedule.end) continue;
    events.push({ definition: structuredClone(definition), wins: [], claimed: [] });
  }
  if (save.events || definitions.some(validDefinition)) save.events = { schema: 1, clocks, events };
}

export function recordEventWin(save: Save, definitions: readonly EventDefinition[], win: EventWin, time: EventTime): number {
  if (win.mode === 'daily' ? !/^daily:\d{4}-\d{2}-\d{2}$/.test(win.id) :
    !win.campaignLevel || !natural(win.campaignLevel) || win.id !== `campaign:${win.campaignLevel}`) return 0;
  observeEvents(save, definitions, time);
  let changed = 0;
  for (const event of save.events?.events ?? []) {
    const { clock, start, end, zone } = event.definition.schedule;
    const now = clockFor(clock, time);
    if (now === undefined || now < (save.events?.clocks[clock] ?? 0) || now < start || now >= end ||
      !definitions.some(definition => eventKey(definition) === eventKey(event.definition)) ||
      (win.mode === 'daily' ? !event.definition.daily : !win.campaignLevel || win.campaignLevel < event.definition.minCampaignLevel) ||
      event.wins.some(value => value.id === win.id)) continue;
    const day = eventDay(zone, now);
    if (!day) continue;
    event.wins.push({ id: win.id, day });
    changed++;
  }
  return changed;
}

export function availableEvents(save: Save) {
  return (save.events?.events ?? []).map(event => {
    const earned = event.definition.milestones.filter(item => item.threshold <= event.wins.length);
    const ready = earned.filter(item => !event.claimed.includes(item.id));
    const allReached = earned.length === event.definition.milestones.length;
    const ended = (save.events?.clocks[event.definition.schedule.clock] ?? 0) >= event.definition.schedule.end;
    const phase = allReached ? (ready.length ? 'completed' : 'claimed') : ended ? 'expired' : 'active';
    return { key: eventKey(event.definition), phase, progress: event.wins.length, ready };
  });
}

/** Caller commits progress and money through the same SaveStore transaction. Claims stay valid after expiration. */
export function claimMilestone(save: Save, key: string, id: string): boolean {
  const event = save.events?.events.find(record => eventKey(record.definition) === key);
  const award = event?.definition.milestones.find(item => item.id === id);
  if (!event || !award || event.claimed.includes(id) || award.threshold > event.wins.length) return false;
  const grants = Object.entries(award.reward) as [EventResource, number][];
  if (grants.some(([resource, amount]) => !natural(save.profile[resource] + amount))) return false;
  for (const [resource, amount] of grants) save.profile[resource] += amount;
  event.claimed.push(id);
  return true;
}
