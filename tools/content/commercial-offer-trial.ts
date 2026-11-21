import { PRODUCTS, type ProductDefinition, type ProductFamily } from '../../src/domain/commerce/catalog';
import type { ActiveGood } from '../../src/domain/commerce/orders';

const natural = (n: number) => Number.isSafeInteger(n) && n >= 0;

interface OfferWindow { id: string; start: number; end: number }
export interface CommercialContext {
  accountId: string;
  now: number;
  firstPlayedAt?: number;
  owned?: ReadonlySet<string>;
  birthdayOptInWindow?: Readonly<OfferWindow>;
  scheduledCampaign?: Readonly<OfferWindow>;
  rotation?: Readonly<OfferWindow & { productSku: string }>;
  season?: Readonly<OfferWindow>;
  goods: readonly ActiveGood[];
}

function inWindow(now: number, range?: OfferWindow): boolean {
  return Boolean(range?.id && natural(range.start) && natural(range.end) && range.start <= now && now < range.end);
}

const sourceFamilies = {
  'hitapps-piggy-bank': undefined,
  'azur-play-pass': ['gold_pass'],
  'hitapps-rotating-offers': ['coin_packs', 'silver_gold_diamond_offers'],
  'hitapps-birthday-offer': ['coins_offers'],
  'hitapps-decoy-offer': ['coin_packs'],
  'hitapps-starter-offer': ['welcome_offer'],
  'hitapps-inapp-shop': undefined,
  'azur-offer-campaign': ['coins_offers'],
  'unico-vip': undefined,
  'azur-iap-no-ads': ['standalone_noads'],
  'azur-iap-coin-packs': ['coin_packs'],
  'azur-iap-coin-offer-series': ['coins_offers'],
  'azur-iap-premium-bundles': ['silver_gold_diamond_offers'],
  'azur-iap-welcome-offer': ['welcome_offer'],
  'azur-iap-unlimited-moves-tiers': ['unlimited_moves_variants'],
} satisfies Record<string, readonly ProductFamily[] | undefined>;

export type OfferFamily = keyof typeof sourceFamilies;

export interface PiggyTrial {
  version: 1;
  accountId: string;
  cycle: string;
  limit: number;
  held: number;
  wins: readonly string[];
  payout?: { grantId: string; amount: number; refunded?: true };
}

export function fillPiggy(state: PiggyTrial, winId: string, amount: number): PiggyTrial {
  if (state.version !== 1 || !winId || !natural(amount) || !amount || !natural(state.limit) || !natural(state.held) ||
    state.payout || state.wins.includes(winId)) return state;
  return { ...state, held: Math.min(state.limit, state.held + amount), wins: [...state.wins, winId] };
}

interface VerifiedTrialPiggy { accountId: string; cycle: string; grantId: string; amount: number }
export function unlockTrialPiggy(state: PiggyTrial, authorization: VerifiedTrialPiggy): PiggyTrial {
  if (state.version !== 1 || state.payout || !state.held || state.held !== state.limit || authorization.amount !== state.held ||
    authorization.accountId !== state.accountId || authorization.cycle !== state.cycle || !authorization.grantId) return state;
  return { ...state, payout: { grantId: authorization.grantId, amount: state.held } };
}

export function revokeTrialPiggy(state: PiggyTrial, grantId: string): PiggyTrial {
  return !state.payout || state.payout.grantId !== grantId || state.payout.refunded
    ? state : { ...state, payout: { ...state.payout, refunded: true } };
}

export interface VipTrial {
  accountId: string;
  receiptId: string;
  valid: OfferWindow;
  revoked?: true;
}
export function trialVipActive(vip: VipTrial | undefined, context: CommercialContext): boolean {
  return Boolean(vip?.accountId === context.accountId && vip.receiptId && !vip.revoked && inWindow(context.now, vip.valid));
}

export function noAdsEligibility(goods: readonly ActiveGood[]) {
  const scopes = goods.flatMap(entry => entry.good.type === 'no-ads' ? [entry.good.placements] : []);
  return { banner: !scopes.includes('banner-and-interstitial'), interstitial: scopes.length === 0, rewarded: true };
}

export function trialPassTracks(context: CommercialContext) {
  if (!inWindow(context.now, context.season)) return { free: false, premium: false };
  return { free: true, premium: context.goods.some(entry => entry.good.type === 'pass' && entry.seasonId === context.season!.id) };
}

export function reviewOffers(context: CommercialContext, piggy?: PiggyTrial, vip?: VipTrial) {
  const { now, owned, firstPlayedAt } = context;
  const firstVisit = firstPlayedAt !== undefined && natural(firstPlayedAt) && firstPlayedAt <= now &&
    now - firstPlayedAt < 72 * 60 * 60_000;
  const catalogue = (id: OfferFamily): ProductDefinition[] => {
    const families: readonly ProductFamily[] | undefined = sourceFamilies[id];
    return PRODUCTS.filter(item => families?.includes(item.family));
  };
  const selection = (id: OfferFamily) => catalogue(id).sort((a, b) => a.position - b.position);
  const welcome = selection('azur-iap-welcome-offer');
  const welcomeEligible = owned !== undefined && welcome.every(item => !owned.has(item.sku));
  const rotating = selection('hitapps-rotating-offers').filter(item => item.sku === context.rotation?.productSku);
  const coinSeries = selection('azur-iap-coin-offer-series');
  const firstOffer = owned === undefined ? [] : coinSeries.filter(item => !owned.has(item.sku)).slice(0, 1);
  const comparison = selection('hitapps-decoy-offer').slice(0, 2);
  const data: Record<OfferFamily, { eligible: boolean; products: readonly ProductDefinition[]; term?: string }> = {
    'hitapps-piggy-bank': { eligible: Boolean(piggy?.accountId === context.accountId && piggy.held > 0 && piggy.held === piggy.limit && !piggy.payout), products: [] },
    'azur-play-pass': { eligible: trialPassTracks(context).free, products: selection('azur-play-pass'), term: context.season?.id },
    'hitapps-rotating-offers': { eligible: inWindow(now, context.rotation) && rotating.length === 1, products: rotating },
    'hitapps-birthday-offer': { eligible: inWindow(now, context.birthdayOptInWindow), products: coinSeries.slice(0, 1) },
    'hitapps-decoy-offer': { eligible: comparison.length === 2, products: comparison },
    'hitapps-starter-offer': { eligible: Boolean(firstVisit && welcomeEligible), products: welcome },
    'hitapps-inapp-shop': { eligible: true, products: PRODUCTS },
    'azur-offer-campaign': { eligible: inWindow(now, context.scheduledCampaign), products: coinSeries, term: context.scheduledCampaign?.id },
    'unico-vip': { eligible: trialVipActive(vip, context), products: [], term: vip?.valid.id },
    'azur-iap-no-ads': { eligible: true, products: selection('azur-iap-no-ads') },
    'azur-iap-coin-packs': { eligible: true, products: selection('azur-iap-coin-packs') },
    'azur-iap-coin-offer-series': { eligible: firstOffer.length === 1, products: firstOffer },
    'azur-iap-premium-bundles': { eligible: true, products: selection('azur-iap-premium-bundles') },
    'azur-iap-welcome-offer': { eligible: welcomeEligible, products: welcome },
    'azur-iap-unlimited-moves-tiers': { eligible: true, products: selection('azur-iap-unlimited-moves-tiers') },
  };
  return (Object.entries(data) as [OfferFamily, typeof data[OfferFamily]][])
    .map(([sourceId, item]) => ({ sourceId, ...item, availableForPayment: false as const }));
}
