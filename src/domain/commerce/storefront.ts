import { activePurchaseGoods } from './orders';
import { PRODUCTS, CHECKOUT_PRODUCT_INDEX, type ProductGood } from './catalog';
import { reviewOffers, type CommercialContext, type OfferFamily } from './offer-policy';
import { OWNER_ACCEPTANCE_PREVIEW } from '../types';
import type { Save } from '../types';

export const STOREFRONT_PREVIEW = import.meta.env?.VITE_C8_OWNER_PREVIEW === 'storefront' || OWNER_ACCEPTANCE_PREVIEW;
const natural = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
export interface StoreProgress {
  version: 1; season: string; clears: number; piggy: number; freeClaimed?: true;
  premiumClaimed?: string; piggyGrant?: string;
}
export const productLabels = {
  'hitapps-piggy-bank': 'Копилка', 'azur-play-pass': 'Пропуск сезона',
  'hitapps-rotating-offers': 'Сменяемые предложения', 'hitapps-birthday-offer': 'День рождения',
  'hitapps-decoy-offer': 'Сравнение наборов', 'hitapps-starter-offer': 'Стартовый набор',
  'hitapps-inapp-shop': 'Магазин', 'azur-offer-campaign': 'Предложения события',
  'unico-vip': 'VIP', 'azur-iap-no-ads': 'Без рекламы', 'azur-iap-coin-packs': 'Монеты',
  'azur-iap-coin-offer-series': 'Серия наборов монет', 'azur-iap-premium-bundles': 'Премиальные наборы',
  'azur-iap-welcome-offer': 'Приветственный набор', 'azur-iap-unlimited-moves-tiers': 'Ходы без лимита',
} satisfies Record<OfferFamily, string>;

export const PIGGY_LIMIT = 30, PASS_GOAL = 3;
function period(now: number) {
  if (!natural(now) || now > 8_640_000_000_000_000) return;
  const date = new Date(now), year = date.getUTCFullYear(), month = date.getUTCMonth();
  if (year < 2000 || year > 9998) return;
  return { id: `${year}-${String(month + 1).padStart(2, '0')}`,
    start: Date.UTC(year, month, 1), end: Date.UTC(year, month + 1, 1) };
}
export function recordStoreClear(save: Save, now: number) {
  const season = period(now);
  if (!season || (save.storeProgress && save.storeProgress.season > season.id)) return false;
  if (save.storeProgress?.season !== season.id) save.storeProgress = { version: 1, season: season.id, clears: 0, piggy: 0 };
  const data = save.storeProgress;
  if (!natural(data.clears + 1)) return false;
  data.clears++;
  if (!data.piggyGrant) data.piggy = Math.min(PIGGY_LIMIT, data.piggy + 10);
  save.revision++;
  return true;
}
export function validStoreProgress(data: StoreProgress) {
  return Boolean(data && data.version === 1 && /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(data.season) &&
    natural(data.clears) && natural(data.piggy) && data.piggy <= PIGGY_LIMIT &&
    (data.freeClaimed === undefined || data.freeClaimed === true) &&
    [data.premiumClaimed, data.piggyGrant].every(id => id === undefined || typeof id === 'string' && id.length <= 300));
}
export function claimShopProgress(save: Save, now: number, track: 'free'|'premium'|'piggy', accountId = '') {
  const season = period(now), data = save.storeProgress;
  if (!season || !data || season.id !== data.season) return false;
  const goods = activePurchaseGoods(save.commerce, accountId, now, season.id);
  if (track === 'piggy') {
    const grant = goods.find(item => item.good.type === 'piggy');
    if (!grant || data.piggy !== PIGGY_LIMIT || data.piggyGrant) return false;
    data.piggyGrant = grant.grantId;
    save.profile.coins += data.piggy;
  } else {
    if (data.clears < PASS_GOAL) return false;
    if (track === 'free') {
      if (data.freeClaimed) return false;
      data.freeClaimed = true; save.profile.coins += 10;
    } else {
      const grant = goods.find(item => item.good.type === 'pass');
      if (!grant || data.premiumClaimed) return false;
      data.premiumClaimed = grant.grantId; save.profile.coins += 30;
    }
  }
  save.revision++;
  return true;
}
export function storefrontView(save: Save, now: number, accountId = '', context?: Partial<Pick<CommercialContext,'firstPlayedAt'|'birthdayOptInWindow'|'scheduledCampaign'|'rotation'>>) {
  const season = period(now);
  const items = activePurchaseGoods(save.commerce, accountId, now, season?.id);
  const owned = new Set(items.map(item => item.sku));
  const data = save.storeProgress?.season === season?.id ? save.storeProgress : undefined;
  return {
    products: PRODUCTS, active: items, season: season?.id, data,
    offers: reviewOffers({ ...context, accountId, now, goods: items, owned: accountId ? owned : undefined, season }),
  };
}

const resourceLabels = { coin: 'монет', hint: 'подсказок', undo: 'отмен', definition: 'объяснений', joker: 'джокеров' };
export function showProductGoods(sku: string) {
  const label = (good: ProductGood) => {
    switch (good.type) {
      case 'charge': return `${good.quantity} ${resourceLabels[good.resource]}`;
      case 'no-ads': return good.placements === 'banner-and-interstitial' ? 'Без баннеров и полноэкранной рекламы' : 'Без полноэкранной рекламы';
      case 'unlimited': return `Ходы без лимита на ${good.durationMs / 60_000} мин`;
      case 'pass': return 'Премиальная дорожка сезона';
      case 'piggy': return 'Выкуп заполненной копилки';
      case 'vip': return `VIP на ${good.durationMs / 86_400_000} дн.`;
    }
  };
  return CHECKOUT_PRODUCT_INDEX.get(sku)?.benefits.map(label).join(' · ') ?? '';
}
