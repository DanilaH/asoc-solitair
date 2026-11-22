import { equalityPreviewDeal, isEqualityVariant } from './campaign-v8-equality';
import { expansionDeals } from './expansion';
import { findDaily } from './daily';
import { modifierDeals } from './modifiers';
import data from './campaign.json' with { type: 'json' };
import { content8Special } from './campaign-v8-special';
import { content8BonusDeals } from './campaign-v8-bonus';
import { content8FrozenDeal } from './campaign-v8-frozen';
import { content8BoundDeal } from './campaign-v8-bound';
import { content8PuzzleDeal } from './campaign-v8-puzzle';
import { content8GoldenDeal } from './campaign-v8-golden';
import { content8StarterDeal } from './campaign-v8-starter';
import { content8ShuffleDeal } from './campaign-v8-shuffle';
import { cardsFor, type TopicSelection } from './topics';
import { introDeal } from './intro';
import { withCurrentRules } from './current-rules';
import { openingDeals } from './opening';
import { content7Deals } from './campaign-v7';
import { content8Dealer, content8Late, content8Wave } from './campaign-v8-dealer';
import { content8Slice } from './campaign-v8-preview';
import { content8DirectorDeals, isC8DirectorVariant, otherC8Layout, selectC8Deal } from './campaign-v8-director';
import { englishBeyondDeal, localizedCampaignDeal, sameLocalizedLevel } from './campaign-v8-locale';
import { beyond80Deals } from './campaign-v8-beyond';
import { adaptiveBank, selectAdaptiveDeal } from './campaign-v8-adaptive';
import { BEYOND80_PREVIEW } from '../domain/progression';
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
const specialByLevel = new Map([...content8Special, ...content8BonusDeals].map(deal => [deal.campaignLevel, deal]));
const variants = new Map([
  { deal: content8FrozenDeal, enabled: import.meta.env?.VITE_CONTENT8_FROZEN === '1' },
  { deal: content8BoundDeal, enabled: import.meta.env?.VITE_CONTENT8_BOUND === '1' },
  { deal: content8PuzzleDeal, enabled: import.meta.env?.VITE_CONTENT8_SPECIAL === 'puzzle' },
  { deal: content8GoldenDeal, enabled: import.meta.env?.VITE_CONTENT8_SPECIAL === 'gold' },
  { deal: content8StarterDeal, enabled: import.meta.env?.VITE_CONTENT8_SPECIAL === 'starter' },
  { deal: content8ShuffleDeal, enabled: import.meta.env?.VITE_CONTENT8_SPECIAL === 'shuffle' },
].map(({ deal, enabled }) => {
  const base = content8Wave.find(candidate => candidate.campaignLevel === deal.campaignLevel)!;
  if (enabled) specialByLevel.set(deal.campaignLevel, deal);
  return [deal.campaignLevel, { deal, ids: new Set([base.id, deal.id]) }] as const;
}));
export const campaignDeals: readonly Deal[] = CONTENT8_PREVIEW
  ? [...content8Campaign.map(deal => specialByLevel.get(deal.campaignLevel) ?? deal), ...(BEYOND80_PREVIEW ? beyond80Deals : [])]
  : content7Deals;
const lateAdaptive = adaptiveBank([...content8Campaign, ...beyond80Deals, englishBeyondDeal, ...content8Special, ...content8BonusDeals]);
export const lateAdaptiveDeals = [...lateAdaptive.values()].flatMap(({ tight, relief }) => tight ? [tight, relief] : [relief]);
const all = new Map([introDeal, ...legacyCampaignDeals, ...openingDeals, ...content7Deals, ...content8Slice,
  ...content8Campaign, ...beyond80Deals, englishBeyondDeal, ...content8DirectorDeals, ...lateAdaptiveDeals, equalityPreviewDeal, ...content8Special, ...content8BonusDeals,
  ...[...variants.values()].map(({ deal }) => deal)].map(deal => [deal.id, deal]));
export const findDeal = (id: string) => all.get(id) ?? findDaily(id);
export function isCurrentCampaignDeal(dealId: string, base: Deal): boolean {
  const previewIds = CONTENT8_PREVIEW ? variants.get(base.campaignLevel)?.ids : undefined;
  if (CONTENT8_PREVIEW && isEqualityVariant(dealId, base.id)) return true;
  if (previewIds?.has(base.id) && previewIds.has(dealId)) return true;
  const adaptiveBase = CONTENT8_PREVIEW ? all.get(dealId)?.adaptive?.baseId : undefined;
  if (adaptiveBase && (adaptiveBase === base.id || sameLocalizedLevel(adaptiveBase, base))) return true;
  return dealId === base.id || sameLocalizedLevel(dealId, base) || (CONTENT8_PREVIEW && isC8DirectorVariant(dealId, base.id));
}
export function selectCampaignDeal(save: Save, base: Deal, previous?: Attempt): Deal {
  if (!CONTENT8_PREVIEW) return base;
  const selected = localizedCampaignDeal(save, selectC8Deal(save, base, previous));
  return selectAdaptiveDeal(save, selected, lateAdaptive, previous);
}

export function campaignRedeal(attempt: Attempt): Deal | undefined {
  if (!CONTENT8_PREVIEW || attempt.daily || attempt.board.phase !== 'exhausted' || attempt.board.movesLeft !== 0) return;
  const current = findDeal(attempt.dealId);
  if (current) return otherC8Layout(current);
}
