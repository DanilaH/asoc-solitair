import { content8Late, content8Wave } from './campaign-v8-dealer';
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
