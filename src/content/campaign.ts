import { expansionDeals } from './expansion';
import { findDaily } from './daily';
import { modifierDeals } from './modifiers';
import data from './campaign.json' with { type: 'json' };
import { cardsFor, type TopicSelection } from './topics';
import { introDeal } from './intro';
import { withCurrentRules } from './current-rules';
import { openingDeals } from './opening';
import { content7Deals } from './campaign-v7';
import { content8Dealer } from './campaign-v8-dealer';
import { content8Slice } from './campaign-v8-preview';
import { CONTENT8_PREVIEW } from '../domain/types';
import type { Board, BoardCommand, Deal } from '../domain/types';

export interface CampaignRecord {
  id: string; version: number; campaignLevel: number; title: string; topics: TopicSelection[];
  initial: Board; winningPath: BoardCommand[]; tags: string[]; authoringSeed: number; searchVisited: number; editorialStatus: string;
}
export const campaignRecords = data as unknown as CampaignRecord[];
export const legacyCampaignDeals: readonly Deal[] = [...campaignRecords.map(record => withCurrentRules({
  id: record.id, version: record.version, campaignLevel: record.campaignLevel, title: record.title,
  cards: cardsFor(record.topics), initial: record.initial, winningPath: record.winningPath,
  editorialStatus: record.editorialStatus, tags: record.tags,
})), ...modifierDeals, ...expansionDeals];
/** Explicit archive for historical QA and persisted attempts; never select it for Next. */
export const content6CampaignDeals: readonly Deal[] = [...openingDeals, ...legacyCampaignDeals.slice(15)];
const previewByLevel = new Map(content8Dealer.map(deal => [deal.campaignLevel, deal]));
export const campaignDeals: readonly Deal[] = CONTENT8_PREVIEW
  ? content7Deals.map(deal => previewByLevel.get(deal.campaignLevel) ?? deal) : content7Deals;
const all = new Map([introDeal, ...legacyCampaignDeals, ...openingDeals, ...content7Deals, ...content8Slice, ...content8Dealer].map(deal => [deal.id, deal]));
export const findDeal = (id: string) => all.get(id) ?? findDaily(id);
