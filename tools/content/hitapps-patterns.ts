import { Kind, type SourceCard } from '../../src/domain/hitapps-rules';
import type { SourceSlot } from './hitapps-puzzle-distribution';

export interface Coordinate { column: number; position: number }
export interface LockerPattern { type: number; required: number; lock: Coordinate; keys: readonly (Coordinate & { amount: number })[] }
export interface IcePattern extends Coordinate { layers: number }
export interface BoundPattern { pairs: readonly Coordinate[]; scissors: readonly Coordinate[] }

type PatternResult = 'APPLIED' | 'FAILED_COORDINATE' | 'FAILED_VALUES' | 'FAILED_DUPLICATE' | 'UNKNOWN_COLLISION' | 'FAILED_EMPTY';
const applied = 'APPLIED';
const numberIn = (n: number, max: number) => Number.isSafeInteger(n) && n > 0 && n <= max;
const located = (slots: readonly SourceSlot[], coordinate: Coordinate) => slots.find(slot => slot.container === 2 &&
  slot.column === coordinate.column && slot.position === coordinate.position);
export const patternLookupAccepted = (found: boolean, existingIndex: number) => found && existingIndex < 0;

export function applyLockerPattern(slots: SourceSlot[], cards: Record<string, SourceCard>, pattern: readonly LockerPattern[]): PatternResult {
  if (!pattern.length) return 'FAILED_EMPTY';
  const writes = pattern.map(entry => ({ entry, lock: located(slots, entry.lock), keys: entry.keys.map(key => located(slots, key)) }));
  if (writes.some(row => !row.lock || row.keys.some(key => !key))) return 'FAILED_COORDINATE';
  const ids = writes.flatMap(row => [row.lock!.id, ...row.keys.map(key => key!.id)]);
  if (new Set(ids).size !== ids.length) return 'UNKNOWN_COLLISION';
  if (pattern.some(row => !numberIn(row.type, 65535) || !numberIn(row.required, 65535) || !row.keys.length ||
    row.keys.some(key => !numberIn(key.amount, 65535)) || row.keys.reduce((sum, k) => sum + k.amount, 0) > 65535)) return 'FAILED_VALUES';
  for (const { entry, lock, keys } of writes) {
    cards[lock!.id].lock = { type: entry.type, required: entry.required, collected: 0 };
    lock!.flags &= ~64;
    keys.forEach((key, index) => { cards[key!.id].key = { type: entry.type, amount: entry.keys[index].amount, used: false }; });
  }
  return applied;
}

export function applyIcePattern(slots: SourceSlot[], cards: Record<string, SourceCard>, pattern: readonly IcePattern[]): PatternResult {
  if (!pattern.length) return 'FAILED_EMPTY';
  const targets = pattern.map(entry => located(slots, entry));
  if (targets.some(slot => !slot)) return 'FAILED_COORDINATE';
  if (targets.some((slot, index) => !patternLookupAccepted(Boolean(slot), targets.slice(0, index).indexOf(slot)))) return 'FAILED_DUPLICATE';
  if (pattern.some(entry => !numberIn(entry.layers, 99))) return 'FAILED_VALUES';
  targets.forEach((slot, index) => {
    cards[slot!.id].ice = pattern[index].layers;
    slot!.flags &= ~64;
  });
  return applied;
}

export function trimNearest(coordinates: readonly Coordinate[], kept: boolean[], origin: Coordinate) {
  const geometry = (point: Coordinate) => (point.column - origin.column) ** 2 + (point.position - origin.position) ** 2;
  let best: number | undefined;
  coordinates.forEach((slot, index) => {
    if (!kept[index]) return;
    const prior = best === undefined ? undefined : coordinates[best];
    const earlier = prior && (slot.column < prior.column || slot.column === prior.column && slot.position < prior.position);
    if (!prior || geometry(slot) < geometry(prior) || geometry(slot) === geometry(prior) && earlier) best = index;
  });
  if (best !== undefined) kept[best] = false;
  return best;
}

export function balancePattern(upper: readonly Coordinate[], scissors: readonly Coordinate[], pairMask: boolean[], scissorsMask: boolean[]) {
  let difference = pairMask.filter(Boolean).length - scissorsMask.filter(Boolean).length;
  if (difference > 0) scissors.forEach((slot, index) => {
    if (difference > 0 && !scissorsMask[index] && trimNearest(upper, pairMask, slot) !== undefined) difference--;
  });
  else upper.forEach((slot, index) => {
    if (difference < 0 && !pairMask[index] && trimNearest(scissors, scissorsMask, slot) !== undefined) difference++;
  });
  return pairMask.some(Boolean);
}

function hasFeature(card: SourceCard) {
  return Boolean(card.lock || card.ice || card.puzzle || card.order || card.gold?.health);
}

export function applyBoundPattern(slots: SourceSlot[], cards: Record<string, SourceCard>, pattern: BoundPattern,
  categoryOf: (id: string) => string): PatternResult {
  if (!pattern.pairs.length || pattern.pairs.length !== pattern.scissors.length) return 'FAILED_EMPTY';
  const upper = pattern.pairs.map(pair => located(slots, pair));
  const lower = pattern.pairs.map(({ column, position }) => located(slots, { column, position: position - 1 }));
  const scissors = pattern.scissors.map(pair => located(slots, pair));
  const all = [...upper, ...lower, ...scissors];
  if (all.some(slot => !slot)) return 'FAILED_COORDINATE';
  if (new Set(upper).size !== upper.length || new Set(scissors).size !== scissors.length) return 'FAILED_DUPLICATE';
  if (new Set(all).size !== all.length) return 'UNKNOWN_COLLISION';
  const pairMask = upper.map((slot, index) => {
    const above = cards[slot!.id], below = cards[lower[index]!.id];
    return above.kind === Kind.word && below.kind === Kind.word && categoryOf(slot!.id) !== categoryOf(lower[index]!.id) &&
      !hasFeature(above) && !hasFeature(below);
  });
  const scissorsMask = scissors.map(slot => !cards[slot!.id].key?.type);
  if (!balancePattern(pattern.pairs, pattern.scissors, pairMask, scissorsMask)) return 'FAILED_VALUES';
  upper.forEach((slot, index) => { if (pairMask[index]) cards[slot!.id].bound = 2; });
  scissors.forEach((slot, index) => { if (scissorsMask[index]) cards[slot!.id].scissors = true; });
  return applied;
}

const f = Math.fround;
export function weightPenalty(strength: number, position: number, exponent: number) {
  const shape = Math.max(0, Math.min(1, f(f(position) ** f(exponent))));
  const floor = f(1 - f(strength));
  return f(floor + f(f(1 - floor) * shape));
}

export interface GoldSlot { id: string; golden: boolean; invalid: boolean; distance: number; weight: number }
export function goldWeights(columns: GoldSlot[][]) {
  const occupied = columns.map(column => column.filter(slot => slot.golden).length);
  const scores = occupied.filter((count, index) => count < columns[index].length);
  const lower = scores.length ? Math.min(...scores) : 0, upper = scores.length ? Math.max(...scores) : 0;
  return columns.map((column, index) => {
    const count = occupied[index];
    const weight = count >= column.length ? 0 : weightPenalty(.96, lower === upper ? 1 : f(1 - f((count - lower) / (upper - lower))), 2);
    for (const slot of column) slot.weight = slot.golden || slot.invalid ? 0 : f(weight * weightPenalty(.999, f(slot.distance / 4), 1));
    return weight;
  });
}

export function chooseGold(slots: readonly GoldSlot[], draw: () => number) {
  const sum = slots.reduce((total, slot) => f(total + slot.weight), 0);
  if (sum > 0) {
    const value = draw();
    if (!(value >= 0 && value <= 1)) throw Error('Invalid gold stream draw');
    const target = f(sum * f(value));
    let current = 0;
    for (const slot of slots) {
      current = f(current + slot.weight);
      if (target <= current && !slot.golden && !slot.invalid) return slot;
    }
  }
  return slots.find(slot => !slot.golden && !slot.invalid);
}

export function markGold(column: GoldSlot[], at: number) {
  column[at].golden = true;
  column.forEach((slot, index) => { if (index !== at) slot.distance = Math.min(slot.distance, Math.abs(index - at) - 1); });
}

export function applyGoldPattern(slots: SourceSlot[], cards: Record<string, SourceCard>, amount: number, draw: () => number) {
  const columns: GoldSlot[][] = [];
  for (const slot of slots.filter(slot => slot.container === 2).sort((a, b) => a.column - b.column || a.position - b.position)) {
    const card = cards[slot.id], next = located(slots, { column: slot.column, position: slot.position + 1 });
    (columns[slot.column] ??= []).push({ id: slot.id, golden: Boolean(card.gold?.health),
      invalid: Boolean(card.puzzle || card.order || card.bound || next && cards[next.id].bound), distance: 4, weight: 0 });
  }
  const existing = columns.filter(Boolean);
  for (const column of existing) column.forEach((slot, index) => { if (slot.golden) markGold(column, index); });
  const flat = existing.flat(), selected = [];
  for (let count = 0; count < amount; count++) {
    goldWeights(existing);
    const slot = chooseGold(flat, draw);
    if (!slot) break;
    const column = existing.find(column => column.includes(slot))!;
    markGold(column, column.indexOf(slot));
    cards[slot.id].gold = { health: 4, appeared: 0, activated: false };
    selected.push(slot.id);
  }
  return selected;
}

export function starterSlot(count: number, level: number, kind: 5 | 6, seed: number) {
  return count < 1 ? 0 : ((Math.imul(Math.imul(level, 397) ^ kind, 397) ^ seed) >>> 0) % (count + 1);
}

export function insertStarter(slots: SourceSlot[], id: string, level: number, kind: 5 | 6, seed: number) {
  const stock = slots.filter(slot => slot.container === 0 && slot.column === 0 && slot.flags !== 0);
  const count = Math.max(0, ...stock.map(slot => slot.position + 1));
  const position = starterSlot(count, level, kind, seed);
  for (const slot of stock) if (slot.position >= position) slot.position++;
  slots.push({ id, kind, container: 0, column: 0, position, flags: 2 });
  return position;
}
