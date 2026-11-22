import { adjustedMoveBudget, C8_DIFFICULTY, difficultyPenalty } from '../domain/difficulty';
import { campaignId } from '../domain/progression';
import type { Attempt, Deal, Save } from '../domain/types';

export const ADAPTIVE_PREVIEW = import.meta.env?.VITE_C8_OWNER_PREVIEW === 'director';
const profile = 'c8-budget-r2';

export function adaptiveBank(bases: readonly Deal[]) {
  return new Map(bases.flatMap(base => {
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
    return [[base.id, { tight: certifiedTight, relief }] as const];
  }));
}

export type AdaptiveBank = ReturnType<typeof adaptiveBank>;

export function selectAdaptiveDeal(save: Save, base: Deal, bank: AdaptiveBank, previous?: Attempt, enabled = ADAPTIVE_PREVIEW): Deal {
  const pool = bank.get(base.id), level = base.campaignLevel;
  if (!enabled || !pool || level === undefined || save.platform?.completedCampaign.includes(campaignId(level))) return base;
  if (previous?.board.phase === 'exhausted' && [base.id, pool.tight?.id, pool.relief.id].includes(previous.dealId) &&
      (previous.director?.previousLosses ?? 0) + 1 >= C8_DIFFICULTY.lossThreshold) return pool.relief;
  const penalty = difficultyPenalty(save);
  if (penalty === C8_DIFFICULTY.hardPenalty) return pool.tight ?? base;
  if (penalty === C8_DIFFICULTY.easyPenalty) return pool.relief;
  return base;
}
