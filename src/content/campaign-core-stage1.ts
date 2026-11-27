import { EXTENDED_CHAPTER } from '../config/campaign-meta';
import { E4_M1, M1 } from '../config/economy';
import stage2Specials from './hitapps-r4-bank/stage2-specials.json' with { type: 'json' };
import type { SourceRecord } from './hitapps-r4-bank';
import { campaignCorePolicy, hitappsR4Difficulty } from '../config/hitapps-r4';
import { adjustedMoveBudget, easyDealTarget, futureDifficultyPenalty } from '../domain/difficulty';
import type { Attempt, CampaignIssuance, Deal, Save } from '../domain/types';
import { bindHitappsBank, hitappsGeometry, sameHitappsMechanics } from './hitapps-r4-bank';
import { lateSourceRecords } from './hitapps-r4-bank/core-stage1/late';
import { openingSourceRecords } from './hitapps-r4-bank/core-stage1';

type Bank = ReturnType<typeof bindHitappsBank>;
type Candidate = Bank extends Map<string, infer Entry> ? Entry : never;
type Layout = Candidate & { geometryId: string; geometry: string };
type Rotation = NonNullable<CampaignIssuance['rotation']>;

// These commercial terms and rules belong to the version in the issued Deal ID.
const helpers = { version: 1, randomJokerCoins: 250, unlimitedCoins: 120, unlimitedMs: 60000 } as const;
const upperSlot = { coins: 100 }, lowerSlot = { coins: 60 };
const training = new Map<number, Deal['training']>([[1, 'first'], [3, 'hint'], [4, 'undo'], [5, 'planning']]);
const slotsSupportOffer = (piles: string[][]) => piles.length === 3 || piles.length === 4;

function coreDeal(source: Deal): Deal {
  const level = source.campaignLevel!;
  const supportsSlots = level >= 6;
  const foundation = source.bonusSlots?.foundation ?? (supportsSlots && slotsSupportOffer(source.initial.foundations) ? upperSlot : undefined);
  const tableau = source.bonusSlots?.tableau ?? (supportsSlots && slotsSupportOffer(source.initial.tableau) ? lowerSlot : undefined);
  return {
    ...source, id: source.id + '-core-stage1-v1',
    training: training.get(level),
    ...(foundation || tableau ? { bonusSlots: { foundation, tableau } } : {}),
    ...(level > 1 ? { extraHelpers: helpers, randomJokerPreview: 1, randomJokerCost: undefined,
      shufflePolicy: 'hidden-pool-r1', shuffleCost: 'charge' } : {}),
  };
}

/** Own seeded selection over the independently certified bank. The generator itself runs offline. */
export function bindCampaignCore(known: ReadonlyMap<string, Deal>, archived: Bank, extended?: SourceRecord[]) {
  const byId = new Map<string, Layout>(), byLevel = new Map<number, Layout[]>();
  const identities = new Map<string, string>();
  const additions = bindHitappsBank(known, extended ?? [...openingSourceRecords, ...lateSourceRecords, ...stage2Specials as unknown as SourceRecord[]]);
  for (const { record, deal: source, hash, penalty } of [...additions.values(), ...archived.values()]) {
    const level = source.campaignLevel!;
    if (record.use !== 'campaign' || (extended ? level < EXTENDED_CHAPTER.first : level >= EXTENDED_CHAPTER.first)) continue;
    const geometry = hitappsGeometry(source);
    const key = `${level}:${geometry}`;
    const geometryId = identities.get(key) ?? record.deal.id;
    identities.set(key, geometryId);
    const deal = coreDeal(source);
    const entry = { deal, record, hash, penalty, geometryId, geometry };
    byId.set(deal.id, entry);
    const m1: Deal = { ...deal, id: deal.id + '-m1',
      ...(deal.bonusSlots && { bonusSlots: {
        ...(deal.bonusSlots.foundation && { foundation: { coins: M1.upperSlot } }),
        ...(deal.bonusSlots.tableau && { tableau: { coins: M1.lowerSlot } }),
      } }),
      ...(deal.recovery && { recovery: { ...deal.recovery, restoreBase: M1.restoreBase, restoreIncrement: M1.restoreStep } }),
      ...(deal.extraHelpers && { extraHelpers: { ...deal.extraHelpers, randomJokerCoins: M1.randomJoker, unlimitedCoins: M1.unlimited } }),
    };
    byId.set(m1.id, { ...entry, deal: m1 });
    if (!E4_M1 && stage2Specials.some(row => row.deal.id === record.deal.id)) continue;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(entry);
  }
  return { byId, byLevel };
}

function seededRank(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function previousRotation(entry: Layout, previous: Attempt | undefined): Rotation {
  const stored = previous?.issuance?.policy === campaignCorePolicy && previous.issuance.rotation;
  return stored && stored.level === entry.deal.campaignLevel ? stored : {
    level: entry.deal.campaignLevel!, seed: seededRank(previous?.id ?? 'first'), used: [],
  };
}

export function recordCoreRotation(entry: Layout, previous: Attempt | undefined): Rotation {
  const prior = previousRotation(entry, previous);
  // When a cycle finishes, start a new history from this issuance.
  const used = prior.used.includes(entry.geometryId) ? [] : prior.used.slice(-15);
  return { ...prior, used: [...used, entry.geometryId] };
}

export function selectCampaignCore(bank: ReturnType<typeof bindCampaignCore>, save: Save, base: Deal,
    previous: Attempt | undefined, previousDeal: Deal | undefined): Deal {
  const level = base.campaignLevel!, entries = bank.byLevel.get(level) ?? [];
  const matching = entries.filter(({ deal }) => level <= 15 || level >= EXTENDED_CHAPTER.first ||
    (deal.difficultyTier === base.difficultyTier && sameHitappsMechanics(deal, base)));
  if (!matching.length) throw Error(`No certified Rules4 campaign layout for level ${level}`);
  const rotation = previousRotation(matching[0], previous);
  const currentGeometry = previousDeal?.campaignLevel === level ? hitappsGeometry(previousDeal) : undefined;
  const alternates = matching.filter(entry => entry.geometry !== currentGeometry);
  const distinct = alternates.length ? alternates : matching;
  const unseen = distinct.filter(entry => !rotation.used.includes(entry.geometryId));
  const pool = unseen.length ? unseen : distinct;
  const penalty = level < 11 ? 0 : futureDifficultyPenalty(save);
  const budget = matching[0].deal.initial.movesLeft;
  const easy = previous?.board.phase === 'exhausted' && previousDeal?.campaignLevel === level && budget !== null
    ? easyDealTarget({ level, difficulty: base.difficultyTier ?? 'normal', random: true, stable: true,
      special: Boolean(base.bound || base.frozen || base.lock || base.puzzle || base.starter),
      previousLosses: previous.director?.previousLosses ?? 0,
      dtoMoves: adjustedMoveBudget(budget, penalty, true), dtoPenalty: penalty }, hitappsR4Difficulty.easy)
    : undefined;
  pool.sort((a, b) => {
    const balance = Math.abs(a.penalty - penalty) - Math.abs(b.penalty - penalty);
    if (balance) return balance;
    if (typeof easy === 'number' && Math.min(a.record.cost, b.record.cost) <= easy) {
      const relief = Number(a.record.cost > easy) - Number(b.record.cost > easy) || a.record.cost - b.record.cost;
      if (relief) return relief;
    }
    return seededRank(`${rotation.seed}:${a.geometryId}`) - seededRank(`${rotation.seed}:${b.geometryId}`) ||
      a.geometryId.localeCompare(b.geometryId);
  });
  const selected = pool[0].deal;
  return E4_M1 ? bank.byId.get(selected.id + '-m1')!.deal : selected;
}
