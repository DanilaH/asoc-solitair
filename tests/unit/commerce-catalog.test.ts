import { expect, it } from 'vitest';
import source from '../../docs/qa/content-v8/e3-source-commerce-matrix.json' with { type: 'json' };
import { catalogErrors, PRODUCTS, PRODUCT_INDEX, type ProductDefinition } from '../../src/domain/commerce/catalog';

it('maps every documented family and purchase type to unique own SKU and disabled availability', () => {
  const bucketCounts = Object.fromEntries(Object.keys(source.catalogAggregate.buckets).map(family =>
    [family, PRODUCTS.filter(item => item.family === family).length]));
  expect(bucketCounts).toEqual(source.catalogAggregate.buckets);
  expect(PRODUCT_INDEX.size).toBe(source.catalogAggregate.productsTotal);
  expect(PRODUCTS.filter(item => item.purchaseType === 'consumable')).toHaveLength(28);
  expect(PRODUCTS.filter(item => item.purchaseType === 'nonConsumable')).toHaveLength(13);
  expect(PRODUCTS.every(item => item.availability === 'DISABLED_NO_MERCHANT' && !item.price && !item.providerProductId)).toBe(true);
  expect(catalogErrors(PRODUCTS)).toEqual([]);
});

it('retains the four independent ladders, two no-ads scopes and three genuine unlimited terms', () => {
  for (const family of ['hints_offers', 'undo_offers', 'definition_offers', 'boosters_offers']) {
    const items = PRODUCTS.filter(item => item.family === family);
    expect(items.map(item => item.benefits.some(item => item.type === 'no-ads'))).toEqual([false, false, false, true, true]);
    expect(items.map(item => item.benefits.some(item => item.type === 'charge'))).toEqual([true, true, true, false, true]);
  }
  const noAds = PRODUCTS.filter(item => item.family === 'standalone_noads');
  expect(noAds.map(item => item.benefits)).toEqual([
    [{ type: 'no-ads', lifetime: true, placements: 'interstitial' }],
    [{ type: 'no-ads', lifetime: true, placements: 'banner-and-interstitial' }],
  ]);
  const unlimited = PRODUCTS.filter(item => item.family === 'unlimited_moves_variants');
  expect(unlimited.map(item => item.benefits)).toEqual([20, 120, 1440].map(minutes => [{ type: 'unlimited', durationMs: 60_000 * minutes }]));
  expect(PRODUCTS.find(item => item.family === 'gold_pass')).toMatchObject({ purchaseType: 'consumable', eligibility: 'once-per-season' });
});

it('rejects duplicate positions, fake store prices and inconsistent grants', () => {
  const item = PRODUCTS[0];
  expect(catalogErrors([item, { ...item, sku: 'asoc-duplicate-r1' }])).toContain('duplicate:asoc-duplicate-r1');
  const bad = { ...item, price: { currency: 'RUB', minorUnits: 100 }, providerProductId: 'fake-shop' } as unknown as ProductDefinition;
  expect(catalogErrors([bad])).toContain(`configuration:${item.sku}`);
  expect(catalogErrors([{ ...item, benefits: [{ type: 'charge', resource: 'coin', quantity: -1 }] }])).toContain(`goods:${item.sku}`);
  const ads = PRODUCTS.find(value => value.family === 'standalone_noads')!;
  expect(catalogErrors([{ ...ads, purchaseType: 'consumable' }])).toContain(`goods:${ads.sku}`);
});
