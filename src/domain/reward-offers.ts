import { BALANCE } from './balance';
import type { Deal, Save } from './types';

export const REWARD_OFFER_PREVIEW = import.meta.env?.VITE_CONTENT8_REWARD_OFFERS === '1';
const DAY = 86_400_000;
const factors = { 'win-double': 2, 'win-triple': 3, 'win-fivefold': 5, 'win-flat': 1 } as const;
const placements = [...Object.keys(factors), 'shop-free-coins', 'rewarded-theme'];
export type WinOffer = keyof typeof factors;
export type OfferPlacement = WinOffer | 'shop-free-coins' | 'rewarded-theme';

export const offerLabels: Readonly<Record<WinOffer, string>> = {
  'win-double': 'Удвоить награду', 'win-triple': 'Утроить награду',
  'win-fivefold': 'Увеличить награду в 5 раз', 'win-flat': 'Добавить 20 монет',
};
export const isOfferPlacement = (value: string): value is OfferPlacement => placements.includes(value);

interface PendingOffer {
  id: string;
  kind: OfferPlacement;
  dealId: string;
  key: string;
  at: number;
  amount: number;
}
export interface RewardOffers {
  version: 1;
  pending: PendingOffer[];
  settledWins: string[];
  freeAfter: number;
  themeUntil: number;
  definitions: number;
}
const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const winKey = (value: unknown): value is string => typeof value === 'string' && /^win-[1-9]\d*-[1-9]\d*$/.test(value);

export function validRewardOffers(value: RewardOffers): boolean {
  return Boolean(value && value.version === 1 && [value.freeAfter, value.themeUntil, value.definitions].every(natural) &&
    Array.isArray(value.pending) && value.pending.every(offer => offer && token(offer.id) && token(offer.dealId) &&
      isOfferPlacement(offer.kind) && natural(offer.at) && natural(offer.amount) &&
      (offer.kind === 'shop-free-coins' ? offer.key === 'shop' && offer.amount === 30 :
        offer.kind === 'rewarded-theme' ? offer.key === 'theme' && offer.amount === 0 : winKey(offer.key) && offer.amount > 0)) &&
    new Set(value.pending.map(offer => offer.id)).size === value.pending.length &&
    Array.isArray(value.settledWins) && value.settledWins.every(winKey) &&
    new Set(value.settledWins).size === value.settledWins.length);
}

export function rewardOfferState(save: Save): RewardOffers {
  return save.rewardOffers ??= { version: 1, pending: [], settledWins: [], freeAfter: 0, themeUntil: 0, definitions: 1 };
}

export function offerQuote(save: Save, deal: Deal, kind: OfferPlacement, now: number) {
  const state = save.rewardOffers;
  if (!natural(now) || !natural(now + DAY) || save.attempt.daily || !isOfferPlacement(kind) || save.attempt.dealId !== deal.id) return;
  if (kind === 'shop-free-coins') return now >= (state?.freeAfter ?? 0) ? { key: 'shop', amount: 30 } : undefined;
  if (kind === 'rewarded-theme') return now >= (state?.themeUntil ?? 0) ? { key: 'theme', amount: 0 } : undefined;
  const { attempt } = save;
  if (!deal.campaignLevel || attempt.board.phase !== 'won') return;
  const key = `win-${save.balanceVersion}-${deal.campaignLevel}`;
  if (state?.settledWins.includes(key)) return;
  const grant = attempt.payout?.find(entry => entry.reason === 'win' && entry.key === `win:${attempt.id}`);
  if (!grant || !save.profile.rewards.includes(grant.key)) return;

  const base = BALANCE.winCoins + BALANCE.coinsPerRemainingMove * (attempt.board.movesLeft ?? 0);
  // Multipliers apply to the baseline win and remaining moves only.
  if (base !== grant.coins) return;
  const amount = kind === 'win-flat' ? 20 : base * (factors[kind] - 1);
  return natural(amount) && amount > 0 ? { key, amount } : undefined;
}

export function prepareRewardOffer(save: Save, deal: Deal, kind: OfferPlacement, now: number, id: string): PendingOffer | undefined {
  const quote = offerQuote(save, deal, kind, now);
  if (!quote || !token(id)) return;
  const state = rewardOfferState(save);
  const previous = state.pending.find(entry => entry.key === quote.key && entry.kind === kind &&
    entry.dealId === deal.id && entry.amount === quote.amount);
  if (previous) return previous;
  if (state.pending.some(entry => entry.id === id)) return;
  const offer: PendingOffer = { ...quote, at: now, dealId: deal.id, kind, id };
  state.pending.push(offer);
  return offer;
}

export function settleRewardOffer(save: Save, earned: { attempt: string; dealId: string; placement: OfferPlacement; mode: 'campaign'|'daily' }, now: number): boolean {
  const state = save.rewardOffers;
  const offer = state?.pending.find(entry => entry.id === earned.attempt && entry.dealId === earned.dealId && entry.kind === earned.placement);
  if (!state || !offer || earned.mode !== 'campaign' || !natural(now) || !natural(Math.max(offer.at, now) + DAY)) return false;
  if (state.settledWins.includes(offer.key) || (offer.key === 'shop' && offer.at < state.freeAfter) ||
    (offer.key === 'theme' && offer.at < state.themeUntil)) return false;
  if (!natural(save.profile.coins + offer.amount)) return false;
  state.pending = state.pending.filter(entry => entry.key !== offer.key);
  if (offer.key === 'shop') state.freeAfter = Math.max(offer.at, now) + DAY;
  else if (offer.key === 'theme') state.themeUntil = Math.max(offer.at, now) + DAY;
  else state.settledWins.push(offer.key);
  save.profile.coins += offer.amount;
  return true;
}

export function revealRelatedWord(save: Save, deal: Deal, cardId: string): string | undefined {
  if (save.attempt.dealId !== deal.id || save.attempt.board.phase !== 'playing' ||
    !save.attempt.board.faceUp.includes(cardId) || !(save.rewardOffers?.definitions ?? 1)) return;
  const card = deal.cards[cardId];
  if (!card) return;
  const other = Object.values(deal.cards).find(candidate => candidate.category === card.category && candidate.id !== cardId &&
    !candidate.leader && save.attempt.board.faceUp.includes(candidate.id));
  if (!other) return;
  rewardOfferState(save).definitions--;
  return other.text;
}
