import { assertBoard } from '../../src/domain/engine';
import { Kind, sourceCard, type SourceCard } from '../../src/domain/hitapps-rules';
import type { Card, Deal } from '../../src/domain/types';
import { applyShufflePattern, completeSimulatedPlan, prepareFreshShuffle, prepareSimulatedShuffle, resolveCandidateSeed } from './candidate-pipeline';
import { placeEqualityPairs } from './equality-provenance';
import { authoringHash } from './hitapps-authoring';
import { applyBoundPattern, applyGoldPattern, applyIcePattern, applyLockerPattern, insertStarter,
  type BoundPattern, type IcePattern, type LockerPattern } from './hitapps-patterns';
import { redistributePuzzle, type SourceSlot } from './hitapps-puzzle-distribution';
import { dealOrdinary, EmbeddedRandom } from './plain-dealer';

type Pattern<T> = { enabled: boolean; seed: number; index: number; minLevel?: number; data: T };
export interface SourceFeatures {
  revision: 'hitapps-features-v1';
  ordered?: readonly string[];
  puzzle?: readonly { assembled: string; halves: [Card, Card]; tag: number }[];
  lockers?: Pattern<readonly LockerPattern[]>;
  frozen?: Pattern<readonly IcePattern[]>;
  bound?: Pattern<BoundPattern>;
  gold?: { initial: number; first: number; total: number; seed: number; coinsPerActivation: number; eventKey?: string };
  starter?: readonly { card: Card; kind: 5 | 6; seed: number }[];
}
type FeatureResult = { id: string; status: string; mask?: number };
type Draw = [bound: number, value: number];
type State = { cards: Record<string, Card>; properties: Record<string, SourceCard>; slots: SourceSlot[];
  drawStreams: { seed: number; draws: Draw[] }[]; features: FeatureResult[]; hashes: Record<string, string>;
  pairs: number[]; pairStatus?: string; featureSeed?: number;
  gold: number[]; starters: { id: string; seed: number; index: number }[] };
type Appliers = NonNullable<Parameters<typeof prepareSimulatedShuffle<State>>[1]>;

export type SourceInput = { version: 'hitapps-input-v2'; layout: 'fixed' | 'random'; stable: boolean; levelPenalty: number;
  cardOrder: readonly string[]; features: SourceFeatures };
export const emptyFeatures: SourceFeatures = { revision: 'hitapps-features-v1' };

export function sourceCardOrder(deal: Deal) {
  const cards = Object.values(deal.cards);
  return cards.filter(card => card.leader).flatMap(leader => [leader.id,
    ...cards.filter(card => !card.leader && card.category === leader.category).map(card => card.id)]);
}

function phaseHash(state: State) {
  return authoringHash([state.slots, state.properties]);
}

function requireNatural(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw Error(`Invalid ${label}`);
}

export function prepareSourceInput(template: Deal, input: SourceInput, effectiveBudget: number) {
  const { features } = input;
  const physical = [...template.initial.stock, ...template.initial.tableau.flat()];
  if (input.version !== 'hitapps-input-v2' || features.revision !== 'hitapps-features-v1' || !Number.isSafeInteger(effectiveBudget) ||
    effectiveBudget <= 0 || template.daily || template.training || template.initial.waste.length || template.initial.collected.length ||
    template.initial.foundations.some(pile => pile.length) || physical.length !== input.cardOrder.length ||
    new Set(input.cardOrder).size !== physical.length || input.cardOrder.some(id => !physical.includes(id) || !template.cards[id]))
    throw Error('Expected a fresh source input with an explicit physical card order');
  const categories = Object.values(template.cards).filter(card => card.leader).map(card => card.category);
  const parts = new Set<string>(), tags = new Set<number>(), assembled = new Set<string>();
  for (const entry of features.puzzle ?? []) {
    const word = template.cards[entry.assembled];
    if (!word || word.leader || assembled.has(word.id) || !Number.isSafeInteger(entry.tag) || entry.tag < 1 || tags.has(entry.tag) ||
      entry.halves.some(card => card.category !== word.category || card.leader || card.rank !== undefined || Object.hasOwn(template.cards, card.id)) ||
      entry.halves.some(card => parts.has(card.id)) || entry.halves[0].id === entry.halves[1].id)
      throw Error('Invalid separate puzzle population');
    assembled.add(word.id);
    tags.add(entry.tag);
    for (const card of entry.halves) parts.add(card.id);
  }
  const boosters = new Set<string>();
  for (const { card, kind, seed } of features.starter ?? []) {
    requireNatural(seed, 'starter seed');
    if (seed > 0xffffffff || boosters.has(card.id) || parts.has(card.id) || Object.hasOwn(template.cards, card.id) ||
        (kind !== Kind.magnet && kind !== Kind.hammer)) throw Error('Invalid starter card');
    boosters.add(card.id);
  }
  const gold = features.gold;
  if (gold) {
    for (const value of [gold.initial, gold.total, gold.first, gold.seed, gold.coinsPerActivation]) requireNatural(value, 'gold policy');
    if (gold.initial > gold.total || gold.first > gold.total || gold.total > physical.length || gold.seed > 2147483647 ||
        !Number.isSafeInteger(gold.total * gold.coinsPerActivation)) throw Error('Invalid gold policy bounds');
  }
  if (features.ordered?.some(category => !categories.includes(category))) throw Error('Unknown ordered category');
  const sourceHash = authoringHash({ level: template.campaignLevel, input, cards: template.cards, initial: template.initial, effectiveBudget });
  const size = template.initial.tableau.map(column => column.length);
  const configuration: NonNullable<Deal['hitapps']> = { policy: 'hitapps-rules4-v1',
    assemblies: (features.puzzle ?? []).map(row => ({ tag: row.tag, card: row.assembled, halves: [row.halves[0].id, row.halves[1].id] })),
    ...(gold && { gold: { total: gold.total, first: gold.first, coinsPerActivation: gold.coinsPerActivation, ...(gold.eventKey && { eventKey: gold.eventKey }) } }),
  };

  function prepare(request: number, strategy: 'None' | 'Priority' | 'Equality', drawSeed: (cap: number) => number) {
    const seed = resolveCandidateSeed(request, drawSeed);
    const state: State = { cards: structuredClone(template.cards), properties: {}, slots: [], drawStreams: [], features: [],
      hashes: {}, pairs: [], gold: [], starters: [] };
    for (const id of input.cardOrder) {
      const card = template.cards[id];
      state.properties[id] = sourceCard(card.leader ? Kind.category : Kind.word, card.rank ?? 0);
    }
    let rng: EmbeddedRandom;
    function layout(snapshot: State, requestedSeed = seed) {
      const draws: Draw[] = [];
      rng = new EmbeddedRandom(requestedSeed, (bound, draw) => draws.push([bound, draw]));
      snapshot.drawStreams.push({ seed: requestedSeed, draws });
      const base = input.layout === 'fixed' ? template.initial : dealOrdinary(input.cardOrder, template.initial.stock.length, size, rng);
      const indexed = new Map<string, SourceSlot>();
      base.stock.forEach((id, position) => indexed.set(id, { id, kind: snapshot.properties[id].kind, container: 0, column: 0, position, flags: 2 }));
      base.tableau.forEach((pile, column) => pile.forEach((id, position) => indexed.set(id, { id, kind: snapshot.properties[id].kind,
        container: 2, column, position, flags: (input.layout === 'fixed' ? template.initial.faceUp.includes(id) : position === pile.length - 1) ? 80 : 1 })));
      snapshot.slots = input.cardOrder.map(id => indexed.get(id)!);
      snapshot.hashes.base = phaseHash(snapshot);
      return snapshot;
    }
    function puzzle(snapshot: State) {
      // The actual initial puzzle population is unresolved. This input adapter records both explicit own halves.
      let nextStock = snapshot.slots.filter(slot => slot.container === 0).length;
      for (const { assembled, halves, tag } of features.puzzle ?? []) {
        const at = snapshot.slots.findIndex(slot => slot.id === assembled);
        if (at < 0) throw Error('Missing puzzle anchor');
        const order = snapshot.properties[assembled].order;
        halves.forEach((card, index) => {
          const kind = index === 0 ? Kind.puzzleTop : Kind.puzzleBottom;
          snapshot.cards[card.id] = { ...card };
          snapshot.properties[card.id] = sourceCard(kind, order, tag);
          if (index === 0) snapshot.slots[at] = { ...snapshot.slots[at], id: card.id, kind };
          else snapshot.slots.push({ id: card.id, kind, container: 0, column: 0, position: nextStock++, flags: 2 });
        });
      }
      const moved = features.puzzle?.length ? redistributePuzzle(snapshot.slots, size, cap => rng.next(cap)) : [];
      snapshot.features.push({ id: 'puzzle', status: features.puzzle?.length ? (moved.length ? 'APPLIED' : 'NO_EXCHANGE') : 'SKIPPED' });
      snapshot.hashes.puzzle = phaseHash(snapshot);
      return snapshot;
    }
    const modifier = <T>(id: string, feature: Pattern<T> | undefined, flags: [number, number], write: (snapshot: State, data: T) => string): NonNullable<Appliers['frozen']> => phase => {
      if (input.layout === 'fixed' || !feature) return phase;
      let result = 'SKIPPED';
      const next = applyShufflePattern(phase, {
        enabled: feature.enabled, level: template.campaignLevel ?? 0, minLevel: feature.minLevel ?? 0,
        pattern: feature.index, featureSeed: feature.seed, appliedFlag: flags[0], failedFlag: flags[1],
        shuffle(snapshot, featureSeed) {
          snapshot.featureSeed = featureSeed;
          return puzzle(layout(snapshot, featureSeed));
        },
        apply(snapshot) {
          result = write(snapshot, feature.data);
          return result === 'APPLIED' ? snapshot : undefined;
        },
      });
      next.snapshot.features.push({ id, status: result, mask: result === 'APPLIED' ? flags[0] : result === 'SKIPPED' ? 0 : flags[1] });
      return next;
    };
    const appliers: Appliers = {
      paywall(phase) {
        phase.snapshot.features.push({ id: 'paywall', status: 'TRUSTED_COHORT_REQUIRED' });
        return phase;
      },
      ordered(phase) {
        for (const category of features.ordered ?? []) {
          const words = input.cardOrder.filter(id => phase.snapshot.cards[id].category === category && !phase.snapshot.cards[id].leader);
          words.forEach((id, index) => { phase.snapshot.properties[id].order = index + 1; });
        }
        const applied = Boolean(features.ordered?.length);
        phase.snapshot.hashes.initial = phaseHash(phase.snapshot);
        phase.snapshot.features.push({ id: 'ordered', status: applied ? 'APPLIED' : 'SKIPPED', mask: applied ? 16 : 0 });
        return { ...phase, appliedFlags: phase.appliedFlags | (applied ? 16 : 0) };
      },
      puzzleDistribution(phase) { if (input.layout === 'random') puzzle(phase.snapshot); return phase; },
      equalityPairs(phase) {
        if (strategy === 'Equality' && input.layout === 'random') {
          const pair = placeEqualityPairs(phase.snapshot.slots, size, rng, id => phase.snapshot.cards[id].category);
          phase.snapshot.pairs = pair.indices;
          phase.snapshot.pairStatus = pair.status;
          phase.snapshot.features.push({ id: 'equalityPairs', status: pair.status });
        }
        phase.snapshot.hashes.pairs = phaseHash(phase.snapshot);
        return phase;
      },
      lockers: modifier('lockers', features.lockers, [2, 4], (next, data) => applyLockerPattern(next.slots, next.properties, data)),
      frozen: modifier('frozen', features.frozen, [32, 64], (next, data) => applyIcePattern(next.slots, next.properties, data)),
      bound: modifier('bound', features.bound, [128, 256], (next, data) => applyBoundPattern(next.slots, next.properties, data, id => next.cards[id].category)),
      golden(phase) {
        if (!gold || input.layout === 'fixed') return phase;
        const next = new EmbeddedRandom(gold.seed), snapshot = phase.snapshot;
        const selected = applyGoldPattern(snapshot.slots, snapshot.properties, gold.initial, () => {
          const value = next.next() / 2147483647;
          snapshot.gold.push(value);
          return value;
        });
        snapshot.features.push({ id: 'gold', status: selected.length ? 'APPLIED' : 'SKIPPED', mask: selected.length ? 8 : 0 });
        return { ...phase, appliedFlags: phase.appliedFlags | (selected.length ? 8 : 0) };
      },
      starterBooster(phase) {
        if (input.layout === 'fixed') return phase;
        const snapshot = phase.snapshot;
        for (const { card, kind, seed } of features.starter ?? []) {
          snapshot.cards[card.id] = card;
          snapshot.properties[card.id] = sourceCard(kind);
          const index = insertStarter(snapshot.slots, card.id, template.campaignLevel ?? 0, kind, seed);
          snapshot.starters.push({ id: card.id, seed, index });
        }
        snapshot.features.push({ id: 'starter', status: snapshot.starters.length ? 'APPLIED' : 'SKIPPED' });
        return phase;
      },
    };
    const shuffled = strategy === 'None' ? prepareFreshShuffle(state, appliers, layout) : prepareSimulatedShuffle(layout(state), appliers);
    shuffled.snapshot.hashes.modifiers = phaseHash(shuffled.snapshot);
    function materialize(snapshot: State, final: boolean): Deal {
      const tableau = size.map((_, column) => snapshot.slots.filter(slot => slot.container === 2 && slot.column === column)
        .sort((left, right) => left.position - right.position).map(slot => slot.id));
      const stock = snapshot.slots.filter(slot => slot.container === 0).sort((left, right) => left.position - right.position).map(slot => slot.id);
      const faceUp = snapshot.slots.filter(slot => slot.container === 2 && !(slot.flags & 1)).map(slot => slot.id);
      const identity = phaseHash(snapshot);
      const { lock, frozen, bound, puzzle, starter, golden, training, adaptive, recoveryPaths, legacyWinningPath, ...legacy } = template;
      const deal: Deal = { ...legacy, cards: snapshot.cards, version: template.version + 1,
        id: `campaign-ha4-${template.campaignLevel ?? 0}-${seed}-${identity.slice(0, 16)}-${sourceHash.slice(0, 8)}`,
        hitapps: final ? configuration : { ...configuration, gold: undefined },
        editorialStatus: 'hitapps-candidate', winningPath: [], initial: {
          ...template.initial, rulesVersion: 4, movesLeft: effectiveBudget, tableau, stock, faceUp, keys: undefined,
          hitapps: { move: 0, cards: snapshot.properties, spent: [], generatedGold: Object.values(snapshot.properties).filter(card => card.gold).length },
        } };
      assertBoard(deal.initial, deal);
      return deal;
    }
    const valid = !shuffled.snapshot.pairStatus || shuffled.snapshot.pairStatus === 'APPLIED';
    return { seed, valid, shuffled, deal: valid ? materialize(shuffled.snapshot, false) : undefined,
      finish() {
        if (!valid) throw Error('Cannot finalize an unproven pair transform');
        const final = completeSimulatedPlan(shuffled, appliers);
        final.snapshot.hashes.final = phaseHash(final.snapshot);
        return { deal: materialize(final.snapshot, true), receipt: {
          requestedSeed: request, resolvedSeed: seed, sourceHash, phases: final.snapshot.hashes,
          streams: final.snapshot.drawStreams, results: final.snapshot.features, pairs: final.snapshot.pairs,
          featureSeed: final.snapshot.featureSeed, gold: final.snapshot.gold, starters: final.snapshot.starters,
          appliedMask: final.appliedFlags, failedMask: final.failedFlags,
        } };
      } };
  }
  return { prepare, sourceHash };
}
