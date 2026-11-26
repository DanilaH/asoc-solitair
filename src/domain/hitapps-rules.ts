/** Own representations of native numeric contracts. Evidence is pinned in the G0–G6 brief. */
export const Kind = { category: 0, word: 1, joker: 2, puzzleTop: 3, puzzleBottom: 4, magnet: 5, hammer: 6 } as const;
export type SourceKind = (typeof Kind)[keyof typeof Kind];
export const Change = { revealed: 1, placed: 2, unlocked: 4 } as const;

export interface SourceCard {
  kind: SourceKind;
  order: number;
  puzzle: number;
  bound: 0 | 1 | 2;
  scissors: boolean;
  ice: number;
  lock?: { type: number; required: number; collected: number };
  key?: { type: number; amount: number; used: boolean };
  gold?: { health: number; appeared: number; activated: boolean };
  changedAt: number;
  changed: number;
}

export function sourceCard(kind: SourceKind, order = 0, puzzle = 0): SourceCard {
  return { kind, order, puzzle, bound: 0, scissors: false, ice: 0, changedAt: 0, changed: 0 };
}

export const activeLocker = (card: SourceCard) => Boolean(card.lock && card.lock.collected < card.lock.required);
export const isStarter = (kind: number) => kind === Kind.magnet || kind === Kind.hammer;

type BoundNode = { available: boolean; kind: number; category: string | number; bound: number };

export function boundAnchorStatus(container: number, flags: number, kind: number, found: boolean, state: number): 0 | 1 | 3 {
  return container === 2 && !!(flags & 64) && kind <= Kind.word && found ? (state === 1 ? 1 : 3) : 0;
}

/** Source position is bottom-to-top. A lower-scan neighbour is tested for binding before its category. */
export function boundStatus(cards: readonly BoundNode[], position: number): { anchor?: number; status: 0 | 1 | 2 | 3 | 4 } {
  const root = cards[position];
  if (!root?.available || root.kind > Kind.word) return { status: 0 };
  for (let index = position; index >= 0; index--) {
    const card = cards[index];
    if (!card.available || card.kind > Kind.word || card.category !== root.category) break;
    if (card.bound) return { anchor: index, status: boundAnchorStatus(2, 64, root.kind, true, card.bound) };
  }
  for (let index = position + 1; index < cards.length; index++) {
    const card = cards[index];
    if (!card.available || card.kind > Kind.word) break;
    if (card.bound) return { status: card.bound === 1 ? 2 : 4 };
    if (card.category !== root.category) break;
  }
  return { status: 0 };
}

export function groupExtends(sameCategory: boolean, upperBound: number, available: boolean, joker: boolean) {
  return available && !joker && upperBound !== 1 && (sameCategory || upperBound === 2);
}

export function placerVerdict(container: 'play' | 'home', source: Pick<SourceCard, 'kind' | 'puzzle'>, target: {
  occupied: boolean; locked: boolean; frozen: boolean; bound: number; hammer: boolean; magnet: boolean;
}): 0 | 1 | 2 {
  const decision = (allowed: boolean) => allowed ? 1 : 2;
  if (container === 'home') {
    if (target.bound >= 2 || source.kind === Kind.hammer) return 2;
    if (source.kind === Kind.magnet) return decision(target.magnet);
    return source.kind === Kind.joker || source.puzzle !== 0 ? 2 : 0;
  }
  if (source.kind === Kind.hammer) return decision(target.hammer);
  if (source.kind === Kind.magnet) return decision(target.magnet);
  if (!target.occupied) return 1;
  return source.kind === Kind.joker ? decision(!target.locked && !target.frozen) : 0;
}

export function playAllows(input: { verdict: 0 | 1 | 2; category: boolean; available: boolean; joker: boolean;
  sameCategory: boolean; samePuzzle: boolean; sourceOrder: number; targetOrder: number }) {
  if (input.verdict) return input.verdict === 1;
  return input.joker || input.available && !input.category && input.sameCategory && input.samePuzzle &&
    (input.sourceOrder === 0 || input.targetOrder === input.sourceOrder + 1);
}

export function homeAllows(input: { verdict: 0 | 1 | 2; occupied: boolean; validCategory: boolean;
  categorySource: boolean; categoryLast: boolean; sourceOrder: number; targetOrder: number }) {
  if (input.verdict) return input.verdict === 1;
  return input.occupied ? input.validCategory && (input.sourceOrder === 0 || input.sourceOrder === input.targetOrder + 1)
    : input.categorySource || input.categoryLast;
}

export function hammerAllowed(container: number, blocked: boolean, count: number, kind: number, hidden: boolean) {
  return container === 2 && !blocked && count > 0 && kind !== Kind.joker && !isStarter(kind) && !hidden;
}

export function magnetAllowed(container: number, blocked: boolean, count: number, kind: number, hidden: boolean,
  frozen: boolean, locked: boolean, binding: number, match: boolean, matchingKey: boolean) {
  if (blocked || count <= 0) return false;
  if (container === 3) return match;
  if (container !== 2 || hidden || kind === Kind.joker) return false;
  if (locked) return matchingKey;
  if (kind === Kind.category && !frozen) return false;
  return binding === 3 || frozen || match;
}

export function magnetMatches(common: boolean, basePuzzle: number, puzzle: number, order: number, requiredOrder: number, leader: boolean) {
  if (!common) return false;
  if (requiredOrder === 0) return leader;
  return requiredOrder > 0 ? order === requiredOrder : basePuzzle === 0 || puzzle === basePuzzle;
}

export function canMelt(layers: number, hidden: boolean, locked: boolean, changedThisMove: boolean, revealed: boolean, unlocked: boolean) {
  return layers > 0 && !hidden && !locked && !(changedThisMove && revealed) && !unlocked;
}

export function melt(card: SourceCard) {
  card.ice--;
  return card.ice === 0 ? 2 : 1;
}

export function positiveFreezeMove(input: { joker: boolean; starter: boolean; spendsMove: boolean; discriminator: number;
  position: number; previousJoker: boolean; placeOnJokerPositive: boolean; fallback: boolean }) {
  if (input.joker) return false;
  if (input.starter) return input.spendsMove;
  if (input.discriminator === 2) return input.position === 0 || !input.previousJoker || input.placeOnJokerPositive;
  return input.discriminator === 3 || input.fallback;
}

export function collectTypedKey(lock: NonNullable<SourceCard['lock']>, key: NonNullable<SourceCard['key']>) {
  if (key.used || lock.type !== key.type || lock.collected >= lock.required) return false;
  if (!Number.isInteger(key.amount) || key.amount < 1 || lock.collected + key.amount > 65535) throw Error('Invalid key counter');
  const [collected, , , opened] = keyWrite(lock.required, lock.collected, key.amount, 0, 0);
  lock.collected = collected;
  key.used = true;
  return Boolean(opened);
}

export function keyWrite(required: number, collected: number, amount: number, keyFlags: number, lockFlags: number) {
  const count = (collected + amount) & 65535;
  const opened = count >= required;
  return [count, keyFlags | 8, opened ? lockFlags | 8 : lockFlags, Number(opened)];
}

export function scissorsWrite(action: 'cut' | 'unbind' | 'discard', carrier: SourceCard, target: SourceCard) {
  if (action === 'unbind') target.bound = 0;
  else {
    carrier.scissors = false;
    if (action === 'cut') target.bound = 1;
  }
}

export function marks(card: SourceCard, move: number, value: number) {
  card.changed = card.changedAt === move ? card.changed | value : value;
  card.changedAt = move;
}

export function transferPuzzleMark(replacement: SourceCard, halves: readonly SourceCard[], move: number) {
  if (halves.some(card => card.changedAt === move && Boolean(card.changed & Change.placed))) marks(replacement, move, Change.placed);
}

export function decayAllowed(health: number, available: boolean, appeared: number, changedAt: number, revealed: boolean,
  unlocked: boolean, move: number) {
  return health > 0 && available && appeared !== move && !(changedAt === move && revealed) && !unlocked;
}

export function goldDecayMilestone(health: number) {
  return health === 1 ? 2 : health === 0 ? 3 : 0;
}

export function activateGold(gold: NonNullable<SourceCard['gold']>) {
  if (gold.health === 0) return false;
  gold.health = 0;
  gold.activated = true;
  return true;
}

export function goldCounts(total: number, generated: number, eligible: number, first: number) {
  const remaining = total - generated;
  return { remaining, runningOut: eligible <= remaining, firstComplete: generated >= first };
}
