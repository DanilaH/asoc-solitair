import { expect, it } from 'vitest';
import { introDeal } from '../../src/content/intro';
import { freshSave } from '../../src/domain/engine';
import { PRODUCTS } from '../../src/domain/commerce/catalog';
import { PurchaseReconciler, type PurchaseQuery, type VerifiedPurchase } from '../../src/domain/commerce/orders';
import { startWelcomeWait, welcomePurchaseUi } from '../../src/domain/commerce/welcome-purchase-ui';
import { builtinWelcome, withBuiltinWelcome, createOfferCampaignDispatcher, OfferTrigger, type OfferCampaignDefinition, type OfferEvent } from '../../src/domain/commerce/offer-campaigns';
import { SaveStore } from '../../src/platform/storage';

const accountId = 'fixture-offers';
const sku = PRODUCTS.find(product => product.family === 'welcome_offer')!.sku;
const event = (id: string, at = 1000): OfferEvent => ({ id, at, accountId, level: 31, installedAt: 0, session: 2, trigger: 0 });
const definition = (campaignId: string, priority = 3, windowId = 'welcome_offer'): OfferCampaignDefinition => ({
  version: 1, campaignId, revision: 'test-v1', enabled: true, priority, windowId, skus: [sku],
  lifetimeSeconds: 1, activationCooldownSeconds: 0, repeatShowCooldownSeconds: 0,
  maxTotalShows: 0, maxActivations: 0, maxShowsPerActivation: 0,
  minLevel: 0, maxLevel: 0, minSession: 0, minInstallAgeSeconds: 0,
  activationTriggers: [0, 1, 2, 3, 4, 5, 6, 7], displayTriggers: [0, 1, 2, 3, 4, 5, 6, 7], provenance: 'PRODUCT_ADAPTED',
});
async function fixture() {
  let raw: string | null = null;
  let fail: false | 'before' | 'after' = false;
  const adapter = {
    async getItem() { return raw; },
    async setItem(_key: string, payload: string) { if (fail === 'before') throw Error('write interrupted');
      raw = payload;
      if (fail === 'after') throw Error('write acknowledged ambiguously'); },
    async removeItem() { raw = null; },
  };
  const reopen = async () => {
    const store = new SaveStore(adapter, introDeal, () => freshSave(introDeal, 'campaign-offers-test'));
    await store.open();
    return store;
  };
  return { reopen, fail(value: false | 'before' | 'after') { fail = value; }, serialized() { return JSON.parse(raw!); }, store: await reopen() };
}

it('keeps Welcome limits and separate activation/display gates across expiry, concurrent duplicate and restart', async () => {
  const fx = await fixture();
  const welcome = builtinWelcome(definition('welcome'));
  expect(welcome).toMatchObject({ priority: 5000, maxTotalShows: 2, maxActivations: 2,
    activationCooldownSeconds: 0, repeatShowCooldownSeconds: 0, activationTriggers: [5, 0], displayTriggers: [5, 0] });
  expect(withBuiltinWelcome([definition('welcome')], { ...definition('welcome'), enabled: false })[0].priority).toBe(3);
  expect(withBuiltinWelcome([definition('welcome')], definition('welcome'))).toEqual([welcome]);
  let reveals = 0;
  const config = { enabled: true, definitions: [welcome], presenters: { named: {
    welcome_offer: () => ({ reveal: () => {
      reveals++;
      expect(fx.serialized().offerCampaigns.accounts[0].campaigns[0].shows).toBe(reveals);
    } }),
  } } };
  const dispatcher = createOfferCampaignDispatcher(fx.store, config);
  expect((await createOfferCampaignDispatcher(fx.store, { ...config, enabled: false })(event('off'))).status).toBe('unavailable');
  expect(fx.store.state.offerCampaigns).toBeUndefined();
  const responses = await Promise.all([dispatcher(event('boot')), dispatcher(event('boot'))]);
  expect(responses.map(x => x.status)).toEqual(['presenter-accepted', 'duplicate']);
  expect(reveals).toBe(1);
  const resumed = await fx.reopen();
  const receive = createOfferCampaignDispatcher(resumed, config);
  expect((await receive({ ...event('failed', 2500), trigger: 3 })).status).toBe('no-presentation');
  expect((await receive({ ...event('coins', 2600), trigger: 5 })).status).toBe('presenter-accepted');
  expect((await receive(event('third', 4000))).status).toBe('no-presentation');
  expect((await receive(event('rollback', 3000))).status).toBe('clock-rollback');
  expect(resumed.state.offerCampaigns?.accounts[0].campaigns[0]).toMatchObject({ shows: 2, activations: 2 });
  expect(resumed.state.profile).toEqual(freshSave(introDeal, 'x').profile);
});

it('sorts ordinal ties, tests case-sensitive fallback and applies zero quota on declines or failed writes', async () => {
  const fx = await fixture();
  const log: string[] = [];
  const definitions = [definition('b'), definition('A', 3, 'WELCOME_OFFER'), definition('а', 5, 'boosters_hint_offer')];
  const dispatch = createOfferCampaignDispatcher(fx.store, { enabled: true, definitions, presenters: {
    named: {
      welcome_offer: () => ({ reveal: () => { log.push('reveal'); } }),
      boosters_hint_offer: () => { log.push('named-hint'); return false; },
    },
    fallback: d => { log.push('fallback-' + d.campaignId); return false; },
  } });
  fx.fail('before');
  await expect(dispatch(event('same', 1200))).rejects.toThrow();
  expect(log).toEqual(['named-hint', 'fallback-а', 'fallback-A']);
  expect(fx.store.state.offerCampaigns).toBeUndefined();
  fx.fail('after');
  expect(await dispatch(event('same', 1200))).toMatchObject({ campaignId: 'b', attempted: ['а', 'A', 'b'] });
  expect(log.at(-1)).toBe('reveal');
  expect(fx.store.state.offerCampaigns?.accounts[0].campaigns.map(c => c.campaignId)).toEqual(['b']);
  const noFallback = createOfferCampaignDispatcher(fx.store, { enabled: true,
    definitions: [definition('unknown', 3, 'Welcome_offer')], presenters: { named: {} } });
  expect((await noFallback(event('unknown', 1200))).status).toBe('no-presentation');
  expect(fx.store.state.offerCampaigns?.accounts[0].campaigns).toHaveLength(1);
});

it('evaluates all eight triggers without merging no-moves, failure, completion or booster provenance', async () => {
  const fx = await fixture();
  const completed = { ...definition('finished'), minLevel: 28, maxLevel: 28, activationTriggers: [2] as const, displayTriggers: [2] as const };
  const dispatch = createOfferCampaignDispatcher(fx.store, { enabled: true, definitions: [completed],
    presenters: { named: { welcome_offer: () => ({ reveal() {} }) } } });
  const E = OfferTrigger;
  const triggers: OfferEvent[] = [
    { trigger: E.SessionStarted }, { trigger: E.LevelStarted }, { trigger: E.LevelCompleted, completedLevel: 28 },
    { trigger: E.LevelFailed }, { trigger: E.NoValidMoves, movesRemaining: 3 }, { trigger: E.OutOfCoins },
    { trigger: E.OutOfBooster, booster: 'definition' }, { trigger: E.Manual },
  ].map((extra, index) => ({ ...event('trigger-' + index), ...extra } as OfferEvent));
  const results = await Promise.all(triggers.map(dispatch));
  expect(results.map(r => r.status)).toEqual([0,1,2,3,4,5,6,7].map(n => n === 2 ? 'presenter-accepted' : 'no-presentation'));
  expect((await dispatch({ ...event('no-budget'), trigger: E.NoValidMoves, movesRemaining: 0 })).status).toBe('unavailable');
  expect((await dispatch({ ...event('hint'), trigger: E.OutOfBooster, booster: 'hint' })).status).toBe('no-presentation');
  const saved = (await fx.reopen()).state.offerCampaigns?.accounts[0].events;
  expect(saved?.[2]).toMatchObject({ level: 28, trigger: 2 });
  expect(saved?.[4]).toMatchObject({ movesRemaining: 3 });
  expect(saved?.[6]).toMatchObject({ booster: 'definition' });
  expect(saved?.at(-1)).toMatchObject({ booster: 'hint' });
});

it('honors separate repeat/concurrent activation caps, dates, install age and session count', async () => {
  const { store } = await fixture();
  const limited = { ...definition('limited'), activationTriggers: [1] as const, displayTriggers: [0, 1] as const,
    startsAt: 3000, endsAt: 18000, minLevel: 30, maxLevel: 32, minSession: 2, minInstallAgeSeconds: 3,
    lifetimeSeconds: 4, activationCooldownSeconds: 2, repeatShowCooldownSeconds: 1, maxShowsPerActivation: 2, maxActivations: 2 };
  const dispatch = createOfferCampaignDispatcher(store, { enabled: true, definitions: [limited],
    presenters: { named: { welcome_offer: () => ({ reveal() {} }) } } });
  for (const e of [
    { ...event('early', 2000), trigger: 1 as const },
    { ...event('session', 3000), session: 1, trigger: 1 as const },
    { ...event('age', 3000), installedAt: 1000, trigger: 1 as const },
    event('display-only', 3000),
  ]) expect((await dispatch(e)).status).toBe('no-presentation');
  expect((await dispatch({ ...event('open', 3000), trigger: 1 })).status).toBe('presenter-accepted');
  expect((await dispatch(event('too-soon', 3200))).status).toBe('no-presentation');
  expect((await dispatch(event('repeat', 4000))).status).toBe('presenter-accepted');
  expect((await dispatch(event('local-cap', 5000))).status).toBe('no-presentation');
  expect((await dispatch({ ...event('cooldown', 8000), trigger: 1 })).status).toBe('no-presentation');
  expect((await dispatch({ ...event('second', 9000), trigger: 1 })).status).toBe('presenter-accepted');
  expect((await dispatch({ ...event('cap', 15000), trigger: 1 })).status).toBe('no-presentation');
  expect((await dispatch({ ...event('expired', 18000), trigger: 1 })).status).toBe('no-presentation');
});

it('uses P23 verified receipts for purchase UI and suppression, including late success and refund', async () => {
  const { store, reopen } = await fixture();
  const binding = { sku, provider: 'proof-provider', appId: 'fixture-app', storeProductId: 'welcome-native',
    price: { currency: 'RUB', minorUnits: 500 } };
  const query: PurchaseQuery = { accountId, invoiceId: 'invoice-offer', binding };
  const pending = startWelcomeWait(query, 1000, 1);
  expect(pending.deadline).toBe(6000);
  expect(welcomePurchaseUi(pending, 5999).status).toBe('pending');
  const timedOut = welcomePurchaseUi(pending, 6000);
  expect(timedOut.status).toBe('timed-out');
  const { sku: _sku, ...payment } = binding;
  let observation: VerifiedPurchase = { ...payment, accountId, invoiceId: query.invoiceId, purchaseId: 'purchase-proof',
    status: 'paid', sequence: 1, effectiveAt: 7000, proofRef: 'paid-proof' };
  const reconciler = new PurchaseReconciler(store, { verify: async () => observation, acknowledge: async () => {} },
    { accountId, bindingFor: requested => requested === sku ? binding : undefined });
  const dispatch = createOfferCampaignDispatcher(store, { enabled: true, definitions: [definition('paid-reaction')],
    presenters: { named: { welcome_offer: () => ({ reveal() {} }) } } });
  expect((await dispatch(event('before', 6800))).status).toBe('presenter-accepted');
  expect(welcomePurchaseUi(timedOut, 7000, store.state.commerce).status).toBe('timed-out');
  await reconciler.check({ sku, invoiceId: query.invoiceId });
  await reconciler.check({ sku, invoiceId: query.invoiceId });
  expect(store.state.commerce?.orders).toHaveLength(1);
  const restoredWait = JSON.parse(JSON.stringify(timedOut));
  expect(welcomePurchaseUi(restoredWait, 7000, (await reopen()).state.commerce, true).status).toBe('restored');
  expect(welcomePurchaseUi(restoredWait, 7000, store.state.commerce).status).toBe('paid');
  const unrelated = startWelcomeWait({ ...query, binding: { ...binding, provider: 'other' } }, 6990, 9);
  expect(welcomePurchaseUi(unrelated, 7000, store.state.commerce).status).toBe('pending');
  expect((await dispatch(event('suppressed', 7000))).status).toBe('no-presentation');
  expect(store.state.offerCampaigns?.accounts[0].campaigns[0].active).toBeUndefined();
  observation = { ...observation, status: 'refunded', sequence: 2, effectiveAt: 7200, proofRef: 'refund-proof' };
  await reconciler.check({ sku, invoiceId: query.invoiceId });
  expect(welcomePurchaseUi(timedOut, 7200, store.state.commerce).status).toBe('revoked');
  expect((await dispatch(event('revoked', 7200))).status).toBe('presenter-accepted');
  const other = { ...query, invoiceId: 'invoice-declined' };
  observation = { ...payment, accountId, invoiceId: other.invoiceId, status: 'cancelled',
    sequence: 1, effectiveAt: 7200, proofRef: 'declined-proof' };
  await reconciler.check({ sku, invoiceId: other.invoiceId });
  expect(welcomePurchaseUi(startWelcomeWait(other, 7000, 5), 7200, store.state.commerce).status).toBe('failed');
  expect(store.state.profile).toEqual(freshSave(introDeal, 'x').profile);
});
