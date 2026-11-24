import releaseConfig from '../config/c8-release.json' with { type: 'json' };
import { releaseProfile } from '../config/profile';
import { LIVEOPS_PREVIEW } from '../domain/campaign-lives';
import { RECOVERY_GAMEPLAY } from '../domain/campaign-recovery';
import { RANDOM_JOKER_PREVIEW } from '../domain/random-joker';
import { equalityAttestedDeals, equalityPreviewDeal, isEqualityVariant } from './campaign-v8-equality';
import { expansionDeals } from './expansion';
import { findDaily } from './daily';
import { modifierDeals } from './modifiers';
import data from './campaign.json' with { type: 'json' };
import { coreSpecialBaseIds, coreSpecialDeals } from './campaign-v8-integrated-specials';
import { content8Special } from './campaign-v8-special';
import { content8BonusDeals } from './campaign-v8-bonus';
import { content8FrozenDeal } from './campaign-v8-frozen';
import { content8BoundDeal } from './campaign-v8-bound';
import { HITAPPS_SPECIALS_PREVIEW, oneKeyDeal, picturedSpecialsDeal } from './campaign-v8-hitapps-specials';
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
import { hitappsDirectorDeals, hitappsDirectorRecords } from './campaign-v8-hitapps-director';
import { adaptiveBank, selectAdaptiveDeal } from './campaign-v8-adaptive';
import { BEYOND80_PREVIEW, campaignId } from '../domain/progression';
import { CONTENT8_PREVIEW } from '../domain/types';
import type { Attempt, Board, BoardCommand, CampaignIssuance, Deal, Save } from '../domain/types';

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
if (releaseProfile?.capabilities.frozenBoundPuzzleGoldenStarter === 'active') {
  for (const deal of coreSpecialDeals) specialByLevel.set(deal.campaignLevel, deal);
}
const hiddenShuffleTrial: Deal = {
  ...content8BonusDeals.find(deal => deal.campaignLevel === 30)!,
  id: 'campaign-c8-hidden-shuffle-030-r1', shufflePolicy: 'hidden-pool-r1',
};
const variants = new Map([
  { deal: content8FrozenDeal, enabled: import.meta.env?.VITE_CONTENT8_FROZEN === '1' },
  { deal: content8BoundDeal, enabled: import.meta.env?.VITE_CONTENT8_BOUND === '1' },
  { deal: oneKeyDeal, enabled: HITAPPS_SPECIALS_PREVIEW },
  { deal: picturedSpecialsDeal, enabled: HITAPPS_SPECIALS_PREVIEW },
  { deal: content8PuzzleDeal, enabled: import.meta.env?.VITE_CONTENT8_SPECIAL === 'puzzle' },
  { deal: content8GoldenDeal, enabled: LIVEOPS_PREVIEW || import.meta.env?.VITE_CONTENT8_SPECIAL === 'gold' },
  { deal: content8StarterDeal, enabled: import.meta.env?.VITE_CONTENT8_SPECIAL === 'starter' },
  { deal: content8ShuffleDeal, enabled: import.meta.env?.VITE_CONTENT8_SPECIAL === 'shuffle' },
  { deal: hiddenShuffleTrial, enabled: import.meta.env?.VITE_CONTENT8_SPECIAL === 'hidden-shuffle' },
].map(({ deal, enabled }) => {
  const base = content8Wave.find(candidate => candidate.campaignLevel === deal.campaignLevel)!;
  if (enabled && !releaseProfile) specialByLevel.set(deal.campaignLevel, deal);
  return [deal.campaignLevel, { deal, ids: new Set([base.id, deal.id, specialByLevel.get(deal.campaignLevel)?.id, ...content8Special.filter(item => item.campaignLevel === deal.campaignLevel).map(item => item.id)]) }] as const;
}));
export const campaignDeals: readonly Deal[] = CONTENT8_PREVIEW
  ? [...content8Campaign.map(deal => specialByLevel.get(deal.campaignLevel) ?? deal), ...(BEYOND80_PREVIEW ? beyond80Deals : [])]
  : content7Deals;
const adaptiveBases = [...content8Campaign, ...beyond80Deals, englishBeyondDeal, ...content8Special, ...content8BonusDeals, ...coreSpecialDeals];
const archivedAdaptive = adaptiveBank(adaptiveBases);
const lateAdaptive = adaptiveBank(adaptiveBases, hitappsDirectorDeals);
export const lateAdaptiveDeals = [...archivedAdaptive.values()].flatMap(({ tight, relief }) => tight ? [tight, relief] : [relief]);
const jokerBase = content8Wave[0];
export const randomJokerDeal: Deal = { ...jokerBase, id: jokerBase.id + '-random-joker-r1', randomJokerPreview: 1 };
const recoveryBase = content8Wave[0];
const freeRecycles = Math.max(1, recoveryBase.winningPath.filter(move => move.type === 'recycle').length);
export const recoveryDeal: Deal = {
  ...recoveryBase, id: recoveryBase.id + '-finite-recovery-r1',
  recovery: { version: 1, freeRecycles, restoreBase: 60, restoreIncrement: 30 },
  initial: { ...recoveryBase.initial, recyclesLeft: freeRecycles },
  recoveryPaths: undefined,
};
// Keep these definitions addressable even after issuance is disabled.
const releaseDealBySource = new Map<string, Deal>();
const releaseSourceById = new Map<string, string>();
const recoveryBases = [recoveryBase, ...content8BonusDeals.filter(deal => deal.campaignLevel === 22 || deal.campaignLevel === 30)];
const recoveryBaseIds = new Set(recoveryBases.map(deal => deal.id));
for (const source of [...recoveryBases, ...lateAdaptiveDeals, ...hitappsDirectorDeals.map(entry => entry.deal)]) {
  if (!recoveryBaseIds.has(source.adaptive?.baseId ?? source.id)) continue;
  const randomJoker = source.campaignLevel === recoveryBase.campaignLevel;
  const recycles = Math.max(1, source.winningPath.filter(command => command.type === 'recycle').length);
  const deal: Deal = {
    ...source, id: `${source.id}-${releaseConfig.policies.issuance}`,
    initial: { ...source.initial, recyclesLeft: recycles },
    recovery: { ...recoveryDeal.recovery!, freeRecycles: recycles },
    recoveryPaths: undefined,
    ...(randomJoker ? { randomJokerPreview: 1 as const, randomJokerCost: 1 as const } : {}),
  };
  releaseDealBySource.set(source.id, deal);
  releaseSourceById.set(deal.id, source.id);
}
const shuffleBySource = new Map([...releaseDealBySource.values()].filter(deal => deal.campaignLevel === 30).map(source => {
  const deal: Deal = { ...source, id: source.id + '-shuffle-r1', shufflePolicy: 'hidden-pool-r1', shuffleCost: 'charge' };
  releaseSourceById.set(deal.id, releaseSourceById.get(source.id)!);
  return [source.id, deal];
}));
export const integratedCampaignDeals = [...releaseDealBySource.values(), ...shuffleBySource.values()];

const all = new Map([introDeal, ...legacyCampaignDeals, ...openingDeals, ...content7Deals, ...content8Slice,
  ...content8Campaign, ...beyond80Deals, englishBeyondDeal, ...integratedCampaignDeals, ...coreSpecialDeals, ...content8DirectorDeals, ...lateAdaptiveDeals, ...hitappsDirectorDeals.map(entry => entry.deal), equalityPreviewDeal, ...equalityAttestedDeals, randomJokerDeal, recoveryDeal, ...content8Special, ...content8BonusDeals,
  ...[...variants.values()].map(({ deal }) => deal)].map(deal => [deal.id, deal]));
export const findDeal = (id: string) => all.get(id) ?? findDaily(id);
export function isCurrentCampaignDeal(dealId: string, base: Deal): boolean {
  dealId = releaseSourceById.get(dealId) ?? dealId;
  const previewIds = CONTENT8_PREVIEW ? variants.get(base.campaignLevel)?.ids : undefined;
  if (CONTENT8_PREVIEW && dealId === recoveryDeal.id && base.id === recoveryBase.id) return true;
  if (CONTENT8_PREVIEW && dealId === randomJokerDeal.id && base.id === jokerBase.id) return true;
  if (CONTENT8_PREVIEW && isEqualityVariant(dealId, base.id)) return true;
  if (previewIds?.has(base.id) && previewIds.has(dealId)) return true;
  const adaptiveBase = CONTENT8_PREVIEW ? all.get(dealId)?.adaptive?.baseId : undefined;
  if (adaptiveBase && (adaptiveBase === base.id || sameLocalizedLevel(adaptiveBase, base))) return true;
  const sourceId = adaptiveBase ?? dealId;
  const origin = coreSpecialBaseIds.get(sourceId);
  const baseOrigin = coreSpecialBaseIds.get(base.id);
  if ((origin || baseOrigin) && (origin ?? sourceId) === (baseOrigin ?? base.id)) return true;
  return dealId === base.id || sameLocalizedLevel(dealId, base) || (CONTENT8_PREVIEW && isC8DirectorVariant(dealId, base.id));
}
export function selectCampaignDeal(save: Save, base: Deal, previous?: Attempt): Deal {
  if (!CONTENT8_PREVIEW) return base;
  if (!releaseProfile && RECOVERY_GAMEPLAY && base.id === recoveryBase.id) return recoveryDeal;
  if (RANDOM_JOKER_PREVIEW && base.id === jokerBase.id) return randomJokerDeal;
  const selected = localizedCampaignDeal(save, selectC8Deal(save, base, previous));
  const previousSource = previous && releaseSourceById.get(previous.dealId);
  const candidate = selectAdaptiveDeal(save, selected, lateAdaptive, previousSource ? { ...previous!, dealId: previousSource } : previous);
  if (!releaseProfile) return candidate;
  const composed = releaseDealBySource.get(candidate.id) ?? candidate;
  return releaseProfile.capabilities.retention === 'c8-retention-candidate-r1' ? shuffleBySource.get(composed.id) ?? composed : composed;
}

const directorRecordsById = new Map(hitappsDirectorRecords.map(record => [record.id, record]));

export function campaignIssuance(save: Save, target: Deal, selected: Deal): CampaignIssuance | undefined {
  if (!releaseProfile || selected.campaignLevel === undefined) return;
  const candidateId = releaseSourceById.get(selected.id) ?? selected.id;
  const generated = directorRecordsById.get(candidateId);
  const source = generated ? 'certified-seed' : selected.adaptive ? 'budget-r2' :
    isC8DirectorVariant(candidateId, target.id) ? 'director-r1' : 'authored';
  const base = generated ? findDeal(generated.baseId)! : target;
  const eligibleLevel = selected.campaignLevel >= 16 && !save.platform?.completedCampaign.includes(campaignId(selected.campaignLevel));
  return {
    version: 1, profile: releaseProfile.id, policy: releaseProfile.policies.issuance,
    baseId: base.id, dealId: selected.id, baseBudget: base.initial.movesLeft, effectiveBudget: selected.initial.movesLeft,
    source,
    ...(generated ? { seed: { value: generated.seed, inputHash: generated.inputHash, boardHash: generated.boardHash, routeHash: generated.routeHash } } : {}),
    equality: eligibleLevel ? 'unknown-cohort' : 'not-eligible',
  };
}

export function campaignRedeal(attempt: Attempt): Deal | undefined {
  if (!CONTENT8_PREVIEW || attempt.daily || attempt.board.phase !== 'exhausted' || attempt.board.movesLeft !== 0) return;
  const current = findDeal(attempt.dealId);
  if (current) return otherC8Layout(current);
}
