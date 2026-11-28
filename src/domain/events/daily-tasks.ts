import { CAMPAIGN_META } from '../../config/campaign-meta';
import { M1_RETENTION } from '../../config/retention-m1';
import { E4_M1, M1 } from '../../config/economy';
import { releaseProfile } from '../../config/profile';
import { CAMPAIGN_LENGTH, completedLevels } from '../progression';
import { rewardOfferState } from '../reward-offers';
import sourceRows from './azur-task-source.json' with { type: 'json' };
import type { Command, Deal, Result, Save } from '../types';
import { settledFirstWin } from './ledger';
import type { PurchaseOrder } from '../commerce/orders';

export const TaskKind = {
  Unknown: 0, CompleteLevels: 1, CollectThemes: 2, ExecuteMoves: 3, UseHints: 4, WinNoHints: 5,
  DrawCards: 6, DailyLogin: 7, CollectDailyBonuses: 8, UseDefinitions: 9, UseJokers: 10,
  UseRollbacks: 11, UseShuffles: 12, EarnCoins: 13, BuyExtraMoves: 14, BuyBoosters: 15, MakePurchase: 16,
} as const;
export const RewardKind = {
  Coins: 0, MoveHint: 1, Undo: 2, Definition: 3, Shuffle: 4, Joker: 5, Medals: 6, RandomBoostersChest: 7, CardBack: 8,
} as const;
type Task = keyof typeof TaskKind;
type Reward = keyof typeof RewardKind;
type Channel = 'board' | 'helper' | 'login' | 'daily-bonus' | 'wallet' | 'continue' | 'purchase';

const channel: Record<Exclude<Task, 'Unknown'>, Channel> = {
  CompleteLevels: 'board', CollectThemes: 'board', ExecuteMoves: 'board', UseHints: 'helper', WinNoHints: 'board',
  DrawCards: 'board', DailyLogin: 'login', CollectDailyBonuses: 'daily-bonus', UseDefinitions: 'helper',
  UseJokers: 'helper', UseRollbacks: 'helper', UseShuffles: 'helper', EarnCoins: 'wallet', BuyExtraMoves: 'continue',
  BuyBoosters: 'wallet', MakePurchase: 'purchase',
};

export type TaskPrize = { kind: Reward; quantity: number };
export interface TaskTarget { id: string; kind: Exclude<Task, 'Unknown'>; target: number; prize: TaskPrize; bonus?: TaskPrize }
export interface TaskSignal { id: string; kind: Exclude<Task, 'Unknown'>; channel: Channel; amount: number; attemptId?: string }
interface DayTask extends TaskTarget { progress: number; claimed?: true }
interface WeekMilestone { id: string; medals: number; prize: TaskPrize; bundle?: TaskPrize[]; chest?: TaskPrize }
type Catalog = 'c8-task-base-r1' | 'azur-compiled-r1' | typeof M1_RETENTION.id;
interface Week {
  startUtc: string;
  catalog?: Catalog;
  totalMedals: number;
  claimedMilestones: string[];
  milestones: WeekMilestone[];
  days: { utc: string; tasks: DayTask[] }[];
}

export interface DailyTaskJournal {
  version: 1;
  lastUtc: string;
  weeks: Week[];
  seenSignals: string[];
  signalHistoryVersion?: 1;
  retiredGameRevision?: number;
  hintedAttempts: string[];
  loginDaysUtc: string[];
  inventory: { definitions: number; shuffles: number; chestKeys: string[]; cardBack: boolean; weeklyChests?: Record<string, TaskPrize> };
}

/** Shared helper inventory may exist before any task day is scheduled. */
export function taskJournal(save: Save): DailyTaskJournal {
  return save.dailyTasks ??= { version: 1, lastUtc: '0001-01-01', weeks: [], seenSignals: [],
    signalHistoryVersion: 1, hintedAttempts: [], loginDaysUtc: [],
    inventory: { definitions: 0, shuffles: 0, chestKeys: [], cardBack: false } };
}

const DAY = 86_400_000;
const token = (value: unknown): value is string => typeof value === 'string' && /^[0-9A-Za-z_.:-]{1,160}$/.test(value);
const natural = (n: number) => Number.isSafeInteger(n) && n >= 0;
const utcKey = (now: number) => Number.isSafeInteger(now) && now >= -62167219200000 && now <= 253402300799999
  ? new Date(now).toISOString().slice(0, 10) : undefined;
const parseUtc = (utc: string) => Date.parse(utc + 'T00:00:00.000Z');
const realDate = (utc: string) => /^\d{4}-\d{2}-\d{2}$/.test(utc) && utcKey(parseUtc(utc)) === utc;
const weekOf = (day: string) => {
  const at = parseUtc(day), weekday = new Date(at).getUTCDay();
  return utcKey(at - ((weekday + 6) % 7) * DAY)!;
};

function validPrize(prize: TaskPrize): boolean {
  return Boolean(prize && Object.hasOwn(RewardKind, prize.kind) && natural(prize.quantity) && prize.quantity > 0 &&
    prize.quantity <= (prize.kind === 'Coins' ? 5000 : prize.kind === 'Medals' ? 250 : 100));
}
function validTask(prize: TaskTarget): boolean {
  return Boolean(prize && token(prize.id) && Object.hasOwn(channel, prize.kind) && natural(prize.target) && prize.target > 0 &&
    validPrize(prize.prize) && (prize.bonus === undefined || validPrize(prize.bonus)));
}

const uniqueTokens = (items: unknown): items is string[] => Array.isArray(items) &&
  items.every(token) && new Set(items).size === items.length;

function gameRevision(id: string) {
  const match = /^game:[A-Za-z0-9_-]{1,100}:(\d+):([A-Za-z]+)$/.exec(id);
  const revision = match && Number(match[1]);
  return match && Object.hasOwn(channel, match[2]) && typeof revision === 'number' && natural(revision) ? revision : undefined;
}

function retireGameSignals(state: DailyTaskJournal) {
  state.seenSignals = state.seenSignals.filter(id => {
    const revision = gameRevision(id);
    if (revision !== undefined) {
      state.retiredGameRevision = Math.max(state.retiredGameRevision ?? 0, revision);
      return false;
    }
    return !/^login:\d{4}-\d{2}-\d{2}$/.test(id) || !state.loginDaysUtc.includes(id.slice(6));
  });
}

export function migrateTaskSignalHistory(save: Save) {
  const state = save.dailyTasks;
  if (!state || state.signalHistoryVersion === 1) return;
  retireGameSignals(state);
  const active = new Set([save.attempt.id, save.parked?.campaign?.id, save.parked?.daily?.id]);
  state.hintedAttempts = state.hintedAttempts.filter(id => active.has(id));
  state.signalHistoryVersion = 1;
}

const chestKinds = ['MoveHint', 'Undo', 'Definition', 'Shuffle'] as const;
const validWeeklyChest = (prize: TaskPrize) => validPrize(prize) && prize.quantity === 1 &&
  chestKinds.some(kind => kind === prize.kind);

const validMilestone = (milestone: WeekMilestone) => Boolean(milestone &&
  validTask({ id: milestone.id, kind: 'DailyLogin', target: milestone.medals, prize: milestone.prize }) &&
  (milestone.chest === undefined || validWeeklyChest(milestone.chest)) &&
  (milestone.bundle === undefined || (Array.isArray(milestone.bundle) && milestone.bundle.every(validPrize))));
export function validDailyTasks(state: DailyTaskJournal): boolean {
  return Boolean(state && state.version === 1 && realDate(state.lastUtc) && uniqueTokens(state.seenSignals) &&
    (state.signalHistoryVersion === undefined || state.signalHistoryVersion === 1) &&
    (state.retiredGameRevision === undefined || state.signalHistoryVersion === 1 && natural(state.retiredGameRevision)) &&
    uniqueTokens(state.hintedAttempts) && uniqueTokens(state.loginDaysUtc) && state.loginDaysUtc.every(realDate) &&
    state.inventory && natural(state.inventory.definitions) && natural(state.inventory.shuffles) &&
    typeof state.inventory.cardBack === 'boolean' && uniqueTokens(state.inventory.chestKeys) &&
    (state.inventory.weeklyChests === undefined || Object.entries(state.inventory.weeklyChests)
      .every(([key, prize]) => token(key) && state.inventory.chestKeys.includes(key) && validWeeklyChest(prize))) &&
    Array.isArray(state.weeks) && new Set(state.weeks.map(week => week.startUtc)).size === state.weeks.length &&
    state.weeks.every(week => week && realDate(week.startUtc) && week.startUtc === weekOf(week.startUtc) &&
      (week.catalog === undefined || ['c8-task-base-r1', 'azur-compiled-r1', M1_RETENTION.id].includes(week.catalog)) &&
      natural(week.totalMedals) && uniqueTokens(week.claimedMilestones) && Array.isArray(week.milestones) &&
      week.milestones.every(validMilestone) && new Set(week.milestones.map(item => item.id)).size === week.milestones.length &&
      week.claimedMilestones.every(id => week.milestones.some(item => item.id === id && item.medals <= week.totalMedals)) && Array.isArray(week.days) &&
      new Set(week.days.map(day => day.utc)).size === week.days.length &&
      week.days.every(day => day && realDate(day.utc) && weekOf(day.utc) === week.startUtc && day.utc <= state.lastUtc &&
        Array.isArray(day.tasks) && new Set(day.tasks.map(task => task.id)).size === day.tasks.length &&
        day.tasks.every(task => validTask(task) && natural(task.progress) && task.progress <= task.target &&
          (task.claimed === undefined || task.claimed === true && task.progress === task.target)))));
}

export function scheduleTasks(save: Save, now: number, definitions: readonly TaskTarget[], milestones: readonly WeekMilestone[] = [], catalog?: Catalog): boolean {
  const utc = utcKey(now);
  if (!utc || !definitions.length || !milestones.every(validMilestone) ||
    new Set(milestones.map(item => item.id)).size !== milestones.length || definitions.some(definition => !validTask(definition)) ||
    new Set(definitions.map(definition => definition.id)).size !== definitions.length || utc < (save.dailyTasks?.lastUtc ?? '')) return false;
  const state = taskJournal(save);
  const weekStart = weekOf(utc);
  let week = state.weeks.find(entry => entry.startUtc === weekStart);
  if (!week) {
    week = { startUtc: weekStart, ...(catalog ? { catalog } : {}), totalMedals: 0, claimedMilestones: [], milestones: [...structuredClone(milestones)], days: [] };
    state.weeks.push(week);
  }
  if (week.days.some(day => day.utc === utc)) return false;
  if (state.lastUtc !== utc) retireGameSignals(state);
  state.lastUtc = utc;
  week.days.push({ utc, tasks: definitions.map(definition => ({ ...structuredClone(definition), progress: 0 })) });
  return true;
}

export function recordTaskSignal(save: Save, now: number, signal: TaskSignal): boolean {
  const utc = utcKey(now), state = save.dailyTasks, day = state?.weeks.flatMap(week => week.days).find(day => day.utc === utc);
  if (!state || !day || utc !== state.lastUtc || !token(signal.id) || !Object.hasOwn(channel, signal.kind) ||
    channel[signal.kind] !== signal.channel || !natural(signal.amount) || !signal.amount ||
    (signal.attemptId !== undefined && !token(signal.attemptId))) return false;
  const revision = gameRevision(signal.id);
  if (revision !== undefined && revision <= (state.retiredGameRevision ?? -1)) return false;
  const login = signal.kind === 'DailyLogin';
  const key = login ? `login:${utc}` : signal.id;
  if (state.seenSignals.includes(key) || login && state.loginDaysUtc.includes(utc)) return false;
  if (signal.kind === 'WinNoHints' && (!signal.attemptId || state.hintedAttempts.includes(signal.attemptId))) return false;
  const tasks = day.tasks.filter(task => task.kind === signal.kind && !task.claimed && task.progress < task.target);
  const hinted = signal.kind === 'UseHints' && revision === undefined && signal.attemptId && !state.hintedAttempts.includes(signal.attemptId)
    ? signal.attemptId : undefined;
  if (hinted) state.hintedAttempts.push(hinted);
  if (login) state.loginDaysUtc.push(utc);
  if (!tasks.length) return login || hinted !== undefined;
  if (!login) state.seenSignals.push(key);
  for (const task of tasks) task.progress += Math.min(signal.amount, task.target - task.progress);
  return true;
}

export function acceptedTaskSignals(before: Save, result: Result, cmd: Command, deal: Deal): TaskSignal[] {
  if (!result.accepted) return [];
  const { next, events } = result;
  const attemptId = next.attempt.id;
  const signals: TaskSignal[] = [];
  const report = (kind: Exclude<Task, 'Unknown'>, amount: number, id?: string) => {
    if (amount > 0) signals.push({ id: id ?? `game:${attemptId}:${next.revision}:${kind}`, kind, channel: channel[kind], amount, attemptId });
  };
  const win = settledFirstWin(before, next, deal);
  if (win) {
    report('CompleteLevels', 1, `win:${win.id}`);
    if (result.next.attempt.verifiedTaskHints === 0) report('WinNoHints', 1, `no-hints:${win.id}`);
  }
  if (cmd.type === 'draw' || cmd.type === 'transfer' || cmd.type === 'recycle') report('ExecuteMoves', 1);
  report('CollectThemes', events.filter(event => event.type === 'complete').length);
  report('DrawCards', events.filter(event => event.type === 'draw').length);
  report('UseHints', events.filter(event => event.type === 'hint' && event.reason !== 'offered').length);
  report('UseJokers', events.filter(event => event.type === 'joker').length);
  report('UseRollbacks', events.filter(event => event.type === 'undo').length);
  if (cmd.type !== 'undo') report('EarnCoins', next.profile.coins - before.profile.coins);
  return signals;
}

/** Only an authorized provider path may call this ledger adapter. Synthetic orders stay in offline tests. */
export function purchaseTaskSignal(order: PurchaseOrder, trustedProvider: string | undefined): TaskSignal | undefined {
  if (!trustedProvider || order.provider !== trustedProvider || order.status !== 'paid' || !order.acknowledged ||
    !order.purchaseId || !order.grant) return;
  const id = `purchase:${order.purchaseId}`;
  if (token(id)) return { id, kind: 'MakePurchase', channel: 'purchase', amount: 1 };
}

const walletFields = { Coins: 'coins', MoveHint: 'hints', Undo: 'undos', Joker: 'jokers' } as const;

function grant(save: Save, week: Week, prize: TaskTarget['prize'], key: string): boolean {
  const { kind, quantity } = prize, state = save.dailyTasks!;
  const field = walletFields[kind as keyof typeof walletFields];
  if (field) {
    if (!natural(save.profile[field] + quantity)) return false;
    save.profile[field] += quantity;
  } else if (kind === 'Medals') {
    if (!natural(week.totalMedals + quantity)) return false;
    week.totalMedals += quantity;
  } else if (kind === 'CardBack') state.inventory.cardBack = true;
  else if (kind === 'RandomBoostersChest') {
    const keys = Array.from({ length: quantity }, (_, index) => `${key}:${index}`);
    if (!keys.every(token)) return false;
    state.inventory.chestKeys.push(...keys);
  } else {
    const item = kind === 'Definition' ? 'definitions' : 'shuffles';
    if (!natural(state.inventory[item] + quantity)) return false;
    state.inventory[item] += quantity;
  }
  return true;
}

function grantBundle(save: Save, week: Week, prizes: readonly TaskPrize[], key: string) {
  const draft = structuredClone(save);
  const target = draft.dailyTasks!.weeks.find(entry => entry.startUtc === week.startUtc)!;
  if (!prizes.every(prize => grant(draft, target, prize, key))) return false;
  save.profile = draft.profile;
  save.rewardOffers = draft.rewardOffers;
  save.dailyTasks!.inventory = draft.dailyTasks!.inventory;
  week.totalMedals = target.totalMedals;
  return true;
}

/** Canonical helper inventory for grants outside Tasks, including free Daily Bonus. */
export function grantEventPrize(save: Save, prize: TaskPrize): boolean {
  if (!validPrize(prize)) return false;
  const field = walletFields[prize.kind as keyof typeof walletFields];
  if (field && natural(save.profile[field] + prize.quantity)) {
    save.profile[field] += prize.quantity;
    return true;
  }
  if (prize.kind === 'Definition') {
    const offers = rewardOfferState(save);
    if (!natural(offers.definitions + prize.quantity)) return false;
    offers.definitions += prize.quantity;
    return true;
  }
  if (prize.kind === 'Shuffle' && natural((save.dailyTasks?.inventory.shuffles ?? 0) + prize.quantity)) {
    taskJournal(save).inventory.shuffles += prize.quantity;
    return true;
  }
  return false;
}

export function claimTask(save: Save, utc: string, id: string): boolean {
  if (!realDate(utc)) return false;
  const week = save.dailyTasks?.weeks.find(week => week.startUtc === weekOf(utc));
  const task = week?.days.find(day => day.utc === utc)?.tasks.find(task => task.id === id);
  if (!week || !task || task.claimed || task.progress < task.target || !grantBundle(save, week, [task.prize, ...(task.bonus ? [task.bonus] : [])], `task:${utc}:${id}`)) return false;
  task.claimed = true;
  return true;
}

export function claimTaskMilestone(save: Save, weekStart: string, id: string): boolean {
  const week = save.dailyTasks?.weeks.find(week => week.startUtc === weekStart);
  const config = week?.milestones.find(item => item.id === id);
  const key = `weekly:${weekStart}:${id}`;
  if (!week || !config || week.totalMedals < config.medals || week.claimedMilestones.includes(id) ||
    !grantBundle(save, week, [config.prize, ...(config.bundle ?? [])], key)) return false;
  if (config.chest) {
    const inventory = save.dailyTasks!.inventory;
    const chestKey = key + ':0';
    inventory.chestKeys.push(chestKey);
    (inventory.weeklyChests ??= {})[chestKey] = { ...config.chest };
  }
  week.claimedMilestones.push(id);
  return true;
}

export function useTaskCharge(save: Save, item: 'definitions'|'shuffles'): boolean {
  const inventory = save.dailyTasks?.inventory;
  if (!inventory?.[item]) return false;
  inventory[item]--;
  return true;
}

export function openWeeklyChest(save: Save, key: string): TaskPrize | undefined {
  const inventory = save.dailyTasks?.inventory, prize = inventory?.weeklyChests?.[key];
  const index = inventory?.chestKeys.indexOf(key) ?? -1;
  if (!inventory || !prize || index < 0 || !validWeeklyChest(prize) || !grantEventPrize(save, prize)) return;
  inventory.chestKeys.splice(index, 1);
  delete inventory.weeklyChests![key];
  return prize;
}

export function openTaskChest(save: Save, chestKey: string): 'hints'|'undos'|'jokers' | undefined {
  const inventory = save.dailyTasks?.inventory;
  const index = inventory?.chestKeys.indexOf(chestKey) ?? -1;
  if (!inventory || index < 0 || inventory.weeklyChests?.[chestKey]) return;
  const scope = ['hints', 'undos', 'jokers'] as const;
  const seed = [...chestKey].reduce((value, name) => (Math.imul(value, 31) + name.charCodeAt(0)) >>> 0, 1);
  const reward = scope[seed % scope.length];
  if (!natural(save.profile[reward] + 1)) return;
  save.profile[reward]++;
  inventory.chestKeys.splice(index, 1);
  return reward;
}

const sourceTasks = import.meta.env?.VITE_CONTENT8_DAILY_TASKS === 'source';
export const releaseTasks = releaseProfile?.capabilities.retention === 'c8-retention-candidate-r1';
export const TASKS_PREVIEW = releaseTasks || sourceTasks || import.meta.env?.VITE_CONTENT8_DAILY_TASKS === '1';
const earnedRows: readonly TaskTarget[] = [
  { id: 'visit', kind: 'DailyLogin', target: 1, prize: { kind: 'Medals', quantity: 1 } },
  { id: 'draw', kind: 'DrawCards', target: 1, prize: { kind: 'Coins', quantity: 10 } },
  { id: 'moves', kind: 'ExecuteMoves', target: 4, prize: { kind: 'MoveHint', quantity: 1 } },
  { id: 'topic', kind: 'CollectThemes', target: 1, prize: { kind: 'Medals', quantity: 2 } },
  { id: 'win', kind: 'CompleteLevels', target: 1, prize: { kind: 'Undo', quantity: 1 } },
];

type SourceRow = [Exclude<Task, 'Unknown'>, number, number, Reward, number];
export const azurTaskDays = (sourceRows as SourceRow[][]).map((rows, d): TaskTarget[] =>
  rows.map(([kind, target, medals, bonusKind, bonusAmount], i) => ({
    id: `azur-${d + 1}-${i + 1}`, kind, target, prize: { kind: 'Medals', quantity: medals },
    ...(bonusAmount ? { bonus: { kind: bonusKind, quantity: bonusAmount } } : {}),
  })));

function sourceMilestones(now: number): WeekMilestone[] {
  const prize = (kind: Reward, quantity: number): TaskPrize => ({ kind, quantity });
  const pool = ['MoveHint', 'Undo', 'Definition', 'Shuffle'] as const;
  const types = [...pool];
  // A stable product seed keeps the same saved subset for the whole UTC week.
  let state = (Math.floor(now / DAY) + 97) >>> 0;
  for (let i = 0; i < 3; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = i + state % (types.length - i);
    [types[i], types[j]] = [types[j], types[i]];
  }
  return [
    { id: 'source-50', medals: 50, prize: prize('Coins', 500), bundle: [prize('MoveHint', 2)] },
    { id: 'source-100', medals: 100, prize: prize('MoveHint', 5), bundle: [prize('Undo', 5)] },
    { id: 'source-300', medals: 300, prize: prize('Shuffle', 7), bundle: [prize('Definition', 7)] },
    { id: 'source-600', medals: 600, prize: prize('Joker', 3), bundle: [prize('Coins', 2000)] },
    { id: 'source-1000', medals: 1000, prize: prize('Coins', 5000),
      bundle: [...types.slice(0, 3).map(kind => prize(kind, 4)), prize('CardBack', 1)] },
  ];
}

export function m1WeekRows(day: number): TaskTarget[] {
  return M1_RETENTION.daily[day].map(([kind, target], index) => ({
    id: `m1-task-${day + 1}-${index + 1}`, kind, target,
    prize: { kind: 'Medals', quantity: azurTaskDays[day][index].prize.quantity },
    ...(index === 1 && day !== 1 ? { bonus: { kind: 'MoveHint', quantity: 1 } } :
      index === 2 && (day === 3 || day === 5) ? { bonus: { kind: 'Undo', quantity: 1 } } : {}),
  }));
}

function m1WeekMilestones(save: Save, at: number): WeekMilestone[] {
  const stages = M1_RETENTION.milestones;
  const kinds = completedLevels(save) < CAMPAIGN_LENGTH ? chestKinds : chestKinds.slice(0, -1);
  const chosen = (Math.imul(at / DAY, 1664525) + 1013904223) >>> 0;
  return stages.map(([medals, coins]) => ({
    id: 'm1-week-' + medals, medals,
    prize: coins ? { kind: 'Coins', quantity: coins } : { kind: 'Definition', quantity: 1 },
    ...(medals === 1000 && { chest: { kind: kinds[chosen % kinds.length], quantity: 1 } }),
  }));
}

export function updatePreviewTasks(save: Save, now: number, useSourceCatalog = sourceTasks): void {
  const utc = utcKey(now);
  if (!utc) return;
  const day = new Date(now).getUTCDay();
  const weekStart = weekOf(utc);
  const existing = save.dailyTasks?.weeks.find(week => week.startUtc === weekStart);
  const catalog = CAMPAIGN_META
    ? existing ? existing.catalog ?? 'c8-task-base-r1' : M1_RETENTION.id
    : useSourceCatalog ? existing?.catalog ?? 'azur-compiled-r1' : 'c8-task-base-r1';
  if (catalog === M1_RETENTION.id) {
    scheduleTasks(save, now, m1WeekRows((day + 6) % 7), m1WeekMilestones(save, parseUtc(weekStart)), catalog);
    return;
  }
  if (catalog === 'azur-compiled-r1') {
    scheduleTasks(save, now, azurTaskDays[(day + 6) % 7], sourceMilestones(parseUtc(weekStart)), catalog);
    return;
  }
  // Day rows are assigned once. Older days and their weekly prizes keep their saved terms.
  const finishedCampaign = releaseTasks && completedLevels(save) === CAMPAIGN_LENGTH;
  const fourth: TaskTarget = releaseTasks && day % 3 === 2
    ? finishedCampaign ? earnedRows[3] : { id: 'no-hint', kind: 'WinNoHints', target: 1, prize: { kind: 'Medals', quantity: 2 } }
    : day % 2 ? earnedRows[3] : finishedCampaign ? { ...earnedRows[4], id: 'theme-undo', kind: 'CollectThemes' } : earnedRows[4];
  const rows = [...earnedRows.slice(0, 3), fourth].map(row => E4_M1 && row.prize.kind === 'Coins'
    ? { ...row, prize: { ...row.prize, quantity: M1.taskCoins } } : row);
  scheduleTasks(save, now, rows,
    [{ id: 'week', medals: 5, prize: { kind: 'Coins', quantity: E4_M1 ? M1.weekly : 20 } }], catalog);
}

export const shouldScheduleTasks = (save: Save, now: number) => (utcKey(now) ?? '') > (save.dailyTasks?.lastUtc ?? '');

export function currentTasks(save: Save) {
  const journal = save.dailyTasks;
  if (!journal) return;
  const week = journal.weeks.find(week => week.startUtc === weekOf(journal.lastUtc));
  const day = week?.days.find(day => day.utc === journal.lastUtc);
  if (week && day) return { week, day };
}

export type PendingTaskReward = {
  kind: 'task'; key: string; utc: string; weekStart: string; id: string; task: DayTask; prizes: TaskPrize[];
} | {
  kind: 'milestone'; key: string; weekStart: string; id: string; milestone: WeekMilestone; prizes: TaskPrize[];
};

/** Existing frozen rights only. No schedule, grant, or current-catalog substitution. */
export function pendingTaskRewards(save: Save): PendingTaskReward[] {
  const rewards: PendingTaskReward[] = [];
  for (const week of save.dailyTasks?.weeks ?? []) {
    for (const day of week.days) for (const task of day.tasks) {
      if (!task.claimed && task.progress >= task.target) rewards.push({ kind: 'task', key: `task:${day.utc}:${task.id}`,
        utc: day.utc, weekStart: week.startUtc, id: task.id, task: structuredClone(task),
        prizes: structuredClone([task.prize, ...(task.bonus ? [task.bonus] : [])]) });
    }
    for (const milestone of week.milestones) {
      if (week.totalMedals >= milestone.medals && !week.claimedMilestones.includes(milestone.id)) {
        rewards.push({ kind: 'milestone', key: `weekly:${week.startUtc}:${milestone.id}`, weekStart: week.startUtc,
          id: milestone.id, milestone: structuredClone(milestone),
          prizes: structuredClone([milestone.prize, ...(milestone.bundle ?? [])]) });
      }
    }
  }
  return rewards.sort((a, b) => (a.kind === 'task' ? a.utc : a.weekStart).localeCompare(b.kind === 'task' ? b.utc : b.weekStart) || a.key.localeCompare(b.key));
}

export function taskRewardState(save: Save, now: number) {
  const utc = utcKey(now), journal = save.dailyTasks;
  const clock = !utc ? 'invalid' : !journal ? 'empty' : journal.lastUtc > utc ? 'future' : journal.lastUtc < utc ? 'stale' : 'current';
  const weekStart = utc ? weekOf(utc) : undefined;
  // A saved future day must not masquerade as today's assignment after clock rollback.
  const week = clock !== 'future' ? journal?.weeks.find(item => item.startUtc === weekStart) : undefined;
  const today = week?.days.find(day => day.utc === utc);
  const ready = pendingTaskRewards(save);
  const previous = utc && weekStart ? ready.filter(reward => reward.kind === 'task' ? reward.utc < utc : reward.weekStart < weekStart) : [];
  const currentReady = clock === 'future' ? [] : ready.filter(reward => reward.kind === 'task' ? reward.utc === utc : reward.weekStart === weekStart);
  return {
    clock, today, week, previous, readyCount: previous.length + currentReady.length + Object.keys(journal?.inventory.weeklyChests ?? {}).length,
    todayCompleted: today?.tasks.filter(task => task.progress >= task.target).length ?? 0,
    todayTotal: today?.tasks.length ?? 0,
    nextDayAt: utc ? parseUtc(utc) + DAY : undefined,
    nextWeekAt: weekStart ? parseUtc(weekStart) + 7 * DAY : undefined,
    availableAt: clock === 'future' && journal ? parseUtc(journal.lastUtc) : undefined,
  };
}
