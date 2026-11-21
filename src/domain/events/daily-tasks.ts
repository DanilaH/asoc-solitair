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

export interface TaskTarget { id: string; kind: Exclude<Task, 'Unknown'>; target: number; prize: { kind: Reward; quantity: number } }
export interface TaskSignal { id: string; kind: Exclude<Task, 'Unknown'>; channel: Channel; amount: number; attemptId?: string }
interface DayTask extends TaskTarget { progress: number; claimed?: true }
interface WeekMilestone { id: string; medals: number; prize: TaskTarget['prize'] }
interface Week {
  startUtc: string;
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
  hintedAttempts: string[];
  loginDaysUtc: string[];
  inventory: { definitions: number; shuffles: number; chestKeys: string[]; cardBack: boolean };
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

function validTask(prize: TaskTarget): boolean {
  return Boolean(prize && token(prize.id) && Object.hasOwn(channel, prize.kind) && natural(prize.target) && prize.target > 0 &&
    prize.prize && Object.hasOwn(RewardKind, prize.prize.kind) && natural(prize.prize.quantity) &&
    prize.prize.quantity > 0 && prize.prize.quantity <= 100);
}

const uniqueTokens = (items: unknown): items is string[] => Array.isArray(items) &&
  items.every(token) && new Set(items).size === items.length;

const validMilestone = (milestone: WeekMilestone) => Boolean(milestone &&
  validTask({ id: milestone.id, kind: 'DailyLogin', target: milestone.medals, prize: milestone.prize }));
export function validDailyTasks(state: DailyTaskJournal): boolean {
  return Boolean(state && state.version === 1 && realDate(state.lastUtc) && uniqueTokens(state.seenSignals) &&
    uniqueTokens(state.hintedAttempts) && uniqueTokens(state.loginDaysUtc) && state.loginDaysUtc.every(realDate) &&
    state.inventory && natural(state.inventory.definitions) && natural(state.inventory.shuffles) &&
    typeof state.inventory.cardBack === 'boolean' && uniqueTokens(state.inventory.chestKeys) &&
    Array.isArray(state.weeks) && new Set(state.weeks.map(week => week.startUtc)).size === state.weeks.length &&
    state.weeks.every(week => week && realDate(week.startUtc) && week.startUtc === weekOf(week.startUtc) &&
      natural(week.totalMedals) && uniqueTokens(week.claimedMilestones) && Array.isArray(week.milestones) &&
      week.milestones.every(validMilestone) && new Set(week.milestones.map(item => item.id)).size === week.milestones.length &&
      week.claimedMilestones.every(id => week.milestones.some(item => item.id === id && item.medals <= week.totalMedals)) && Array.isArray(week.days) &&
      new Set(week.days.map(day => day.utc)).size === week.days.length &&
      week.days.every(day => day && realDate(day.utc) && weekOf(day.utc) === week.startUtc && day.utc <= state.lastUtc &&
        Array.isArray(day.tasks) && new Set(day.tasks.map(task => task.id)).size === day.tasks.length &&
        day.tasks.every(task => validTask(task) && natural(task.progress) && task.progress <= task.target &&
          (task.claimed === undefined || task.claimed === true && task.progress === task.target)))));
}

export function scheduleTasks(save: Save, now: number, definitions: readonly TaskTarget[], milestones: readonly WeekMilestone[] = []): boolean {
  const utc = utcKey(now);
  if (!utc || !definitions.length || !milestones.every(validMilestone) ||
    new Set(milestones.map(item => item.id)).size !== milestones.length || definitions.some(definition => !validTask(definition)) ||
    new Set(definitions.map(definition => definition.id)).size !== definitions.length || utc < (save.dailyTasks?.lastUtc ?? '')) return false;
  const state = save.dailyTasks ??= { version: 1, lastUtc: utc, weeks: [], seenSignals: [], hintedAttempts: [], loginDaysUtc: [],
    inventory: { definitions: 0, shuffles: 0, chestKeys: [], cardBack: false } };
  const weekStart = weekOf(utc);
  let week = state.weeks.find(entry => entry.startUtc === weekStart);
  if (!week) {
    week = { startUtc: weekStart, totalMedals: 0, claimedMilestones: [], milestones: [...structuredClone(milestones)], days: [] };
    state.weeks.push(week);
  }
  if (week.days.some(day => day.utc === utc)) return false;
  state.lastUtc = utc;
  week.days.push({ utc, tasks: definitions.map(definition => ({ ...structuredClone(definition), progress: 0 })) });
  return true;
}

export function recordTaskSignal(save: Save, now: number, signal: TaskSignal): boolean {
  const utc = utcKey(now), state = save.dailyTasks, day = state?.weeks.flatMap(week => week.days).find(day => day.utc === utc);
  if (!state || !day || utc !== state.lastUtc || !token(signal.id) || !Object.hasOwn(channel, signal.kind) ||
    channel[signal.kind] !== signal.channel || !natural(signal.amount) || !signal.amount ||
    (signal.attemptId !== undefined && !token(signal.attemptId))) return false;
  const key = signal.kind === 'DailyLogin' ? `login:${utc}` : signal.id;
  if (state.seenSignals.includes(key)) return false;
  if (signal.kind === 'WinNoHints' && (!signal.attemptId || state.hintedAttempts.includes(signal.attemptId))) return false;
  if (signal.kind === 'UseHints' && signal.attemptId && !state.hintedAttempts.includes(signal.attemptId)) state.hintedAttempts.push(signal.attemptId);
  if (signal.kind === 'DailyLogin') state.loginDaysUtc.push(utc);
  state.seenSignals.push(key);
  for (const task of day.tasks) {
    if (task.kind === signal.kind && !task.claimed) task.progress += Math.min(signal.amount, task.target - task.progress);
  }
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
    if (before.attempt.verifiedTaskHints === 0) report('WinNoHints', 1, `no-hints:${win.id}`);
  }
  if (cmd.type === 'draw' || cmd.type === 'transfer' || cmd.type === 'recycle') report('ExecuteMoves', 1);
  report('CollectThemes', events.filter(event => event.type === 'complete').length);
  report('DrawCards', events.filter(event => event.type === 'draw').length);
  report('UseHints', events.filter(event => event.type === 'hint').length);
  report('UseJokers', events.filter(event => event.type === 'joker').length);
  report('UseRollbacks', events.filter(event => event.type === 'undo').length);
  report('EarnCoins', next.profile.coins - before.profile.coins);
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

export function claimTask(save: Save, utc: string, id: string): boolean {
  if (!realDate(utc)) return false;
  const week = save.dailyTasks?.weeks.find(week => week.startUtc === weekOf(utc));
  const task = week?.days.find(day => day.utc === utc)?.tasks.find(task => task.id === id);
  if (!week || !task || task.claimed || task.progress < task.target || !grant(save, week, task.prize, `task:${utc}:${id}`)) return false;
  task.claimed = true;
  return true;
}

export function claimTaskMilestone(save: Save, weekStart: string, id: string): boolean {
  const week = save.dailyTasks?.weeks.find(week => week.startUtc === weekStart);
  const config = week?.milestones.find(item => item.id === id);
  const key = `weekly:${weekStart}:${id}`;
  if (!week || !config || week.totalMedals < config.medals || week.claimedMilestones.includes(id) ||
    !grant(save, week, config.prize, key)) return false;
  week.claimedMilestones.push(id);
  return true;
}

export function useTaskCharge(save: Save, item: 'definitions'|'shuffles'): boolean {
  const inventory = save.dailyTasks?.inventory;
  if (!inventory?.[item]) return false;
  inventory[item]--;
  return true;
}

export function openTaskChest(save: Save, chestKey: string): 'hints'|'undos'|'jokers' | undefined {
  const inventory = save.dailyTasks?.inventory;
  const index = inventory?.chestKeys.indexOf(chestKey) ?? -1;
  if (!inventory || index < 0) return;
  const scope = ['hints', 'undos', 'jokers'] as const;
  const seed = [...chestKey].reduce((value, name) => (Math.imul(value, 31) + name.charCodeAt(0)) >>> 0, 1);
  const reward = scope[seed % scope.length];
  if (!natural(save.profile[reward] + 1)) return;
  save.profile[reward]++;
  inventory.chestKeys.splice(index, 1);
  return reward;
}

export const TASKS_PREVIEW = import.meta.env?.VITE_CONTENT8_DAILY_TASKS === '1';
const earnedRows: readonly TaskTarget[] = [
  { id: 'visit', kind: 'DailyLogin', target: 1, prize: { kind: 'Medals', quantity: 1 } },
  { id: 'draw', kind: 'DrawCards', target: 1, prize: { kind: 'Coins', quantity: 10 } },
  { id: 'moves', kind: 'ExecuteMoves', target: 4, prize: { kind: 'MoveHint', quantity: 1 } },
  { id: 'topic', kind: 'CollectThemes', target: 1, prize: { kind: 'Medals', quantity: 2 } },
  { id: 'win', kind: 'CompleteLevels', target: 1, prize: { kind: 'Undo', quantity: 1 } },
];

export function updatePreviewTasks(save: Save, now: number): void {
  const utc = utcKey(now);
  if (!utc) return;
  const last = new Date(now).getUTCDay() % 2 ? earnedRows[3] : earnedRows[4];
  scheduleTasks(save, now, [...earnedRows.slice(0, 3), last],
    [{ id: 'week', medals: 5, prize: { kind: 'Coins', quantity: 20 } }]);
}

export function currentTasks(save: Save) {
  const journal = save.dailyTasks;
  if (!journal) return;
  const week = journal.weeks.find(week => week.startUtc === weekOf(journal.lastUtc));
  const day = week?.days.find(day => day.utc === journal.lastUtc);
  if (week && day) return { week, day };
}
