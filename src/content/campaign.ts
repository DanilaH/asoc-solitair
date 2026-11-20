import { expansionDeals } from './expansion';
import { findDaily } from './daily';
import { modifierDeals } from './modifiers';
import data from './campaign.json' with { type: 'json' };
import { content8Special } from './campaign-v8-special';
import { cardsFor, type TopicSelection } from './topics';
import { introDeal } from './intro';
import { withCurrentRules } from './current-rules';
import { openingDeals } from './opening';
import { content7Deals } from './campaign-v7';
import { content8Dealer, content8Late, content8Wave } from './campaign-v8-dealer';
import { content8Slice } from './campaign-v8-preview';
import { content8DirectorDeals, isC8DirectorVariant, selectC8Deal } from './campaign-v8-director';
import { CONTENT8_PREVIEW } from '../domain/types';
import type { Attempt, Board, BoardCommand, Deal, Save } from '../domain/types';

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
const content8Campaign = [...content8Dealer, ...content8Wave, ...content8Late];
const specialByLevel = new Map(content8Special.map(deal => [deal.campaignLevel, deal]));
export const campaignDeals: readonly Deal[] = CONTENT8_PREVIEW
  ? content8Campaign.map(deal => specialByLevel.get(deal.campaignLevel) ?? deal)
  : content7Deals;
const all = new Map([introDeal, ...legacyCampaignDeals, ...openingDeals, ...content7Deals, ...content8Slice,
  ...content8Campaign, ...content8DirectorDeals, ...content8Special].map(deal => [deal.id, deal]));
export const findDeal = (id: string) => all.get(id) ?? findDaily(id);
export function isCurrentCampaignDeal(dealId: string, base: Deal): boolean {
  return dealId === base.id || (CONTENT8_PREVIEW && isC8DirectorVariant(dealId, base.id));
}
export function selectCampaignDeal(save: Save, base: Deal, previous?: Attempt): Deal {
  return CONTENT8_PREVIEW ? selectC8Deal(save, base, previous) : base;
}
