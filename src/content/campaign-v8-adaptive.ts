import { adjustedMoveBudget, C8_DIFFICULTY, futureDifficultyPenalty, SOURCE_DIFFICULTY_PREVIEW } from '../domain/difficulty';
import { campaignId } from '../domain/progression';
import type { Attempt, Deal, Save } from '../domain/types';

export const ADAPTIVE_PREVIEW = SOURCE_DIFFICULTY_PREVIEW;
const profile = 'c8-budget-r2';

type AdaptiveVariants = { tight?: Deal; relief: Deal; easy?: Deal; archived?: readonly string[] };

export function adaptiveBank(bases: readonly Deal[], generated: readonly {
  deal: Deal; direction: 'tight' | 'relief' | 'easy';
}[] = []) {
  const pools = new Map<string, AdaptiveVariants>(bases.flatMap(base => {
    if (base.campaignLevel === undefined || base.campaignLevel < 16 || base.training || !base.initial.movesLeft) return [];
    const budget = base.initial.movesLeft;
    const variant = (direction: 'tight' | 'relief', penalty: number): Deal => ({
      ...base, id: `${base.id}-${direction}-r2`,
      initial: { ...base.initial, movesLeft: adjustedMoveBudget(budget, penalty, true) },
      adaptive: { version: 1, profile, baseId: base.id, direction, scope: 'PRODUCT_ADAPTED', proof: 'rules3-dual-replay-r2' },
      recoveryPaths: undefined,
    });
    const tight = variant('tight', C8_DIFFICULTY.hardPenalty);
    const relief = variant('relief', C8_DIFFICULTY.easyPenalty);
    if (relief.initial.movesLeft! <= budget || base.winningPath.length === 0) return [];
    const certifiedTight = tight.initial.movesLeft! < budget && tight.initial.movesLeft! >= base.winningPath.length ? tight : undefined;
    return [[base.id, { tight: certifiedTight, relief, archived: [relief.id, ...(certifiedTight ? [certifiedTight.id] : [])] }] as const];
  }));
  for (const { deal, direction } of generated) {
    const pool = pools.get(deal.adaptive?.baseId ?? '');
    if (pool) pool[direction] = deal;
  }
  return pools;
}

export type AdaptiveBank = ReturnType<typeof adaptiveBank>;

export function selectAdaptiveDeal(save: Save, base: Deal, bank: AdaptiveBank, previous?: Attempt, enabled = ADAPTIVE_PREVIEW): Deal {
  const pool = bank.get(base.id), level = base.campaignLevel;
  if (!enabled || !pool || level === undefined || save.platform?.completedCampaign.includes(campaignId(level))) return base;
  if (previous?.board.phase === 'exhausted' && [base.id, pool.tight?.id, pool.relief.id, pool.easy?.id, ...(pool.archived ?? [])].includes(previous.dealId) &&
      (previous.director?.previousLosses ?? 0) + 1 >= C8_DIFFICULTY.lossThreshold) return pool.easy ?? pool.relief;
  const penalty = futureDifficultyPenalty(save);
  if (penalty === C8_DIFFICULTY.hardPenalty) return pool.tight ?? base;
  if (penalty === C8_DIFFICULTY.easyPenalty) return pool.relief;
  return base;
}
