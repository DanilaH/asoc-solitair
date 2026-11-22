import { planFutureDifficulty } from '../../src/domain/difficulty';

import { findReferenceRoute } from '../../src/domain/ordinary-search';
import type { BoardCommand, Deal } from '../../src/domain/types';
import { options as oracleOptions } from '../qa/gameplay-oracle';
import { preparePriorityPlan } from './candidate-pipeline';
import { isLateLoss, simulatePolicy } from './difficulty-selection';
import { prepareEqualityPlan } from './equality-provenance';
import { authoringHash, prepareHitappsBoard, prepareHitappsInput, replayAuthoredRoute, rulesSnapshot,
  validateHitappsFeatures, type HitappsFeatureConfig, type HitappsStructure } from './hitapps-authoring';
import { hitappsBotPolicies } from './hitapps-bots';

type DifficultyInput = Parameters<typeof planFutureDifficulty>[0];
type EqualityInput = Pick<Parameters<typeof prepareEqualityPlan>[0], 'request' | 'config' | 'cohortEvidence'>;
type Strategy = { kind: 'None'; seed: number } | { kind: 'Priority'; target: number; tolerancePercent: number } |
  { kind: 'Equality'; eligibility: EqualityInput; minimumSpareMoves: number };

function ordinaryWitness(deal: Deal) {
  const { lock, frozen, bound, puzzle, starter, recovery } = deal;
  if (lock || frozen || bound || puzzle || starter || recovery || deal.initial.joker ||
      Object.values(deal.cards).some(card => card.ordered)) return;
  return findReferenceRoute(deal, deal.initial, 6400).path;
}

export function authorHitappsCandidate(base: Deal, settings: {
  structure: HitappsStructure;
  trustedInputHash?: string;
  features: HitappsFeatureConfig;
  difficulty: Pick<DifficultyInput, 'historyPenalty' | 'previousLosses' | 'special'>;
  easy: Parameters<typeof planFutureDifficulty>[1];
  strategy: Strategy;
  seeds: Iterable<number>;
  drawSeed(maxExclusive: number): number;
  findWitness?: (deal: Deal) => BoardCommand[] | undefined;
}) {
  const { strategy, difficulty, structure, features, drawSeed } = settings;
  const input = prepareHitappsInput(base, structure, difficulty.historyPenalty, settings.trustedInputHash);
  const plan = planFutureDifficulty({
    ...difficulty, baseBudget: input.baseBudget, levelPenalty: structure.levelPenalty,
    stable: structure.stableMoves, random: structure.layout === 'random',
    level: base.campaignLevel ?? 0, difficulty: base.difficultyTier ?? 'normal',
  }, settings.easy);
  const evidence = {
    schema: 'hitapps-pipeline-v1', provenance: 'PRODUCT_ADAPTED', originalFinalBoard: 'UNOBSERVED',
    levelInputHash: structure.levelInputHash, inputProvenance: structure.provenance,
    featureConfig: { revision: features.revision, enabled: features.enabled },
    baseBudget: input.baseBudget, ...plan, strategy: strategy.kind,
  } as const;
  const appliers = validateHitappsFeatures(features);
  const findWitness = settings.findWitness ?? ordinaryWitness;
  const certify = (draft: Deal, seed: number, minimumSpare = 0, proposed?: BoardCommand[]) => {
    const route = proposed ?? (draft.winningPath.length ? draft.winningPath : findWitness(draft));
    if (!route || draft.initial.movesLeft !== plan.effectiveBudget || draft.initial.movesLeft - route.length < minimumSpare) return;
    const deal: Deal = { ...draft, winningPath: route, id: `${base.id}-ha1-${strategy.kind.toLowerCase()}-${seed}-${plan.effectiveBudget}-${authoringHash(rulesSnapshot(draft)).slice(0, 12)}`,
      recoveryPaths: undefined };
    if (replayAuthoredRoute(deal, route).phase !== 'won') return;
    return deal;
  };

  if (strategy.kind === 'None') {
    const result = prepareHitappsBoard(input, { mode: 'fresh', seedRequest: strategy.seed, features, drawSeed });
    return { evidence, deal: certify(result.snapshot, result.seed), selection: {
      seed: result.seed, requestedSeed: result.requestedSeed, finalBoardHash: result.boardHash,
      appliedFlags: result.appliedFlags, failedFlags: result.failedFlags,
    } };
  }
  if (strategy.kind === 'Priority') {
    const selection = preparePriorityPlan({
      requests: settings.seeds, drawSeed, shuffle: seed => input.deal(seed),
      target: plan.easyTarget ?? strategy.target, tolerancePercent: strategy.tolerancePercent, appliers,
      evaluate: ({ snapshot }) => {
        const run = simulatePolicy(snapshot, hitappsBotPolicies[1]);
        if (run.status === 'WON') return { steps: run.steps, value: run.path };
      },
      digest: state => authoringHash({ ...state, snapshot: rulesSnapshot(state.snapshot) }),
    });
    const selected = selection.selected;
    // Final-phase features can change route legality. Search/replay the actual final board.
    const proposed = selected && authoringHash(rulesSnapshot(selected.final.snapshot)) ===
      authoringHash(rulesSnapshot(selected.afterShuffle.snapshot)) ? selected.evaluation : undefined;
    return { evidence, deal: selected && certify(selected.final.snapshot, selected.actualSeed, 0, proposed), selection: {
      attempts: selection.attempts, reason: selection.reason, seed: selected?.actualSeed, requestedSeed: selected?.requestedSeed,
      winningBotSteps: selected?.steps, afterShuffleHash: selected && authoringHash(rulesSnapshot(selected.afterShuffle.snapshot)),
      finalBoardHash: selected && authoringHash(rulesSnapshot(selected.final.snapshot)),
      appliedFlags: selected?.final.appliedFlags, failedFlags: selected?.final.failedFlags,
    } };
  }
  if (!Number.isSafeInteger(strategy.minimumSpareMoves) || strategy.minimumSpareMoves < 1) throw Error('Expected a positive QA move reserve');
  const control: Deal = { ...base, initial: { ...base.initial, movesLeft: plan.effectiveBudget } };
  const ordinaryControl = hitappsBotPolicies.map(policy => simulatePolicy(control, policy));
  if (!ordinaryControl.some(run => run.status === 'WON')) {
    return { evidence, selection: { result: 'ORDINARY_CONTROL_NOT_SOLVED', ordinaryControl }, deal: undefined };
  }
  let deal: Deal | undefined;
  let finalRuns: ReturnType<typeof simulatePolicy>[] = [];
  const selection = prepareEqualityPlan({
    ...strategy.eligibility, requests: settings.seeds, drawSeed, appliers,
    deal: input.deal, policies: hitappsBotPolicies,
    acceptFinal(candidate, _runs, seed) {
      // Keep source acceptance and the product fairness/competence checks independent.
      finalRuns = hitappsBotPolicies.map(policy => simulatePolicy(candidate, policy));
      if (finalRuns.some(run => !isLateLoss(run, plan.effectiveBudget)) ||
          new Set(finalRuns.map(run => authoringHash(run.path))).size !== hitappsBotPolicies.length) return false;
      if (finalRuns.some(run => {
        const final = replayAuthoredRoute(candidate, run.path);
        const transfers = run.path.filter(action => action.type === 'transfer').length;
        return !transfers || final.phase === 'won' ||
          (run.lossReason === 'no-legal-action' && oracleOptions(final, candidate).length !== 0);
      })) return false;
      deal = certify(candidate, seed, strategy.minimumSpareMoves);
      return deal !== undefined;
    },
  });
  return { evidence, deal, selection: { ...selection, ordinaryControl, finalRuns: deal ? finalRuns : [] } };
}
