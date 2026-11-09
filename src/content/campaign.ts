import data from './campaign.json' with { type: 'json' };
import { cardsFor, type TopicSelection } from './topics';
import { introDeal } from './intro';
import type { Board, BoardCommand, Deal } from '../domain/types';

export interface CampaignRecord {
  id: string; version: number; campaignLevel: number; title: string; topics: TopicSelection[];
  initial: Board; winningPath: BoardCommand[]; tags: string[]; authoringSeed: number; searchVisited: number; editorialStatus: string;
}
export const campaignRecords = data as unknown as CampaignRecord[];
export const campaignDeals: readonly Deal[] = campaignRecords.map(record => ({
  id: record.id, version: record.version, campaignLevel: record.campaignLevel, title: record.title,
  cards: cardsFor(record.topics), initial: record.initial, winningPath: record.winningPath,
  editorialStatus: record.editorialStatus, tags: record.tags,
}));
const all = new Map([introDeal, ...campaignDeals].map(deal => [deal.id, deal]));
export const findDeal = (id: string) => all.get(id);
