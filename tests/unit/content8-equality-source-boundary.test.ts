import { expect, it } from 'vitest';
import { eligibleForEquality, selectEquality, type PlayerSegment, type SimulationPolicy } from '../../tools/content/difficulty-selection';
import { prepareEqualityPlan, sampleEqualityStacks } from '../../tools/content/equality-provenance';
import { dealOrdinary, EmbeddedRandom } from '../../tools/content/plain-dealer';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';

/**
 * B3 research-only negative controls around the existing offline selector.
 * These prove our current MODEL behavior, NOT original Hitapps runtime
 * activation, final-board parity, meaningful independent bot strategies,
 * mathematical unwinnability, or a product-ready paywall issuer.
 */
const config = {
  enabled: true, minLevel: 11, limit: 2,
  segments: ['NonPayer', 'Payer', 'PotentialPayer', 'SleepPayer'] as PlayerSegment[],
};
const request = {
  level: 11, seed: 42, issued: 1, segment: 'NonPayer' as PlayerSegment,
};

it('B3 keeps seed, level, enabled, segment and attempt-limit gates independent', () => {
  expect(eligibleForEquality(request, config)).toBe(true);
  expect(eligibleForEquality({ ...request, seed: 0 }, config)).toBe(false);
  expect(eligibleForEquality({ ...request, seed: -1 }, config)).toBe(false);
  expect(eligibleForEquality({ ...request, seed: 2147483648 }, config)).toBe(false);
  expect(eligibleForEquality({ ...request, seed: NaN }, config)).toBe(false);
  expect(eligibleForEquality({ ...request, level: 10 }, config)).toBe(false);
  expect(eligibleForEquality({ ...request, issued: 2 }, config)).toBe(false);
  expect(eligibleForEquality({ ...request, issued: -1 }, config)).toBe(false);
  expect(eligibleForEquality({ ...request, segment: 'unknown' }, config)).toBe(false);
  expect(eligibleForEquality(request, { ...config, enabled: false })).toBe(false);
  expect(eligibleForEquality({ ...request, issued: 0, segment: 'SleepPayer' }, config)).toBe(true);
  // A synthetic allowlist containing unknown is a product policy, NOT native
  // Hitapps' four named purchase-history segments or real billing evidence.
  expect(eligibleForEquality({ ...request, segment: 'unknown' },
    { ...config, segments: ['unknown'] })).toBe(true);
});

function candidate(): Deal {
  const cards = Object.fromEntries(['a', 'b', 'a1', 'b1', 'a2'].map(id => [id,
    { id, category: id[0], leader: id.length === 1, text: id, explanation: '' }]));
  const initial: Board = {
    foundations: [[]],
    tableau: [['a', 'a1'], ['b', 'b1']],
    stock: ['a2'], waste: [],
    faceUp: ['a1', 'b1'], collected: [],
    movesLeft: 100, phase: 'playing',
  };
  return { id: 'synthetic-equality', version: 1, editorialStatus: 'fixture',
    title: '', initial, cards, winningPath: [] };
}
function trapAt(id: string, last: number): SimulationPolicy {
  return { id, choose(board, legal) {
    const type = board.movesLeft === 101 - last ? 'transfer' : board.stock.length ? 'draw' : 'recycle';
    return legal.find(x => x.type === type);
  } };
}
it('B3 accepts two late bot failures at 80% but not an earlier 79% result', () => {
  const deal = candidate(), before = JSON.stringify(deal);
  const accepted = selectEquality([deal], [trapAt('bot-A', 80), trapAt('bot-B', 82)]);
  expect(accepted).toMatchObject({
    attempts: 1, deal,
    runs: [
      { policyId: 'bot-A', status: 'LOST', steps: 80 },
      { policyId: 'bot-B', status: 'LOST', steps: 82 },
    ],
  });
  expect(selectEquality([deal], [trapAt('bot-A', 79), trapAt('bot-B', 82)]))
    .toEqual({ attempts: 1 });
  expect(JSON.stringify(deal)).toBe(before);
});
it('B3 rejects unknown policy, a winning policy, duplicated IDs and excess candidates', () => {
  const deal = candidate();
  const unknown: SimulationPolicy = { id: 'unknown', choose: () => undefined };
  expect(selectEquality([deal], [unknown, trapAt('bot-B', 82)])).toEqual({ attempts: 1 });
  expect(() => selectEquality([deal], [unknown, unknown])).toThrow('distinct configured policies');
  const winning: Deal = {
    id: 'synthetic-winnable', version: 1, editorialStatus: 'fixture', title: '',
    cards: {
      a: { id: 'a', category: 'a', leader: true, text: 'A', explanation: '' },
      a1: { id: 'a1', category: 'a', leader: false, text: 'member', explanation: '' },
    },
    initial: { foundations: [[]], tableau: [['a'], ['a1']], stock: [], waste: [],
      faceUp: ['a','a1'], collected: [], movesLeft: 100, phase: 'playing' },
    winningPath: [],
  };
  const winPolicy: SimulationPolicy = { id:'win', choose: (_board, legal: BoardCommand[]) =>
    legal.find(a => a.type === 'transfer' && a.to.kind === 'foundation') };
  expect(selectEquality([winning], [winPolicy])).toEqual({ attempts: 1 });
  expect(selectEquality(Array.from({ length: 101 }, (_, i) => ({
    ...deal, id: 'unresolved-' + i,
  })), [unknown])).toEqual({ attempts: 100 });
});
it('B3 only requires distinct policy IDs, not independent move strategies', () => {
  // This is a documented MODEL EVIDENCE GAP, not an endorsement of copied bots:
  // two policies with different IDs but identical behavior pass the current
  // adapter. A future native-parity claim needs genuine strategy-system proofs.
  const deal = candidate();
  const duplicateBehavior = [trapAt('same-A', 80), trapAt('same-B', 80)];
  expect(selectEquality([deal], duplicateBehavior)).toMatchObject({
    deal, attempts: 1, runs: [
      { policyId: 'same-A', status: 'LOST', steps: 80 },
      { policyId: 'same-B', status: 'LOST', steps: 80 },
    ],
  });
  expect(selectEquality([deal], duplicateBehavior, { distinctPaths: true })).toEqual({ attempts: 1 });
});

it('samples three unique stacks from the same advanced source stream only for Equality', () => {
  for (const columns of [3, 4, 5]) {
    const rng = new EmbeddedRandom(42), mirror = new EmbeddedRandom(42);
    const sizes = Array(columns).fill(1);
    const source = Array.from({ length: columns + 2 }, (_, i) => i);
    dealOrdinary(source, 2, sizes, rng);
    dealOrdinary(source, 2, sizes, mirror);
    expect(sampleEqualityStacks(columns, rng, 'Priority')).toEqual([]);
    expect(sampleEqualityStacks(columns, rng, 'None')).toEqual([]);
    const expected = new Set<number>();
    while (expected.size < 3) expected.add(mirror.next(columns));
    expect(sampleEqualityStacks(columns, rng, 'Equality')).toEqual([...expected]);
    expect(rng.next()).toBe(mirror.next());
  }
});

it('records an isolated late-loss plan and excludes synthetic unknown cohorts from the handoff', () => {
  const deal = candidate();
  deal.initial.tableau = [['a'], ['a1'], ['b', 'b1']];
  deal.initial.faceUp = ['a', 'a1', 'b1'];
  const stock: SimulationPolicy = { id: 'stock', choose: (board, moves) => moves.find(move => move.type === (board.stock.length ? 'draw' : 'recycle')) };
  const foundation: SimulationPolicy = { id: 'first-foundation', choose: (board, moves, deal) =>
    (board.movesLeft === 100 && moves.find(move => move.type === 'transfer' && move.to.kind === 'foundation')) || stock.choose(board, moves, deal) };
  const options: Parameters<typeof prepareEqualityPlan>[0] = {
    request, config: { ...config, version: 'fixture-1', segments: [...config.segments, 'unknown'] },
    requests: [-1, 42], cohortEvidence: 'controlled-fixture', drawSeed: () => 43, deal: () => deal,
    policies: [stock, foundation],
    appliers: { golden: state => ({ ...state, appliedFlags: state.appliedFlags | 8 }) },
  };
  const outcome = prepareEqualityPlan(options);
  expect(outcome).toMatchObject({
    result: 'SELECTED_CONTROLLED_CANDIDATE', pairTransform: 'PAIR_TRANSFORM_UNKNOWN',
    selected: { candidateIndex: 1, candidateSeed: 43, appliedFlags: 8 },
  });
  const [trial] = outcome.trials;
  expect(trial).toMatchObject({ requestedSeed: -1, candidateSeed: 43, pairStacks: expect.any(Array), appliedFlags: 0 });
  expect(trial.runs.map(run => [run.policyId, run.status, run.steps])).toEqual([
    ['stock', 'LOST', 100], ['first-foundation', 'LOST', 100],
  ]);
  expect(new Set(trial.runs.map(run => run.traceDigest)).size).toBe(2);
  expect(prepareEqualityPlan({ ...options, request: { ...request, segment: 'unknown' } }).trials).toEqual([]);
  expect(prepareEqualityPlan({ ...options, cohortEvidence: 'unknown' }).result).toBe('INELIGIBLE');
});
