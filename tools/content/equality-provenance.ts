import { createHash } from 'node:crypto';
import { assertBoard } from '../../src/domain/engine';
import type { BoardCommand, Deal } from '../../src/domain/types';
import { advance } from '../qa/gameplay-oracle';
import { completeSimulatedPlan, prepareSimulatedShuffle, resolveCandidateSeed } from './candidate-pipeline';
import { eligibleForEquality, selectEquality, type PlayerSegment, type PolicyRun, type SimulationPolicy } from './difficulty-selection';
import { EmbeddedRandom } from './plain-dealer';
import { exchangeSourceSlots, type SourceSlot } from './hitapps-puzzle-distribution';
import { Kind } from '../../src/domain/hitapps-rules';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function sampleEqualityStacks(columns: number, rng: EmbeddedRandom, strategy: 'Equality' | 'Priority' | 'None') {
  if (strategy !== 'Equality') return [];
  if (!Number.isSafeInteger(columns) || columns < 3 || columns > 256) throw Error('Expected three or more source stacks');
  const indices = new Set<number>();
  while (indices.size < 3) indices.add(rng.next(columns));
  return [...indices];
}

/** Known positive path from native PlaceCategoryPairOnStack. The caller discards an incomplete trial. */
export function placeEqualityPairs(slots: SourceSlot[], sizes: readonly number[], rng: EmbeddedRandom, categoryOf: (id: string) => string) {
  if (sizes.length < 3) return { status: 'UNKNOWN_INSUFFICIENT_STACKS' as const, indices: [] };
  const indices: number[] = [];
  while (indices.length < 3) {
    const column = rng.next(sizes.length);
    if (indices.includes(column)) continue;
    indices.push(column);
    const leader = slots.find(slot => slot.container === 0 && slot.kind === Kind.category);
    const at = (position: number) => slots.find(slot => slot.container === 2 && slot.column === column && slot.position === position);
    const first = at(0), second = at(1);
    if (!leader || !first || !second) return { status: 'UNKNOWN_PAIR_INPUT' as const, indices };
    exchangeSourceSlots(leader, first, sizes);
    const word = slots.find(slot => slot.container === 0 && (slot.kind === Kind.word || slot.kind === Kind.puzzleTop ||
      slot.kind === Kind.puzzleBottom) && categoryOf(slot.id) === categoryOf(leader.id));
    if (!word) return { status: 'UNKNOWN_PAIR_WORD' as const, indices };
    exchangeSourceSlots(word, second, sizes);
  }
  return { status: 'APPLIED' as const, indices };
}

export function prepareEqualityPlan(options: {
  request: { level: number; seed: number; featureSeed?: number; issued: number; segment: PlayerSegment };
  cohortEvidence: 'controlled-fixture' | 'unknown';
  config: Parameters<typeof eligibleForEquality>[1] & { version: string; maxCandidates?: number };
  requests: Iterable<number>;
  drawSeed(maxExclusive: number): number;
  deal(seed: number, rng: EmbeddedRandom): Deal;
  policies: readonly SimulationPolicy[];
  appliers?: Parameters<typeof prepareSimulatedShuffle<Deal>>[1];
  acceptFinal?: (candidate: Deal, runs: readonly PolicyRun[], seed: number) => boolean;
}) {
  const { request, config, cohortEvidence } = options;
  const cap = config.maxCandidates ?? 100;
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > 100) throw Error('Expected one to 100 simulation candidates');
  const trials: {
    candidateIndex: number; requestedSeed: number; candidateSeed: number; pairStacks: number[]; budget: number | null;
    afterShuffle: string; appliedFlags: number; failedFlags: number;
    runs: { policyId: string; status: string; steps: number; path: BoardCommand[]; traceDigest: string }[];
  }[] = [];
  const evidence = {
    schema: 1, configVersion: config.version, request, cohortEvidence, strategy: 'Equality',
    tier: 'PRODUCT_MODEL', pairTransform: 'PAIR_TRANSFORM_UNKNOWN', trials,
  } as const;
  // The legacy eligibility helper models whitelists. This handoff also requires actual cohort evidence.
  if (!config.version || request.segment === 'unknown' || cohortEvidence === 'unknown' || !eligibleForEquality(request, config)) {
    return { ...evidence, result: 'INELIGIBLE' } as const;
  }

  for (const requestedSeed of options.requests) {
    if (trials.length === cap) break;
    const candidateSeed = resolveCandidateSeed(requestedSeed, options.drawSeed);
    const rng = new EmbeddedRandom(candidateSeed);
    const deal = options.deal(candidateSeed, rng);
    const pairStacks = sampleEqualityStacks(deal.initial.tableau.length, rng, 'Equality');
    const prepared = prepareSimulatedShuffle(deal, options.appliers);
    assertBoard(prepared.snapshot.initial, prepared.snapshot);
    const afterShuffle = digest(prepared.snapshot.initial);
    const selected = selectEquality([prepared.snapshot], options.policies, {
      distinctPaths: true,
      onTrial(runs) {
        trials.push({
          candidateIndex: trials.length + 1, requestedSeed, candidateSeed, pairStacks,
          budget: prepared.snapshot.initial.movesLeft, afterShuffle, appliedFlags: prepared.appliedFlags,
          failedFlags: prepared.failedFlags,
          runs: runs.map(run => ({ ...run, traceDigest: digest(run.path) })),
        });
      },
    });
    if (selected.deal) {
      for (const run of selected.runs) {
        let board = prepared.snapshot.initial;
        for (const command of run.path) {
          const next = advance(board, command, prepared.snapshot);
          if (!next) throw Error('Equality trace disagrees with independent oracle');
          board = next;
        }
        if (board.phase === 'won') throw Error('Independent oracle won the accepted late-loss trace');
      }
      const final = completeSimulatedPlan(prepared, options.appliers);
      assertBoard(final.snapshot.initial, final.snapshot);
      if (options.acceptFinal && !options.acceptFinal(final.snapshot, selected.runs, candidateSeed)) {
        continue;
      }
      return { ...evidence, result: 'SELECTED_CONTROLLED_CANDIDATE',
        selected: {
          candidateIndex: trials.length, candidateSeed, dealId: final.snapshot.id, afterShuffle,
          final: digest(final.snapshot.initial), appliedFlags: final.appliedFlags, failedFlags: final.failedFlags,
        },
      } as const;
    }
  }
  return { ...evidence, result: 'NO_QUALIFYING_CANDIDATE' } as const;
}
