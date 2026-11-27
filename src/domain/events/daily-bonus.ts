import { RELEASE_UNLOCK, unlockedLevel } from '../progression';
import { hasFutureShuffleUse } from '../shuffle-progression';
import type { Save } from '../types';
import { grantEventPrize, type TaskPrize } from './daily-tasks';

type WeightedPrize = TaskPrize & { weight: number };
const DAY = 86_400_000;
const dayAt = (now: number) => Math.floor(now / DAY);
export const AZUR_BONUS_POOL: readonly WeightedPrize[] = [
  { kind: 'Coins', quantity: 100, weight: 10 }, { kind: 'Coins', quantity: 200, weight: 7 },
  { kind: 'Coins', quantity: 500, weight: 3 },
  ...(['MoveHint', 'Shuffle'] as const).flatMap(kind => [
    { kind, quantity: 2, weight: 7 }, { kind, quantity: 3, weight: 5 }, { kind, quantity: 5, weight: 2 },
  ]),
  ...(['Undo', 'Definition'] as const).flatMap(kind => [
    { kind, quantity: 2, weight: 10 }, { kind, quantity: 3, weight: 7 }, { kind, quantity: 5, weight: 3 },
  ]),
  { kind: 'Joker', quantity: 1, weight: 5 },
];
const offlinePool: readonly WeightedPrize[] = [
  { kind: 'Coins', quantity: 10, weight: 10 }, { kind: 'Coins', quantity: 20, weight: 7 },
  { kind: 'MoveHint', quantity: 1, weight: 7 }, { kind: 'Undo', quantity: 1, weight: 10 },
  { kind: 'Definition', quantity: 1, weight: 10 }, { kind: 'Joker', quantity: 1, weight: 5 },
  { kind: 'Shuffle', quantity: 1, weight: 7 },
];
export interface DailyBonus {
  version: 1;
  day: number;
  roundId: string;
  catalog: 'offline-r1' | 'azur-compiled-r1';
  columns: TaskPrize[];
  slots: number[];
  revealed: number[];
  won?: number;
  claimed?: true;
}

export interface DailyBonusState {
  phase: 'unavailable' | 'locked' | 'future' | 'available' | 'playing' | 'ready' | 'claimed' | 'expired';
  roundId?: string;
  prize?: TaskPrize;
  revealedCount: number;
  nextResetAt?: number;
  availableAt?: number;
  /** There is a useful action: start, resume, or collect a saved prize. */
  canOpen: boolean;
  canStartRound: boolean;
  canReveal: boolean;
  canClaim: boolean;
}

/** Read-only state shared by Home, contextual offers, the dialog, and commands.
 * A future saved date takes precedence over every won/claimed presentation.
 */
export function dailyBonusState(save: Save, now: number): DailyBonusState {
  const round = save.dailyBonus;
  const base = { roundId: round?.roundId, revealedCount: round?.revealed.length ?? 0,
    canOpen: false, canStartRound: false, canReveal: false, canClaim: false };
  if (!Number.isSafeInteger(now) || now < 0 || now > 8.64e15 - DAY) return { ...base, phase: 'unavailable' };
  const today = dayAt(now), nextResetAt = (today + 1) * DAY;
  const timed = { ...base, nextResetAt };
  if (round && round.day > today) return { ...timed, phase: 'future', availableAt: round.day * DAY };
  if (unlockedLevel(save) < RELEASE_UNLOCK.bonus) return { ...timed, phase: 'locked' };
  if (!round) return { ...timed, phase: 'available', canOpen: true, canStartRound: true };
  if (round.won !== undefined && !round.claimed) {
    return { ...timed, phase: 'ready', prize: { ...round.columns[round.won] }, canOpen: true, canClaim: true };
  }
  if (round.day < today) return { ...timed, phase: round.claimed ? 'available' : 'expired', canOpen: true, canStartRound: true };
  if (round.claimed) return { ...timed, phase: 'claimed' };
  return { ...timed, phase: 'playing', canOpen: true, canReveal: true };
}

const natural = (n: number) => Number.isSafeInteger(n) && n >= 0;
const conflictKey = (prize: TaskPrize) => prize.kind === 'Coins' ? `coin-${prize.quantity}` : prize.kind;
function winner(round: DailyBonus) {
  const counts = [0, 0, 0, 0];
  for (const slot of round.revealed) {
    const column = round.slots[slot];
    if (++counts[column] === 3) return column;
  }
}

export function validDailyBonus(round: DailyBonus) {
  if (!round || round.version !== 1 || !natural(round.day) || typeof round.roundId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(round.roundId) ||
      !['offline-r1', 'azur-compiled-r1'].includes(round.catalog) ||
      !Array.isArray(round.columns) || round.columns.length !== 4 || !Array.isArray(round.slots) ||
      round.slots.length !== 12 || !Array.isArray(round.revealed) ||
      !round.slots.every(i => natural(i) && i < 4) ||
      ![0, 1, 2, 3].every(i => round.slots.filter(column => column === i).length === 3) ||
      new Set(round.revealed).size !== round.revealed.length ||
      !round.revealed.every(i => natural(i) && i < round.slots.length)) return false;
  const pool = round.catalog === 'offline-r1' ? offlinePool : AZUR_BONUS_POOL;
  return round.columns.every(prize => prize && pool.some(row => row.kind === prize.kind && row.quantity === prize.quantity)) &&
    new Set(round.columns.map(conflictKey)).size === 4 && winner(round) === round.won &&
    (round.won === undefined || winner({ ...round, revealed: round.revealed.slice(0, -1) }) === undefined) &&
    (round.claimed === undefined || (round.claimed === true && round.won !== undefined));
}

export function weightedBonusPrize(pool: readonly WeightedPrize[], random: (size: number) => number) {
  if (!pool.length) return;
  const total = pool.reduce((sum, prize) => sum + Math.max(0, prize.weight), 0);
  if (!total) return pool.at(-1);
  let pick = random(total);
  if (!natural(pick) || pick >= total) return;
  for (const prize of pool) {
    pick -= Math.max(0, prize.weight);
    if (pick < 0) return prize;
  }
}

export function openDailyBonusRound(save: Save, now: number, roundId: string, random: (size: number) => number,
  catalog: DailyBonus['catalog'] = 'offline-r1') {
  const state = dailyBonusState(save, now), day = dayAt(now), previous = save.dailyBonus;
  if (state.phase === 'unavailable' || state.phase === 'locked' || state.phase === 'future') return;
  if (previous && !state.canStartRound) return previous;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(roundId)) return;
  const pool = (catalog === 'offline-r1' ? offlinePool : AZUR_BONUS_POOL)
    .filter(prize => prize.kind !== 'Shuffle' || hasFutureShuffleUse(save));
  const columns: TaskPrize[] = [];
  for (let i = 0; i < 4; i++) {
    const eligible = pool.filter(row => !columns.some(prize => conflictKey(prize) === conflictKey(row)));
    const selected = weightedBonusPrize(eligible, random);
    if (!selected) return;
    columns.push({ kind: selected.kind, quantity: selected.quantity });
  }
  const slots = Array.from({ length: 12 }, (_, i) => i % 4);
  for (let i = slots.length - 1; i > 0; i--) {
    const index = random(i + 1);
    if (!natural(index) || index > i) return;
    [slots[i], slots[index]] = [slots[index], slots[i]];
  }
  return save.dailyBonus = { version: 1, day, roundId, catalog, columns, slots, revealed: [] };
}

export function revealDailyBonusCard(save: Save, roundId: string, index: number, now: number) {
  const round = save.dailyBonus;
  if (!round || roundId !== round.roundId || !dailyBonusState(save, now).canReveal ||
      round.revealed.includes(index) || !natural(index) || index >= round.slots.length) return false;
  round.revealed.push(index);
  const won = winner(round);
  if (won !== undefined) round.won = won;
  return true;
}

export function claimDailyBonus(save: Save, roundId: string, now: number) {
  const round = save.dailyBonus;
  if (!round || roundId !== round.roundId || round.claimed || round.won === undefined ||
      !dailyBonusState(save, now).canClaim || !validDailyBonus(round)) return;
  const prize = round.columns[round.won];
  if (!grantEventPrize(save, prize)) return;
  round.claimed = true;
  return prize;
}
