export const CATALOG_REVISION = 1;
export const SOURCE_CATALOG = 'docs/qa/content-v8/e3-source-commerce-matrix.json';

const helperFamilies = ['hint', 'undo', 'definition', 'joker'] as const;
export type HelperFamily = typeof helperFamilies[number];
export type CurrencyResource = 'coin' | HelperFamily;

export type ProductGood =
  | { type: 'charge'; resource: CurrencyResource; quantity: number }
  | { type: 'no-ads'; placements: 'interstitial' | 'banner-and-interstitial'; lifetime: true }
  | { type: 'unlimited'; durationMs: number }
  | { type: 'pass'; term: 'season' };

export type ProductFamily = 'coin_packs' | 'coins_offers' | 'hints_offers' | 'undo_offers' |
  'definition_offers' | 'boosters_offers' | 'standalone_noads' | 'welcome_offer' | 'unlimited_moves_variants' |
  'silver_gold_diamond_offers' | 'gold_pass';
export interface ProductDefinition {
  sku: string;
  revision: number;
  family: ProductFamily;
  position: number;
  purchaseType: 'consumable' | 'nonConsumable';
  eligibility: 'repeatable' | 'once-per-account' | 'once-per-season';
  benefits: readonly ProductGood[];
  availability: 'DISABLED_NO_MERCHANT';
  providerProductId: null;
  price: null;
  evidence: typeof SOURCE_CATALOG;
}

const charge = (resource: CurrencyResource, quantity: number): ProductGood => ({ type: 'charge', resource, quantity });
const noAds = (placements: 'interstitial' | 'banner-and-interstitial'): ProductGood => ({ type: 'no-ads', placements, lifetime: true });

function product(family: ProductFamily, name: string, position: number, eligibility: ProductDefinition['eligibility'],
  benefits: readonly ProductGood[]): ProductDefinition {
  return {
    sku: `asoc-${name}-${position}-r${CATALOG_REVISION}`, revision: CATALOG_REVISION, family, position, eligibility,
    purchaseType: eligibility === 'once-per-account' && benefits.some(benefit => benefit.type === 'no-ads') ? 'nonConsumable' : 'consumable',
    benefits, availability: 'DISABLED_NO_MERCHANT', providerProductId: null, price: null, evidence: SOURCE_CATALOG,
  };
}

const helperBuckets: Record<HelperFamily, ProductFamily> = {
  hint: 'hints_offers', undo: 'undo_offers', definition: 'definition_offers', joker: 'boosters_offers',
};

const helperTiers: readonly { count: number; ads: boolean }[] = [
  { count: 2, ads: false }, { count: 5, ads: false }, { count: 12, ads: false },
  { count: 0, ads: true }, { count: 12, ads: true },
];

export const PRODUCTS: readonly ProductDefinition[] = [
  ...[150, 400, 750, 1200, 1800, 2900, 5100, 8500].map((quantity, index) =>
    product('coin_packs', 'coins', index + 1, 'repeatable', [charge('coin', quantity)])),
  ...[250, 700, 1550].map((quantity, index) =>
    product('coins_offers', 'coin-selection', index + 1, 'repeatable', [charge('coin', quantity)])),
  ...helperFamilies.flatMap(family => helperTiers.map(({ count, ads }, index) =>
    product(helperBuckets[family], family, index + 1, ads ? 'once-per-account' : 'repeatable',
      [...(count ? [charge(family, count)] : []), ...(ads ? [noAds('banner-and-interstitial')] : [])]))),
  product('standalone_noads', 'quiet-table', 1, 'once-per-account', [noAds('interstitial')]),
  product('standalone_noads', 'quiet-table', 2, 'once-per-account', [noAds('banner-and-interstitial')]),
  product('welcome_offer', 'first-table', 1, 'once-per-account', [charge('coin', 300), charge('hint', 2), charge('undo', 2)]),
  ...[20, 120, 1440].map((minutes, index) => product('unlimited_moves_variants', 'open-budget', index + 1, 'repeatable',
    [{ type: 'unlimited', durationMs: minutes * 60_000 }])),
  ...[300, 800, 1800].map((quantity, index) =>
    product('silver_gold_diamond_offers', 'table-kit', index + 1, 'once-per-account',
      [noAds('banner-and-interstitial'), charge('coin', quantity), charge('hint', (index + 1) * 3), charge('undo', (index + 1) * 2)])),
  product('gold_pass', 'season-track', 1, 'once-per-season', [{ type: 'pass', term: 'season' }]),
];

export const PRODUCT_INDEX: ReadonlyMap<string, ProductDefinition> = new Map(PRODUCTS.map(item => [item.sku, item]));

export function catalogErrors(items: readonly ProductDefinition[]): string[] {
  const errors: string[] = [], keys = new Set<string>(), slots = new Set<string>();
  const positive = (n: number) => Number.isSafeInteger(n) && n > 0;
  for (const item of items) {
    const slot = `${item.family}:${item.position}`;
    if (keys.has(item.sku) || slots.has(slot)) errors.push(`duplicate:${item.sku}`);
    keys.add(item.sku);
    slots.add(slot);
    if (!/^asoc-[a-z0-9-]+-r[1-9]\d*$/.test(item.sku) || !item.sku.endsWith(`-r${CATALOG_REVISION}`) || !positive(item.position) ||
      item.revision !== CATALOG_REVISION || item.evidence !== SOURCE_CATALOG ||
      item.availability !== 'DISABLED_NO_MERCHANT' || item.providerProductId !== null || item.price !== null) {
      errors.push(`configuration:${item.sku}`);
    }
    const durable = item.benefits.filter(benefit => benefit.type === 'no-ads');
    const passes = item.benefits.filter(benefit => benefit.type === 'pass');
    const malformed = item.benefits.some(benefit => benefit.type === 'charge' ? !positive(benefit.quantity) :
      benefit.type === 'unlimited' ? !positive(benefit.durationMs) : benefit.type === 'pass' ? benefit.term !== 'season' :
        benefit.lifetime !== true || !['interstitial', 'banner-and-interstitial'].includes(benefit.placements));
    const benefitKeys = new Set(item.benefits.map(benefit => benefit.type === 'charge' ? benefit.resource : benefit.type));
    if (!item.benefits.length || benefitKeys.size !== item.benefits.length || malformed || durable.length !== Number(item.purchaseType === 'nonConsumable') ||
      (durable.length > 0 && item.eligibility !== 'once-per-account') ||
      passes.length !== Number(item.eligibility === 'once-per-season')) errors.push(`goods:${item.sku}`);
  }
  return errors;
}
