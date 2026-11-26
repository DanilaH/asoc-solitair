import { hitappsR4Difficulty, HITAPPS_SOURCE_QA } from '../config/hitapps-r4';
import { adjustedMoveBudget, easyDealTarget, futureDifficultyPenalty } from '../domain/difficulty';
import type { Attempt, Card, Deal, Save } from '../domain/types';
import { progressiveBonusDeal } from './campaign-v8-bonus';
import { sourceRecords } from './hitapps-r4-bank/index';

export interface SourceRecord {
  seed: number; strategy: string; use: 'campaign' | 'fixed-control' | 'feature-check'; cost: number; reserve: number;
  baseId: string; deal: Omit<Deal, 'cards'>; changedCards: Record<string, Card>;
  sourceHash: string; boardHash: string; traceHash: string; routeHash: string; receiptHash: string;
  basicRuntime: 'rules4-independent-oracle-v1';
  language?: 'ru' | 'en';
  budgets?: Readonly<Record<string, { moves: number; hash: string }>>;
}
export { sourceRecords };

export function bindHitappsBank(known: ReadonlyMap<string, Deal>) {
  const byId = new Map<string, { record: SourceRecord; deal: Deal; hash: string; penalty: number }>();
  for (const record of sourceRecords) {
    if (record.basicRuntime !== 'rules4-independent-oracle-v1' || record.deal.initial.rulesVersion !== 4 ||
        !record.deal.hitapps || !record.deal.winningPath.length || record.cost <= 0 || byId.has(record.deal.id))
      throw Error('Invalid bundled Hitapps candidate');
    const original = known.get(record.baseId);
    if (!original) throw Error(`Missing Hitapps base ${record.baseId}`);
    const cards = Object.fromEntries(Object.entries({ ...original.cards, ...record.changedCards })
      .filter(([id]) => Object.hasOwn(record.deal.initial.hitapps!.cards, id)));
    if (Object.keys(record.deal.initial.hitapps!.cards).some(id => !cards[id])) throw Error(`Missing cards in ${record.deal.id}`);
    const deal = { ...record.deal, cards };
    deal.bonusSlots = progressiveBonusDeal(deal).bonusSlots;
    byId.set(deal.id, { record, deal, hash: record.boardHash, penalty: 0 });
    for (const [penaltyText, adjusted] of Object.entries(record.budgets ?? {})) {
      const penalty = Number(penaltyText);
      if (!Number.isSafeInteger(penalty) || !penalty || adjusted.moves < record.cost ||
          adjusted.moves !== adjustedMoveBudget(deal.initial.movesLeft!, penalty, true)) throw Error(`Incorrect Hitapps budget: ${deal.id}`);
      const revised = { ...deal, id: `${deal.id}-budget-${penalty < 0 ? 'm' : 'p'}${Math.abs(penalty)}`,
        initial: { ...deal.initial, movesLeft: adjusted.moves } };
      byId.set(revised.id, { record, deal: revised, hash: adjusted.hash, penalty });
    }
  }
  return byId;
}

export function selectHitappsBank(bank: ReturnType<typeof bindHitappsBank>, save: Save, base: Deal, previous?: Attempt) {
  if (!HITAPPS_SOURCE_QA || base.training || base.daily || base.campaignLevel === undefined) return;
  const current = previous && bank.get(previous.dealId);
  const currentGeometry = current && JSON.stringify([current.deal.initial.tableau, current.deal.initial.stock, current.deal.initial.faceUp]);
  const penalty = futureDifficultyPenalty(save);
  const language = base.campaignLevel === 81 ? save.settings.contentLanguage ?? 'ru' : 'ru';
  const pool = [...bank.values()].filter(({ deal, record }) => record.use === 'campaign' && deal.campaignLevel === base.campaignLevel &&
    (record.language ?? 'ru') === language && deal.difficultyTier === base.difficultyTier &&
    (!currentGeometry || currentGeometry !== JSON.stringify([deal.initial.tableau, deal.initial.stock, deal.initial.faceUp])));
  const level = base.campaignLevel, difficulty = base.difficultyTier ?? 'normal';
  const budget = base.initial.movesLeft;
  const tryEasier = previous?.board.phase === 'exhausted' && budget !== null && easyDealTarget({ level, difficulty,
    random: true, stable: true, special: false, previousLosses: previous.director?.previousLosses ?? 0,
    dtoMoves: adjustedMoveBudget(budget, penalty, true), dtoPenalty: penalty }, hitappsR4Difficulty.easy);
  pool.sort((left, right) => {
    const balance = Math.abs(left.penalty - penalty) - Math.abs(right.penalty - penalty);
    if (balance) return balance;
    if (typeof tryEasier === 'number' && Math.min(left.record.cost, right.record.cost) <= tryEasier)
      return Number(left.record.cost > tryEasier) - Number(right.record.cost > tryEasier) || left.record.cost - right.record.cost;
    return left.record.seed - right.record.seed;
  });
  return pool[0]?.deal;
}
