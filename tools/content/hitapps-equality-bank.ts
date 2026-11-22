import { C8_DIFFICULTY } from '../../src/domain/difficulty';
import { boardRules } from '../../src/domain/engine';
import { equalityBoardBinding, type EqualityCandidate, type EqualityManifest } from '../../src/domain/equality-attestation';
import type { Deal } from '../../src/domain/types';
import { options as oracleOptions } from '../qa/gameplay-oracle';
import { isLateLoss, simulatePolicy, simulationPosition } from './difficulty-selection';
import { authoringHash, hitappsInputHash, prepareHitappsInput, replayAuthoredRoute } from './hitapps-authoring';
import { hitappsBotPolicies } from './hitapps-bots';

export function certifyEqualityBankEntry(base: Deal, deal: Deal, provenance: Pick<EqualityManifest,
  'sourceSeed' | 'paywallSeed' | 'historyPenalty' | 'featureConfig'>): EqualityCandidate | undefined {
  const budget = deal.initial.movesLeft;
  if (!Number.isSafeInteger(provenance.sourceSeed) || provenance.sourceSeed < 0 || provenance.sourceSeed > 2147483647 ||
      !Number.isSafeInteger(provenance.paywallSeed) || provenance.paywallSeed < 1 || provenance.paywallSeed > 2147483647 ||
      !provenance.featureConfig.revision || provenance.featureConfig.pairTransform !== 'UNKNOWN' ||
      base.id === deal.id || base.campaignLevel === undefined || base.campaignLevel !== deal.campaignLevel ||
      deal.daily || boardRules(deal.initial) !== 3 || budget === null || budget <= deal.winningPath.length ||
      authoringHash(base.cards) !== authoringHash(deal.cards) || !deal.winningPath.length ||
      replayAuthoredRoute(deal, deal.winningPath).phase !== 'won') return;
  // The current packaged bank is ordinary product content. A feature-enabled
  // bank must bring its exact, versioned appliers into this verifier first.
  if (provenance.featureConfig.revision !== 'ordinary-product-v1' || provenance.featureConfig.enabled.length ||
      budget - deal.winningPath.length < 6 ||
      ![C8_DIFFICULTY.hardPenalty, 0, C8_DIFFICULTY.easyPenalty].includes(provenance.historyPenalty)) return;
  const input = { schema: 'hitapps-authoring-v1', provenance: 'PRODUCT_ADAPTED', layout: 'random',
    cardOrder: Object.keys(base.cards), stableMoves: true, levelPenalty: 0 } as const;
  const levelInputHash = hitappsInputHash(base, input);
  const prepared = prepareHitappsInput(base, { ...input, levelInputHash }, provenance.historyPenalty);
  if (authoringHash(equalityBoardBinding(prepared.deal(provenance.sourceSeed))) !== authoringHash(equalityBoardBinding(deal))) return;
  const control = { ...base, initial: { ...base.initial, movesLeft: budget } };
  if (!hitappsBotPolicies.some(policy => simulatePolicy(control, policy).status === 'WON')) return;
  const botTraces: EqualityManifest['botTraces'][number][] = [];
  for (const policy of hitappsBotPolicies) {
    const run = simulatePolicy(deal, policy);
    if (!run.lossReason || !isLateLoss(run, budget) || !run.path.some(action => action.type === 'transfer')) return;
    const positions = new Set([simulationPosition(deal.initial)]);
    let duplicate = false;
    const final = replayAuthoredRoute(deal, run.path, board => {
      const position = simulationPosition(board);
      duplicate = positions.has(position);
      positions.add(position);
    });
    if (final.phase === 'won' ||
        (run.lossReason === 'budget' && final.phase !== 'exhausted') ||
        (run.lossReason === 'no-legal-action' && oracleOptions(final, deal).length)) return;
    if (run.lossReason === 'repeated-position' && !duplicate) return;
    botTraces.push({ botStrategyId: policy.id, version: policy.version!, stepCount: run.steps,
      lossReason: run.lossReason, traceActions: run.path, traceDigest: authoringHash(run.path) });
  }
  if (new Set(botTraces.map(trace => trace.traceDigest)).size !== botTraces.length) return;
  const finalBoardHash = authoringHash(equalityBoardBinding(deal));
  const independentlyVerifiedWinningRouteHash = authoringHash(deal.winningPath);
  const identity = {
    rulesVersion: 3, baseId: base.id, dealId: deal.id, dealVersion: deal.version,
    finalBoardHash, independentlyVerifiedWinningRouteHash, baseBudget: prepared.baseBudget, levelInputHash, budget, botTraces, ...provenance,
  } as const;
  return { deal, manifest: {
    version: 2, provenanceTier: 'PRODUCT_ADAPTED', originalRuntime: 'UNOBSERVED',
    runId: authoringHash(identity), engineAndOracle: 'rules3-gameplay-oracle-v1', ...identity,
  } };
}

export function verifyEqualityBankEntry(base: Deal, stored: EqualityCandidate, expected: string) {
  const { sourceSeed, paywallSeed, featureConfig, historyPenalty } = stored.manifest;
  const actual = certifyEqualityBankEntry(base, stored.deal, { sourceSeed, paywallSeed, featureConfig, historyPenalty });
  return actual !== undefined && authoringHash(actual.manifest) === expected &&
    authoringHash(stored.manifest) === expected;
}
