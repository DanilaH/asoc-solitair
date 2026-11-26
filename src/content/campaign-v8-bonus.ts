import { content8Late, content8Wave } from './campaign-v8-dealer';
import { RELEASE_UNLOCK } from '../domain/progression';
import type { Deal } from '../domain/types';

const offers: Record<number, NonNullable<Deal['bonusSlots']>> = {
  22: { foundation: { coins: 100 } },
  30: { tableau: { coins: 60 } },
  40: { foundation: { coins: 100 }, tableau: { coins: 60 } },
};

export const content8BonusDeals: readonly Deal[] = [...content8Wave, ...content8Late]
  .filter(deal => deal.campaignLevel! in offers)
  .map(deal => ({
    ...deal,
    id: deal.id.replace('campaign-c8-wave-', 'campaign-c8-bonus-'),
    bonusSlots: offers[deal.campaignLevel!],
    tags: [...(deal.tags ?? []), 'optional-bonus-slots'],
  }));




export function progressiveBonusDeal(source: Deal): Deal {
  const level = source.campaignLevel ?? 0;
  if (source.training || source.lock || source.bound || source.frozen || source.puzzle ||
      source.golden || source.starter || Object.values(source.cards).some(card => card.ordered)) return source;
  const hasRoom = (count: number) => count === 3 || count === 4;
  const foundation = source.bonusSlots?.foundation ??
    (level >= RELEASE_UNLOCK.foundation && hasRoom(source.initial.foundations.length) ? offers[22].foundation : undefined);
  const tableau = source.bonusSlots?.tableau ??
    (level >= RELEASE_UNLOCK.tableau && hasRoom(source.initial.tableau.length) ? offers[30].tableau : undefined);
  if (foundation === source.bonusSlots?.foundation && tableau === source.bonusSlots?.tableau) return source;
  return { ...source, id: source.id + '-bonus-r2', bonusSlots: { foundation, tableau } };
}
