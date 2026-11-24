import { BALANCE } from './balance';
import type { Deal, Save } from './types';

export const REWARD_OFFER_PREVIEW = import.meta.env?.VITE_CONTENT8_REWARD_OFFERS === '1';
const DAY = 86_400_000;
const SHOP_COINS = 30;
const shopDayKey = (key: string) => /^shop-utc-(0|[1-9]\d*)$/.test(key);
const utcDay = (now: number) => Math.floor(now / DAY);
const factors = { 'win-double': 2, 'win-triple': 3, 'win-fivefold': 5, 'win-flat': 1 } as const;
const placements = [...Object.keys(factors), 'shop-free-coins', 'rewarded-theme'];
export type WinOffer = keyof typeof factors;
export type OfferPlacement = WinOffer | 'shop-free-coins' | 'rewarded-theme';

export const offerLabels: Readonly<Record<WinOffer, string>> = {
  'win-double': 'Удвоить награду', 'win-triple': 'Утроить награду',
  'win-fivefold': 'Увеличить награду в 5 раз', 'win-flat': 'Добавить 20 монет',
};
export const isOfferPlacement = (value: string): value is OfferPlacement => placements.includes(value);

interface OfferShowContext {
  id: string;
  attemptId: string;
  dealId: string;
  kind: OfferPlacement;
}
const MAX_SHOW_CONTEXTS = 64;

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
  shows?: OfferShowContext[];
  multiplier?: { version: 1; eligible: number; selected: Partial<Record<string, 'win-triple' | 'win-fivefold'>> };
  shop?: { version: 1; freeDay: number; earnedDay?: number };
  freeAfter: number;
  themeUntil: number;
  definitions: number;
}
const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const winKey = (value: unknown): value is string => typeof value === 'string' && /^win-[1-9]\d*-[1-9]\d*$/.test(value);

export function validRewardOffers(value: RewardOffers): boolean {
  return Boolean(value && value.version === 1 && [value.freeAfter, value.themeUntil, value.definitions].every(natural) &&
    (value.shop === undefined || (value.shop.version === 1 && natural(value.shop.freeDay) &&
      (value.shop.earnedDay === undefined || (natural(value.shop.earnedDay) && value.shop.earnedDay <= value.shop.freeDay)))) &&
    Array.isArray(value.pending) && value.pending.every(offer => offer && token(offer.id) && token(offer.dealId) &&
      isOfferPlacement(offer.kind) && natural(offer.at) && natural(offer.amount) &&
      (offer.kind === 'shop-free-coins' ? (offer.key === 'shop' || shopDayKey(offer.key)) && offer.amount === SHOP_COINS :
        offer.kind === 'rewarded-theme' ? offer.key === 'theme' && offer.amount === 0 : winKey(offer.key) && offer.amount > 0)) &&
    new Set(value.pending.map(offer => offer.id)).size === value.pending.length &&
    (value.shows === undefined || (Array.isArray(value.shows) && value.shows.length <= MAX_SHOW_CONTEXTS &&
      value.shows.every(show => show && [show.id, show.attemptId, show.dealId].every(token) && isOfferPlacement(show.kind)) &&
      new Set(value.shows.map(show => show.id)).size === value.shows.length)) &&
    (value.multiplier === undefined || (value.multiplier.version === 1 && natural(value.multiplier.eligible) &&
      value.multiplier.selected && Object.entries(value.multiplier.selected).every(([key, factor]) =>
        winKey(key) && (factor === 'win-triple' || factor === 'win-fivefold')))) &&
    Array.isArray(value.settledWins) && value.settledWins.every(winKey) &&
    new Set(value.settledWins).size === value.settledWins.length);
}

export function rewardOfferState(save: Save): RewardOffers {
  return save.rewardOffers ??= { version: 1, pending: [], settledWins: [], freeAfter: 0, themeUntil: 0, definitions: 1 };
}

export function canClaimShopCoins(save: Save, deal: Deal, now: number) {
  return natural(now) && !save.attempt.daily && save.attempt.dealId === deal.id &&
    (deal.campaignLevel ?? 0) >= 16 && save.attempt.board.phase === 'playing' &&
    utcDay(now) > (save.rewardOffers?.shop?.freeDay ?? -1);
}
export function claimShopCoins(save: Save, deal: Deal, now: number) {
  if (!canClaimShopCoins(save, deal, now) || !natural(save.profile.coins + SHOP_COINS)) return false;
  const state = rewardOfferState(save);
  state.shop = { ...state.shop, version: 1, freeDay: utcDay(now) };
  save.profile.coins += SHOP_COINS;
  save.revision++;
  return true;
}

export function selectedWinMultiplier(save: Save, deal: Deal): 'win-triple' | 'win-fivefold' | undefined {
  const victory = save.attempt.victory;
  if (!victory || victory.tier < 1 || victory.tier > 3 || !deal.campaignLevel || save.attempt.board.phase !== 'won') return;
  const schedule = save.rewardOffers?.multiplier;
  const selected = schedule?.selected[`win-${victory.balanceVersion}-${deal.campaignLevel}`];
  return selected ?? (((schedule?.eligible ?? 0) + 1) % 3 === 0 ? 'win-fivefold' : 'win-triple');
}

export function offerQuote(save: Save, deal: Deal, kind: OfferPlacement, now: number, componentMultiplier = false) {
  const state = save.rewardOffers;
  if (!natural(now) || !natural(now + DAY) || save.attempt.daily || !isOfferPlacement(kind) || save.attempt.dealId !== deal.id) return;
  if (kind === 'shop-free-coins') {
    if (now < (state?.freeAfter ?? 0)) return;
    if (!componentMultiplier) return { key: 'shop', amount: SHOP_COINS };
    const day = utcDay(now), shop = state?.shop;
    if (shop?.freeDay !== day || shop.earnedDay === day) return;
    return { key: `shop-utc-${day}`, amount: SHOP_COINS };
  }
  if (kind === 'rewarded-theme') return now >= (state?.themeUntil ?? 0) ? { key: 'theme', amount: 0 } : undefined;
  const { attempt } = save;
  if (!deal.campaignLevel || attempt.board.phase !== 'won') return;
  const victory = attempt.victory;
  const key = `win-${componentMultiplier ? victory?.balanceVersion ?? save.balanceVersion : save.balanceVersion}-${deal.campaignLevel}`;
  if (state?.settledWins.includes(key)) return;
  const grant = attempt.payout?.find(entry => entry.reason === 'win' && entry.key === `win:${attempt.id}`);
  if (!grant || !save.profile.rewards.includes(grant.key)) return;

  if (componentMultiplier) {
    if (!victory || victory.rewardKey !== grant.key || victory.tierBase + victory.movesBonus !== grant.coins ||
        kind !== selectedWinMultiplier(save, deal)) return;
    const amount = victory.tierBase * (factors[kind] - 1);
    return natural(amount) && amount > 0 ? { key, amount } : undefined;
  }
  const base = BALANCE.winCoins + BALANCE.coinsPerRemainingMove * (attempt.board.movesLeft ?? 0);
  // Multipliers apply to the baseline win and remaining moves only.
  if (base !== grant.coins) return;
  const amount = kind === 'win-flat' ? 20 : base * (factors[kind] - 1);
  return natural(amount) && amount > 0 ? { key, amount } : undefined;
}

export function prepareRewardOffer(save: Save, deal: Deal, kind: OfferPlacement, now: number, id: string, newRequest = false, componentMultiplier = false): PendingOffer | undefined {
  const quote = offerQuote(save, deal, kind, now, componentMultiplier);
  if (!quote || !token(id)) return;
  const state = rewardOfferState(save);
  const previous = state.pending.find(entry => entry.key === quote.key && entry.kind === kind &&
    entry.dealId === deal.id && entry.amount === quote.amount);
  if (previous && !newRequest) return previous;
  if (state.pending.some(entry => entry.id === id) || state.shows?.some(entry => entry.id === id)) return;
  const offer: PendingOffer = { ...quote, at: now, dealId: deal.id, kind, id };
  state.pending.push(offer);
  if (componentMultiplier && (kind === 'win-triple' || kind === 'win-fivefold')) {
    const schedule = state.multiplier ??= { version: 1, eligible: 0, selected: {} };
    if (!schedule.selected[quote.key]) {
      schedule.eligible++;
      schedule.selected[quote.key] = kind;
    }
  }
  const context = { id, attemptId: save.attempt.id, dealId: deal.id, kind };
  state.shows = [...(state.shows ?? []), context].slice(-MAX_SHOW_CONTEXTS);
  return offer;
}

export function offerShowContext(save: Save, request: {
  attempt: string; dealId: string; placement: string; mode: 'campaign' | 'daily';
}) {
  if (request.mode !== 'campaign') return;
  return save.rewardOffers?.shows?.find(show => show.id === request.attempt &&
    show.dealId === request.dealId && show.kind === request.placement);
}

export function settleRewardOffer(save: Save, earned: { attempt: string; dealId: string; placement: OfferPlacement; mode: 'campaign'|'daily' }, now: number): boolean {
  const state = save.rewardOffers;
  const offer = state?.pending.find(entry => entry.id === earned.attempt && entry.dealId === earned.dealId && entry.kind === earned.placement);
  if (!state || !offer || earned.mode !== 'campaign' || !natural(now) || !natural(Math.max(offer.at, now) + DAY)) return false;
  if (state.settledWins.includes(offer.key) || (offer.key === 'shop' && offer.at < state.freeAfter) ||
    (offer.key === 'theme' && offer.at < state.themeUntil)) return false;
  if (!natural(save.profile.coins + offer.amount)) return false;
  const day = shopDayKey(offer.key) ? Number(offer.key.slice('shop-utc-'.length)) : undefined;
  if (day !== undefined && (!state.shop || day > state.shop.freeDay)) return false;
  state.pending = state.pending.filter(entry => entry.key !== offer.key);
  if (day !== undefined) {
    state.shop!.earnedDay = Math.max(day, state.shop!.earnedDay ?? -1);
    state.freeAfter = Math.max(offer.at, now) + DAY;
  } else if (offer.key === 'shop') state.freeAfter = Math.max(offer.at, now) + DAY;
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
