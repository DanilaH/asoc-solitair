import { createHash } from 'node:crypto';
import { assertBoard } from '../../src/domain/engine';
import type { BoardCommand, Deal } from '../../src/domain/types';
import { advance } from '../qa/gameplay-oracle';
import { completeSimulatedPlan, prepareSimulatedShuffle, resolveCandidateSeed } from './candidate-pipeline';
import { eligibleForEquality, selectEquality, type PlayerSegment, type SimulationPolicy } from './difficulty-selection';
import { EmbeddedRandom } from './plain-dealer';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function sampleEqualityStacks(columns: number, rng: EmbeddedRandom, strategy: 'Equality' | 'Priority' | 'None') {
  if (strategy !== 'Equality') return [];
  if (!Number.isSafeInteger(columns) || columns < 3 || columns > 256) throw Error('Expected three or more source stacks');
  const indices = new Set<number>();
  while (indices.size < 3) indices.add(rng.next(columns));
  return [...indices];
}

export function prepareEqualityPlan(options: {
  request: { level: number; seed: number; featureSeed?: number; issued: number; segment: PlayerSegment };
  cohortEvidence: 'controlled-fixture' | 'unknown';
  config: Parameters<typeof eligibleForEquality>[1] & { version: string };
  requests: Iterable<number>;
  drawSeed(maxExclusive: number): number;
  deal(seed: number, rng: EmbeddedRandom): Deal;
  policies: readonly SimulationPolicy[];
  appliers?: Parameters<typeof prepareSimulatedShuffle<Deal>>[1];
}) {
  const { request, config, cohortEvidence } = options;
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
      return { ...evidence, result: 'SELECTED_CONTROLLED_CANDIDATE',
        selected: {
          candidateIndex: trials.length, candidateSeed, dealId: final.snapshot.id, afterShuffle,
          final: digest(final.snapshot.initial), appliedFlags: final.appliedFlags, failedFlags: final.failedFlags,
        },
      } as const;
    }
    if (trials.length >= 100) break;
  }
  return { ...evidence, result: 'NO_QUALIFYING_CANDIDATE' } as const;
}
