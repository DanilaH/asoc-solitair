import { isDeepStrictEqual } from 'node:util';
import { planFutureDifficulty } from '../../src/domain/difficulty';
import { applyBoard } from '../../src/domain/engine';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import type { BoardCommand, Deal, DifficultyTier } from '../../src/domain/types';
import { advanceRules4 } from '../qa/hitapps-rules4-oracle';
import { eligibleForEquality, isLateLoss, simulatePolicy, type PlayerSegment, type PolicyRun } from './difficulty-selection';
import { authoringHash } from './hitapps-authoring';
import { hitappsBotPolicies } from './hitapps-bots';
import { sourceWithinTolerance } from './plain-dealer';
import { prepareSourceInput, type SourceInput } from './hitapps-source-authoring';
import { runSourceBot, sourceStrategies } from './hitapps-source-bot';

type Cohort = { version: 'hitapps-local-cohort-v1'; authority: 'fixture' | 'provider'; providerRevision?: string;
  player: { level: number; seed: number; issued: number; segment: PlayerSegment };
  policy: { enabled: boolean; minLevel: number; limit: number; segments: readonly PlayerSegment[] } };
type Strategy = { name: 'None' } | { name: 'Priority'; target: number; tolerance: number } | { name: 'Equality'; cohort: Cohort; spare: number };
export const transfersStudy = '81da64b3f11acc1a4e4e9ff69c06e3baea5f8481';

export interface LocalDifficultyProfile {
  revision: 'hitapps-balance-v1';
  easy: { revision: 'source-easy-v1'; enabled: boolean; minLevel: number;
    byDifficulty: Partial<Record<DifficultyTier, { lossThreshold: number; decCoef: number }>> };
}

export function certifySourceRoute(deal: Deal, path: readonly BoardCommand[], reserve = 0) {
  let board = deal.initial, cost = 0, branches = 0;
  const steps: string[] = [];
  for (const action of path) {
    const actual = applyBoard(board, action, deal), independent = advanceRules4(board, action, deal);
    if (typeof actual === 'string' || !independent || !isDeepStrictEqual(actual.board, independent) ||
        actual.consumedMoves !== board.movesLeft! - independent.movesLeft!) throw Error(`Rules4 oracle disagrees at ${deal.id} step ${steps.length + 1}`);
    cost += actual.consumedMoves;
    branches += actual.events.filter(event => !['transfer', 'draw', 'recycle', 'flip'].includes(event.type)).length;
    steps.push(authoringHash([action, independent, actual.events]));
    board = independent;
  }
  if (board.phase !== 'won' || board.movesLeft === null || board.movesLeft < reserve) return;
  return { cost, reserve: board.movesLeft, routeHash: authoringHash(path), traceHash: authoringHash(steps), automaticFacts: branches };
}

export function authorSourceCandidate(template: Deal, options: {
  input: SourceInput; difficulty: LocalDifficultyProfile; historyPenalty: number; previousLosses: number;
  strategy: Strategy; seeds: Iterable<number>; drawSeed: (cap: number) => number; cap?: number;
  findWitness?: (deal: Deal) => readonly BoardCommand[] | undefined;
}) {
  const strategy = options.strategy;
  const cap = options.cap ?? 100;
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > 100) throw Error('Invalid candidate bound');
  const features = options.input.features;
  const difficulty = planFutureDifficulty({ level: template.campaignLevel ?? 0, baseBudget: template.initial.movesLeft!,
    levelPenalty: options.input.levelPenalty, historyPenalty: options.historyPenalty, previousLosses: options.previousLosses,
    random: options.input.layout === 'random', stable: options.input.stable, difficulty: template.difficultyTier ?? 'normal',
    special: Boolean(features.bound || features.frozen || features.lockers || features.puzzle?.length || features.starter?.length) }, options.difficulty.easy);
  const trials: { requested: number; resolved: number; reason?: string; runs: PolicyRun[] }[] = [];
  const configuration = { strategy: strategy.name, originalRuntime: 'UNOBSERVED', version: 3, rulesVersion: 4,
    research: transfersStudy, policy: options.difficulty.revision, features: features.revision, ...difficulty } as const;
  if (strategy.name === 'Equality') {
    const { cohort, spare } = strategy;
    if (cohort.version !== 'hitapps-local-cohort-v1' || cohort.authority !== 'fixture' &&
        (cohort.authority !== 'provider' || !cohort.providerRevision) || cohort.player.level !== template.campaignLevel ||
        cohort.player.segment === 'unknown' || !eligibleForEquality(cohort.player, cohort.policy) || !Number.isSafeInteger(spare) || spare < 1 ||
        options.input.layout !== 'random') return { status: 'INELIGIBLE_COHORT' as const, configuration, trials };
  }
  const input = prepareSourceInput(template, options.input, difficulty.effectiveBudget);
  const witness = options.findWitness ?? (deal => findReferenceRoute(deal, deal.initial, 5000, true, Infinity, 'verified-specials').path);
  type Prepared = ReturnType<typeof input.prepare>;
  type Selection = { draft: Prepared; runs: PolicyRun[]; requested: number; gap: number };
  function finalize(choice: Selection) {
    const { deal, receipt } = choice.draft.finish();
    const required = strategy.name === 'Equality' ? strategy.spare : 0;
    const certified = (path: readonly BoardCommand[] | undefined) => path?.length ? certifySourceRoute(deal, path, required) : undefined;
    const botPath = choice.runs.find(run => run.status === 'WON')?.path;
    let path = botPath, proof;
    // The final phase can change legality; run product proof on the final board.
    try { proof = certified(path); } catch { /* Candidate witness is only a proposal. */ }
    if (!proof) {
      path = witness(deal) as BoardCommand[] | undefined;
      proof = certified(path);
    }
    if (!path || !proof) return;
    let independentRuns: PolicyRun[] = [];
    if (strategy.name === 'Equality') {
      independentRuns = hitappsBotPolicies.map(policy => simulatePolicy(deal, policy));
      if (independentRuns.some(run => !isLateLoss(run, difficulty.effectiveBudget)) ||
          new Set(independentRuns.map(run => authoringHash(run.path))).size !== independentRuns.length) return;
      if (independentRuns.some(run => {
        let board = deal.initial;
        for (const action of run.path) {
          const next = advanceRules4(board, action, deal);
          if (!next) return true;
          board = next;
        }
        return board.phase === 'won';
      })) return;
    }
    const result: Deal = { ...deal, editorialStatus: 'certified-hitapps-rules4', winningPath: [...path] };
    const manifest = { ...configuration, baseId: template.id, baseBudget: template.initial.movesLeft,
      dealId: result.id, receipt, proof, finalBoardHash: authoringHash([result.initial, result.cards, result.hitapps]),
      sourceRuns: choice.runs.map(run => ({ ...run, traceHash: authoringHash(run.path) })),
      independentRuns: independentRuns.map(run => ({ ...run, traceHash: authoringHash(run.path) })) };
    return { status: 'CERTIFIED' as const, deal: result, manifest, trials };
  }

  let best: Selection | undefined;
  for (const requested of options.seeds) {
    if (trials.length >= cap) break;
    const draft = input.prepare(requested, strategy.name, options.drawSeed);
    const trial: typeof trials[number] = { requested, resolved: draft.seed, runs: [] };
    trials.push(trial);
    if (!draft.deal) { trial.reason = draft.shuffled.snapshot.pairStatus ?? 'INVALID_INPUT'; continue; }
    if (strategy.name === 'None') {
      const result = finalize({ draft, runs: [], requested, gap: 0 });
      if (result) return result;
      trial.reason = 'PRODUCT_PROOF_UNKNOWN';
      continue;
    }
    if (strategy.name === 'Equality') {
      for (const policy of sourceStrategies) {
        const run = runSourceBot(draft.deal, policy);
        trial.runs.push(run);
        if (!isLateLoss(run, difficulty.effectiveBudget)) break;
      }
      if (trial.runs.length === sourceStrategies.length && trial.runs.every(run => isLateLoss(run, difficulty.effectiveBudget))) {
        const result = finalize({ draft, requested, runs: trial.runs, gap: 0 });
        if (result) return result;
        trial.reason = 'PRODUCT_FAIRNESS_REJECTED';
      } else trial.reason = 'SOURCE_LATE_LOSS_REJECTED';
      continue;
    }
    const run = runSourceBot(draft.deal, 'Priority');
    trial.runs.push(run);
    if (run.status !== 'WON') { trial.reason = 'SOURCE_BOT_DID_NOT_WIN'; continue; }
    const target = difficulty.easyTarget ?? strategy.target;
    const gap = Math.abs(run.steps - target);
    const choice = { draft, runs: [run], requested, gap };
    if (!best || gap < best.gap) best = choice;
    if (sourceWithinTolerance(target, run.steps, options.input.stable, strategy.tolerance)) {
      return finalize(choice) ?? { status: 'NO_PRODUCT_PROOF' as const, configuration, trials };
    }
  }
  if (best) {
    const restored = trials.length === cap ? input.prepare(best.draft.seed, 'Priority', options.drawSeed) : best.draft;
    if (!isDeepStrictEqual(restored.shuffled, best.draft.shuffled)) throw Error('Priority candidate restore changed the board or its RNG draws');
    const finishing = restored === best.draft ? restored : { ...restored, finish() {
      const value = restored.finish();
      value.receipt.requestedSeed = best!.requested;
      return value;
    } };
    return finalize({ ...best, draft: finishing }) ?? { status: 'NO_PRODUCT_PROOF' as const, configuration, trials };
  }
  return { status: 'NO_QUALIFYING_CANDIDATE' as const, configuration, trials };
}
