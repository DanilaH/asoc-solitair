import { expect, it, vi } from 'vitest';
import type { StorageAdapter } from '@danilah/mini-games-kit/platform';
import { introDeal } from '../../src/content/intro';
import { recoveryDeal } from '../../src/content/campaign';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { PRODUCTS } from '../../src/domain/commerce/catalog';
import { expireUnlimited, quotePurchasedUnlimited, usePurchasedUnlimited } from '../../src/domain/campaign-recovery';
import { activePurchaseGoods, PurchaseReconciler, type PurchaseAuthority, type PurchaseQuery,
  type VerifiedPurchase } from '../../src/domain/commerce/orders';
import { SaveStore, decodeSave } from '../../src/platform/storage';

const base = {
  provider: 'verification-fixture', appId: 'solitaire-fixture', storeProductId: 'coins-1',
  price: { currency: 'RUB', minorUnits: 100 }, sku: PRODUCTS[0].sku,
};
const query: PurchaseQuery = { accountId: 'account-a', invoiceId: 'invoice-1', binding: base };
const input = { invoiceId: query.invoiceId, sku: base.sku };
const session = { accountId: query.accountId, bindingFor: (sku: string) => sku === base.sku ? base : undefined };
const proof: VerifiedPurchase = {
  accountId: query.accountId, invoiceId: query.invoiceId, provider: base.provider, appId: base.appId,
  storeProductId: base.storeProductId, price: base.price, status: 'paid', sequence: 10, effectiveAt: 200,
  proofRef: 'verified-event-1', purchaseId: 'purchase-1',
};

function fixture(deal = introDeal) {
  let value: string | null = null;
  const disk: StorageAdapter = { getItem: async () => value, setItem: async (_key, json) => { value = json; }, removeItem: async () => { value = null; } };
  const open = async () => {
    const store = new SaveStore(disk, deal, () => freshSave(deal, 'existing-game'));
    await store.open();
    return store;
  };
  const api = { verify: vi.fn<PurchaseAuthority['verify']>(async () => proof), acknowledge: vi.fn<PurchaseAuthority['acknowledge']>(async () => {}) };
  return { disk, open, api, raw: () => value! };
}

it('applies only an acknowledged timed purchase to the same campaign attempt and restores spent budget on refund', async () => {
  const deal = { ...recoveryDeal, id: 'purchase-recovery-fixture' };
  const fx = fixture(deal), store = await fx.open();
  const product = PRODUCTS.find(item => item.family === 'unlimited_moves_variants')!;
  const binding = { ...base, sku: product.sku, storeProductId: 'timed' };
  const order = { ...proof, storeProductId: binding.storeProductId };
  const purchase = { invoiceId: input.invoiceId, sku: product.sku };
  const app = new PurchaseReconciler(store, fx.api, { ...session, bindingFor: sku => sku === product.sku ? binding : undefined });
  const now = 300, account = session.accountId;
  await store.mutate(save => { save.commerceAccount = account; });
  fx.api.verify.mockResolvedValue(order);
  fx.api.acknowledge.mockRejectedValueOnce(Error('network interrupted'));
  expect(await app.check(purchase)).toBe('recorded');
  expect(quotePurchasedUnlimited(store.state, deal, account, now)).toBeUndefined();
  expect(await app.check(purchase)).toBe('acknowledged');
  expect(quotePurchasedUnlimited(store.state, deal, 'another-account', now)).toBeUndefined();
  const quote = quotePurchasedUnlimited(store.state, deal, account, now)!;
  expect(quote.until).toBe(order.effectiveAt + 20 * 60_000);
  const grant = { ...quote, id: 'verified-order-unlimited' };
  const finiteBudget = store.state.attempt.board.movesLeft!;
  expect(await store.mutate(save => usePurchasedUnlimited(save, deal, { ...grant, attemptId: 'stale' }, account, now))).toBe(false);
  expect(await store.mutate(save => usePurchasedUnlimited(save, deal, grant, account, now))).toBe(true);
  expect(await store.mutate(save => usePurchasedUnlimited(save, deal, grant, account, now))).toBe(false);
  await store.mutate(save => {
    save.attempt.undo.push(structuredClone(save.attempt.board));
    const moved = applyBoard(save.attempt.board, deal.winningPath[0], deal);
    if (typeof moved === 'string') throw Error(moved);
    save.attempt.board = moved.board;
  });
  expect((await fx.open()).state.attempt.board).toMatchObject({ movesLeft: null, retainedMoves: finiteBudget - 1 });
  fx.api.verify.mockResolvedValue({ ...order, sequence: order.sequence + 1, proofRef: 'verified-refund', status: 'refunded' });
  await app.check(purchase);
  expect(await store.mutate(save => expireUnlimited(save, now + 1))).toBe(true);
  const reopened = await fx.open();
  expect(reopened.state.attempt.board.movesLeft).toBe(finiteBudget - 1);
  expect(reopened.state.attempt.undo[0].movesLeft).toBe(finiteBudget);
  expect(reopened.state.attempt.unlimited).toMatchObject({ expired: true, purchaseRef: quote.purchaseRef });
  expect(quotePurchasedUnlimited(reopened.state, deal, account, now + 1)).toBeUndefined();
});

it('writes an exact paid order and a single grant to SaveStore before provider acknowledgement', async () => {
  const fx = fixture(), store = await fx.open();
  expect(store.state.commerce).toBeUndefined();
  const board = structuredClone(store.state.attempt);
  fx.api.acknowledge.mockImplementation(async (order, type) => {
    expect(type).toBe('consumable');
    const durable = JSON.parse(fx.raw()).commerce.orders[0];
    expect(durable.grant.id).toBe(order.grant?.id);
    expect(durable.acknowledged).toBeUndefined();
  });
  const reconciler = new PurchaseReconciler(store, fx.api, session);
  await Promise.all([reconciler.check(input), reconciler.check(input), reconciler.check(input)]);
  expect(fx.api.acknowledge).toHaveBeenCalledTimes(1);
  expect(store.state.commerce?.orders).toHaveLength(1);
  expect(store.state.commerce?.orders[0].acknowledged).toBe(true);
  expect(activePurchaseGoods(store.state.commerce, query.accountId, 200)).toHaveLength(1);
  expect(activePurchaseGoods(store.state.commerce, 'other-account', 200)).toEqual([]);
  expect(store.state.attempt).toEqual(board);
  expect(decodeSave(fx.raw(), introDeal).commerce).toEqual(store.state.commerce);
});

it('makes no grant for pending, forged or mismatched observations and retries service outages', async () => {
  const fx = fixture(), store = await fx.open(), reconciler = new PurchaseReconciler(store, fx.api, session);
  fx.api.verify.mockResolvedValueOnce(undefined);
  expect(await reconciler.check(input)).toBe('ignored');
  for (const data of [{ storeProductId: 'different' }, { appId: 'different-app' }, { accountId: 'other' },
    { price: { currency: 'USD', minorUnits: 1 } }, { invoiceId: 'another-invoice' }, { proofRef: '' }]) {
    fx.api.verify.mockResolvedValueOnce({ ...proof, ...data });
    expect(await reconciler.check(input)).toBe('ignored');
  }
  expect(store.state.commerce).toBeUndefined();
  expect(await reconciler.check({ ...input, sku: PRODUCTS[1].sku })).toBe('ignored');
  fx.api.verify.mockResolvedValueOnce({ ...proof, sequence: 5, status: 'pending' });
  expect(await reconciler.check(input)).toBe('recorded');
  expect(activePurchaseGoods(store.state.commerce, query.accountId, 200)).toEqual([]);
  expect(fx.api.acknowledge).not.toHaveBeenCalled();
  fx.api.verify.mockRejectedValueOnce(Error('provider unavailable'));
  await expect(reconciler.check(input)).rejects.toThrow('provider unavailable');
  expect(await reconciler.check(input)).toBe('acknowledged');
});

it('recovers an unacknowledged grant after reload and never acknowledges an unsaved grant', async () => {
  const fx = fixture(), store = await fx.open();
  const realSet = fx.disk.setItem;
  fx.disk.setItem = async () => { throw Error('offline storage'); };
  await expect(new PurchaseReconciler(store, fx.api, session).check(input)).rejects.toThrow();
  expect(fx.api.acknowledge).not.toHaveBeenCalled();
  expect(store.state.commerce).toBeUndefined();

  fx.disk.setItem = realSet;
  fx.api.acknowledge.mockRejectedValueOnce(Error('provider acknowledgement timed out'));
  expect(await new PurchaseReconciler(store, fx.api, session).check(input)).toBe('recorded');
  const restored = await fx.open();
  expect(activePurchaseGoods(restored.state.commerce, query.accountId, 200)).toHaveLength(1);
  expect(await new PurchaseReconciler(restored, fx.api, session).recover()).toEqual([{ status: 'fulfilled', value: 'acknowledged' }]);
  expect(restored.state.commerce?.orders).toHaveLength(1);
  expect(fx.api.acknowledge).toHaveBeenCalledTimes(2);
});

it('rejects purchase ID replay across invoices and cancels active rights after a verified refund', async () => {
  const fx = fixture(), store = await fx.open(), reconciler = new PurchaseReconciler(store, fx.api, session);
  await reconciler.check(input);
  fx.api.verify.mockResolvedValueOnce({ ...proof, invoiceId: 'duplicate' });
  expect(await reconciler.check({ ...input, invoiceId: 'duplicate' })).toBe('ignored');
  fx.api.verify.mockResolvedValueOnce({ ...proof, sequence: 15, status: 'refunded', proofRef: 'refund-1' });
  expect(await reconciler.check(input)).toBe('recorded');
  expect(activePurchaseGoods(store.state.commerce, query.accountId, 300)).toEqual([]);
  expect(await reconciler.check(input)).toBe('recorded');
  expect(store.state.commerce?.orders[0]).toMatchObject({ status: 'refunded', sequence: 15 });
  expect(fx.api.acknowledge).toHaveBeenCalledTimes(1);
});

it('restores the original term on a new installation and never extends it on replay', async () => {
  const fx = fixture(), store = await fx.open();
  const unlimited = PRODUCTS.find(item => item.family === 'unlimited_moves_variants')!;
  const q = { ...input, sku: unlimited.sku };
  const trusted = { ...base, sku: unlimited.sku, storeProductId: 'timed' };
  const reconciler = new PurchaseReconciler(store, fx.api, { ...session, bindingFor: sku => sku === trusted.sku ? trusted : undefined });
  fx.api.verify.mockResolvedValue({ ...proof, storeProductId: 'timed', effectiveAt: 50 });
  expect(await reconciler.check(q)).toBe('acknowledged');
  const end = 50 + 20 * 60_000;
  expect(activePurchaseGoods(store.state.commerce, session.accountId, end - 1)[0].expiresAt).toBe(end);
  expect(activePurchaseGoods(store.state.commerce, session.accountId, end)).toEqual([]);
  fx.api.verify.mockResolvedValueOnce({ ...proof, storeProductId: 'timed', effectiveAt: 70, sequence: 11 });
  await reconciler.check(q);
  expect(activePurchaseGoods(store.state.commerce, session.accountId, end)).toEqual([]);
});
