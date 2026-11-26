import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boundAnchorStatus, boundStatus, canMelt, decayAllowed, keyWrite, hammerAllowed, magnetAllowed,
  magnetMatches, melt, scissorsWrite, sourceCard, Kind, transferPuzzleMark, activateGold, goldDecayMilestone,
  goldCounts, playAllows, homeAllows, placerVerdict, type SourceKind } from '../../src/domain/hitapps-rules';
import { balancePattern, goldWeights, chooseGold, markGold, patternLookupAccepted, trimNearest, type GoldSlot } from '../content/hitapps-patterns';
import { puzzleExchangeCount, shuffleOnce } from '../content/hitapps-puzzle-distribution';
import { EmbeddedRandom, sourceWithinTolerance } from '../content/plain-dealer';
import { adjustedMoveBudget, easyDealTarget } from '../../src/domain/difficulty';

const directory = process.env.HITAPPS_EVIDENCE_DIR;
if (!directory) throw Error('Set HITAPPS_EVIDENCE_DIR to research/games/association-solitaire from kit 81da64b3');
function pinned(path: string, expected: string) {
  const bytes = readFileSync(join(directory!, path));
  const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(actual, expected, path);
  return JSON.parse(bytes.toString());
}
const stats: Record<string, number> = {};
function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, `${name} row ${(stats[name] ?? 0) + 1}`);
  stats[name] = (stats[name] ?? 0) + 1;
}

const placement = pinned('2026-11-26-hitapps-placement-predicates/native_truth.json', 'cae1e4f34d025426cb96d9ad84dc87b087db10c1') as {
  truth: { type: 'play' | 'home'; verdict: 0 | 1 | 2; sourceOrder: number; targetOrder: number; mask: string }[];
};
for (const { type, verdict, sourceOrder, targetOrder, mask } of placement.truth) {
  for (let flags = 0; flags < (type === 'play' ? 32 : 16); flags++) {
    const bit = (i: number) => Boolean(flags & (1 << i));
    const answer = type === 'play' ? playAllows({ verdict, sourceOrder, targetOrder,
      category: bit(0), available: bit(1), joker: bit(2), sameCategory: bit(3), samePuzzle: bit(4) })
      : homeAllows({ verdict, sourceOrder, targetOrder, occupied: bit(0), validCategory: bit(1), categorySource: bit(2), categoryLast: bit(3) });
    check('nativePlacement', answer, Boolean(Number(mask) & (1 << flags)));
  }
}

const overrides = pinned('2026-11-26-hitapps-placement-overrides/native-overrides.json', '421fffefc6a48a31baeb77914d0fbce4e3493299') as {
  rows: ['play' | 'home', SourceKind, number, number, number, number, number, number, number, number, string[]][];
  getters: Record<string, [number, number, number][]>;
};
for (const [mode, kind, puzzle, occupied, locked, frozen, hammer, magnet, bound, verdict] of overrides.rows)
  check('nativeOverride', placerVerdict(mode, { kind, puzzle }, { occupied: !!occupied, locked: !!locked, frozen: !!frozen,
    hammer: !!hammer, magnet: !!magnet, bound }), verdict);
for (const [address, rows] of Object.entries(overrides.getters)) for (const [kind, tag, expected] of rows) {
  const tested = { '0x1d3cf38': kind === Kind.hammer, '0x1d3cf24': kind === Kind.magnet,
    '0x1d31bb0': kind === Kind.joker, '0x1d34a14': tag !== 0 }[address];
  check('nativeOverride', Number(tested), expected);
}

const fixtures = pinned('2026-11-26-hitapps-recursive-specials/native-fixtures.json', '88d2e3e270f13fb75438e6ed47a9473912ee285a').fixtures as
  Record<string, (number[] | [number[][], ...number[]] | [string, ...number[]])[]>;
for (const [name, rows] of Object.entries(fixtures)) for (const row of rows) {
  if (name === 'BOUND29') {
    const [cards, at, found, id, status] = row as [number[][], ...number[]];
    const got = boundStatus(cards.map(([available, kind, category, bound]) => ({ available: !!available, kind, category, bound })), at);
    check(name, [Number(got.anchor !== undefined), got.anchor === undefined ? 0 : got.anchor + 10, got.status], [found, id, status]);
    continue;
  }
  const data = row as number[];
  const [a, b, c, d, e, f, g, h, i, j, k] = data;
  switch (name) {
    case 'HAMMER27': check(name, +hammerAllowed(a, !!b, c, d, !!e), f); break;
    case 'BOUND27': check(name, boundAnchorStatus(a, b, c, !!d, e), f); break;
    case 'ICE27': check(name, +canMelt(a, !!b, !!c, !!d, !!e, !!f), g); break;
    case 'KEY27': check(name, keyWrite(a, b, c, d, d), data.slice(4)); break;
    case 'PAT27': case 'PAT29': check(name, +patternLookupAccepted(name === 'PAT29' || !!a, b), c); break;
    case 'GOLD27': check(name, +decayAllowed(a, !!b, c, d, !!e, !!f, 9), g); break;
    case 'MAGNET28': check(name, +magnetAllowed(a, !!b, c, d, !!e, !!f, !!g, h, !!i, !!j), k); break;
    case 'MAGTARGET29': check(name, [Number(c !== 0), +magnetMatches(!!a, c, d, e, f, e === 0)], data.slice(6)); break;
    case 'CUT29': {
      const card = { ...sourceCard(Kind.word), bound: a as 0 | 1 | 2 }, carrier = { ...sourceCard(Kind.word), scissors: !!b };
      scissorsWrite('cut', carrier, card);
      const written = [Number(carrier.scissors), card.bound];
      scissorsWrite('unbind', carrier, card);
      carrier.scissors = !!b;
      scissorsWrite('discard', carrier, card);
      check(name, [...written, card.bound, Number(carrier.scissors)], data.slice(2));
      break;
    }
    case 'MELT29': {
      const card = { ...sourceCard(Kind.word), ice: a };
      const event = melt(card);
      check(name, [card.ice, event], data.slice(1));
      break;
    }
    case 'PUZZLE29': {
      const result = { ...sourceCard(Kind.word, b), changedAt: g, changed: h };
      transferPuzzleMark(result, [{ ...sourceCard(Kind.puzzleTop), changedAt: c, changed: d },
        { ...sourceCard(Kind.puzzleBottom), changedAt: e, changed: f }], 9);
      check(name, [a, result.puzzle, result.order, result.kind, result.changedAt, result.changed], data.slice(8));
      break;
    }
    case 'GOLDACT29': {
      const gold = { health: a, appeared: 0, activated: !!b };
      const active = activateGold(gold);
      check(name, [Number(active), gold.health, Number(gold.activated), goldDecayMilestone(a)], data.slice(2));
      break;
    }
    case 'GOLDCOUNT29': {
      const count = goldCounts(a, b, c, a);
      check(name, [count.remaining >>> 0, Number(count.runningOut), Number(count.firstComplete)], data.slice(3));
      break;
    }
    default: throw Error(name);
  }
}

const rng = pinned('2026-11-17-hitapps-rng-stacks/evidence.json', 'c1d1436a0f9797bed5415e4dfbee09540be424c1');
for (const [seed, prefix] of Object.entries(rng.model_only_random_prefix5 as Record<string, number[]>)) {
  const random = new EmbeddedRandom(Number(seed));
  check('rngModelPrefix', prefix.map(() => random.next()), prefix);
}
const puzzle = pinned('2026-11-26-hitapps-special-patterns/puzzle_native.json', 'a27d653b711879bff147640686f02cce115a4027');
for (const [stock, existing, wanted] of puzzle.counts.rows as number[][])
  check('nativePuzzle', puzzleExchangeCount(stock, existing, 100), wanted);
for (const [size, variant, calls, expected] of puzzle.shuffle as [number, number, number[], number[]][]) {
  const items = Array.from({ length: size }, (_, index) => index + 1), draws: number[] = [];
  shuffleOnce(items, bound => { draws.push(bound); return variant === 0 ? 0 : variant === 1 ? bound - 1 : (bound * 3 + 1) % bound; });
  check('nativePuzzle', [items, draws], [expected, calls]);
}
const bound = pinned('2026-11-26-hitapps-special-patterns/bound_native.json', 'aa973ce1477104341afdc47a891473388713ae07');
const positions = (bound.nearest.coordinates as number[][]).map(([column, position]) => ({ column, position }));
for (const { origin, mask, dropped } of bound.nearest.rows as { origin: number; mask: number; dropped: number[] }[]) {
  const index = trimNearest(positions, positions.map((_, i) => !!(mask & (1 << i))), positions[origin]);
  check('nativeBoundPattern', index === undefined ? [] : [index], dropped);
}
for (const row of bound.balance as { n: number; pairMask: number; scissorsMask: number; keptPairs: number[]; keptScissors: number[]; result: number }[]) {
  const upper = Array.from({ length: row.n }, (_, column) => ({ column, position: 2 }));
  const scissors = upper.map(({ column }) => ({ column: (column + 1) % row.n, position: 0 }));
  const pairs = upper.map((_, i) => !!(row.pairMask & (1 << i))), carriers = scissors.map((_, i) => !!(row.scissorsMask & (1 << i)));
  const valid = balancePattern(upper, scissors, pairs, carriers);
  check('nativeBoundPattern', [pairs.map(Number), carriers.map(Number), +valid], [row.keptPairs, row.keptScissors, row.result]);
}
const gold = pinned('2026-11-26-hitapps-golden-generator/weights_native.json', '79e53c36a498fe593d308175c21c0f2c14f90177');
for (const row of gold.weights.examples as { lens: number[]; slots: number[][]; columnWeights: number[]; slotWeights: number[] }[]) {
  const columns = row.lens.map(() => [] as GoldSlot[]);
  for (const [g, invalid, column, distance, weight] of row.slots) columns[column].push({ id: '', golden: !!g, invalid: !!invalid, distance, weight });
  check('nativeGoldPlacement', [goldWeights(columns), columns.flat().map(slot => slot.weight)], [row.columnWeights, row.slotWeights]);
}
for (const [weights, flags, r, selected, calls] of gold.picks as [number[], number[], number, number, number][]) {
  const slots = weights.map((weight, index) => ({ id: String(index), golden: !!flags[index], invalid: false, weight, distance: 4 }));
  let draws = 0;
  const slot = chooseGold(slots, () => { draws++; return r; });
  check('nativeGoldPlacement', [slot ? Number(slot.id) : -1, draws], [selected, calls]);
}
for (const [lens, at, expected] of gold.marks as [number[], number, number[]][]) {
  const columns = lens.map(n => Array.from({ length: n }, (): GoldSlot => ({ id: '', golden: false, distance: 4, invalid: false, weight: 0 })));
  const marked = columns.flat()[at], column = columns.find(column => column.includes(marked))!;
  markGold(column, column.indexOf(marked));
  check('nativeGoldPlacement', columns.flat().map(slot => slot.distance), expected);
}
const easy = { revision: 'source-easy-v1', enabled: true, minLevel: 16, byDifficulty: { hard: { lossThreshold: 3, decCoef: 15 } } } as const;
const request = { level: 16, difficulty: 'hard', previousLosses: 2, random: true, stable: true, special: false, dtoMoves: 100 } as const;
check('recoveredArithmetic', [adjustedMoveBudget(130, -5, true), easyDealTarget({ ...request, dtoPenalty: 10 }, easy),
  easyDealTarget({ ...request, dtoPenalty: -5 }, easy), sourceWithinTolerance(25, 28, true, 10), sourceWithinTolerance(25, 29, true, 10)],
  [123, 85, 80, true, false]);
assert.equal(Object.keys(fixtures).reduce((sum, name) => sum + stats[name], 0), 5972);
console.log(JSON.stringify({ kit: '81da64b3f11acc1a4e4e9ff69c06e3baea5f8481', stats, originalRuntime: 'UNOBSERVED' }, null, 2));
