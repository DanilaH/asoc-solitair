import { expect, it } from 'vitest';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { CAMPAIGN_PRODUCTS, CHECKOUT_PRODUCT_INDEX, PRODUCT_INDEX, PRODUCTS } from '../../src/domain/commerce/catalog';
import { claimShopProgress, recordStoreClear, storefrontView } from '../../src/domain/commerce/storefront';
import { freshSave } from '../../src/domain/engine';

it('keeps all 15 source families and 41 catalog concepts with independent actual campaign progress', () => {
  const save = freshSave(content8Wave[0], 'confirmed-clears'), now = Date.UTC(2026, 10, 22);
  const before = save.profile.coins;
  expect(PRODUCTS).toHaveLength(41);
  expect(PRODUCT_INDEX.size).toBe(41);
  for (const product of CAMPAIGN_PRODUCTS) {
    expect(CHECKOUT_PRODUCT_INDEX.get(product.sku)).toBe(product);
    expect(PRODUCT_INDEX.has(product.sku)).toBe(false);
  }
  expect(storefrontView(save, now).offers).toHaveLength(15);
  for (let i = 0; i < 3; i++) recordStoreClear(save, now);
  expect(save.storeProgress).toMatchObject({ piggy: 30, clears: 3 });
  expect(claimShopProgress(save, now, 'premium')).toBe(false);
  expect(claimShopProgress(save, now, 'piggy')).toBe(false);
  expect(claimShopProgress(save, now, 'free')).toBe(true);
  expect(claimShopProgress(save, now, 'free')).toBe(false);
  expect(save.profile.coins).toBe(before + 10);
  expect(storefrontView(save, Date.UTC(2026, 11, 1)).data).toBeUndefined();
});
