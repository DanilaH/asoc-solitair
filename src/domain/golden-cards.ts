import type { Board, Deal, RewardGrant, Save } from './types';

export function prepareGoldenDeal(base: Deal, previewId: string, sourceGate: { enabled: boolean; count: number },
  candidates: readonly string[], coinsPerCard: number) {
  if (!sourceGate.enabled || sourceGate.count === 0) return { status: 'SKIPPED', deal: base } as const;
  if (!Number.isSafeInteger(sourceGate.count) || sourceGate.count < 0 || sourceGate.count > candidates.length ||
    !previewId || base.id === previewId || !Number.isSafeInteger(coinsPerCard) || coinsPerCard < 1 ||
    !Number.isSafeInteger(coinsPerCard * sourceGate.count)) return { status: 'FAILED', deal: base } as const;
  const ids = candidates.slice(0, sourceGate.count);
  if (new Set(ids).size !== ids.length || ids.some(id => !Object.hasOwn(base.cards, id))) return { status: 'FAILED', deal: base } as const;
  const deal: Deal = { ...base, id: previewId, golden: { version: 1, ids, coinsPerCard } };
  return { status: 'APPLIED', deal } as const;
}

export const goldenRewardKey = (deal: Deal) => `golden-cards:${deal.golden?.rewardGroup ?? deal.id}`;
export const collectedGold = (board: Board, deal: Deal) =>
  board.hitapps ? Object.values(board.hitapps.cards).filter(card => card.gold?.activated).length
    : deal.golden?.ids.filter(id => board.collected.includes(id)).length ?? 0;

export function claimGoldenCards(save: Save, deal: Deal): RewardGrant | undefined {
  const coinsPerCard = deal.hitapps?.gold?.coinsPerActivation ?? deal.golden?.coinsPerCard;
  const key = goldenRewardKey(deal);
  if (coinsPerCard === undefined || deal.daily || save.attempt.daily || save.attempt.dealId !== deal.id ||
    save.attempt.board.phase !== 'won' || save.profile.rewards.includes(key)) return;
  const coins = collectedGold(save.attempt.board, deal) * coinsPerCard;
  if (!Number.isSafeInteger(coins) || coins <= 0 || !Number.isSafeInteger(save.profile.coins + coins)) return;
  save.profile.coins += coins;
  save.profile.rewards.push(key);
  return { key, reason: 'golden_cards', label: 'За золотые карты', coins };
}
