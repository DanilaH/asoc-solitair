import bank from './campaign-v8-director.json' with { type: 'json' };
import { content8Dealer, decodeRoute } from './campaign-v8-dealer';
import { adjustedMoveBudget, C8_DIFFICULTY, difficultyPenalty, easyDealTarget } from '../domain/difficulty';
import { campaignId } from '../domain/progression';
import type { Attempt, Board, Deal, Save } from '../domain/types';

// R1 IDs and effective budgets are save identities. Keep these definitions
// resolvable even after their issuance policy or the active campaign changes.
const pools = new Map(bank.map(record => {
  const base = content8Dealer.find(deal => deal.id === record.baseId);
  if (!base || base.training || base.initial.movesLeft === null) throw Error('Invalid C8 director bank entry');
  const { movesLeft } = base.initial;
  const tight: Deal = {
    ...base,
    id: base.id + '-tight-r1',
    initial: { ...base.initial, movesLeft: record.tightBudget },
    recoveryPaths: undefined,
  };
  const relief: Deal = {
    ...base,
    id: base.id + '-relief-r1',
    initial: record.relief.initial as Board,
    winningPath: decodeRoute(record.relief.path),
    recoveryPaths: undefined,
  };
  if (tight.initial.movesLeft !== adjustedMoveBudget(movesLeft, -5, true) ||
    relief.initial.movesLeft !== adjustedMoveBudget(movesLeft, 10, true)) throw Error('Invalid C8 director budget');
  return [base.id, { tight, relief }] as const;
}));

export const content8DirectorDeals = [...pools.values()].flatMap(({ tight, relief }) => [tight, relief]);

export function isC8DirectorVariant(dealId: string, baseId: string): boolean {
  const pool = pools.get(baseId);
  return pool?.tight.id === dealId || pool?.relief.id === dealId;
}

export function selectC8Deal(save: Save, base: Deal, previous?: Attempt): Deal {
  const pool = pools.get(base.id), level = base.campaignLevel;
  if (!pool || level === undefined || save.platform?.completedCampaign.includes(campaignId(level))) return base;

  // Count the current exhaustion only when deliberately starting this level
  // again. Reload, mode switches and in-place Restart retain their deal ID.
  const exhaustedHere = previous?.board.phase === 'exhausted' &&
    (previous.dealId === base.id || isC8DirectorVariant(previous.dealId, base.id));
  if (exhaustedHere && previous.dealId !== pool.relief.id) {
    const difficulty = base.difficultyTier ?? 'normal';
    const target = easyDealTarget({
      level, difficulty, random: true, stable: true, special: false,
      previousLosses: previous.director?.previousLosses ?? 0,
    }, {
      enabled: true, minLevel: C8_DIFFICULTY.minLevel,
      byDifficulty: { [difficulty]: { lossThreshold: C8_DIFFICULTY.lossThreshold, targetSteps: base.winningPath.length } },
    });
    if (target !== undefined && pool.relief.winningPath.length <= target) return pool.relief;
  }

  const penalty = difficultyPenalty(save);
  if (penalty === C8_DIFFICULTY.easyPenalty) return pool.relief;
  if (penalty === C8_DIFFICULTY.hardPenalty) return pool.tight;
  return base;
}
