import { expect, it } from 'vitest';
import { PRODUCTS } from '../../src/domain/commerce/catalog';
import { fillPiggy, noAdsEligibility, reviewOffers, revokeTrialPiggy, trialPassTracks, trialVipActive,
  unlockTrialPiggy, type CommercialContext, type PiggyTrial } from '../../tools/content/commercial-offer-trial';

const context: CommercialContext = { accountId: 'game-user', now: 100, firstPlayedAt: 0, goods: [], owned: new Set() };
const find = (views: ReturnType<typeof reviewOffers>, id: typeof views[number]['sourceId']) => views.find(value => value.sourceId === id)!;

it('covers all commercial families independently and never exposes checkout', () => {
  const views = reviewOffers(context);
  expect(new Set(views.map(view => view.sourceId)).size).toBe(15);
  expect(views.every(view => !view.availableForPayment)).toBe(true);
  expect(find(views, 'hitapps-inapp-shop').products).toHaveLength(41);
  expect(find(views, 'azur-iap-coin-packs').products).toHaveLength(8);
  expect(find(views, 'azur-iap-unlimited-moves-tiers').products).toHaveLength(3);
  expect(find(views, 'hitapps-decoy-offer').products.every(value => value.price === null)).toBe(true);
});

it('has separate expiry, opt-in, event, rotation and welcome rules', () => {
  const event = { id: 'event', start: 50, end: 150 };
  const rotate = { ...event, productSku: PRODUCTS[0].sku };
  const views = reviewOffers({ ...context, scheduledCampaign: event, rotation: rotate, birthdayOptInWindow: { ...event, end: 100 } });
  expect(find(views, 'hitapps-birthday-offer').eligible).toBe(false);
  expect(find(views, 'azur-offer-campaign').eligible).toBe(true);
  expect(find(views, 'hitapps-rotating-offers').products).toEqual([PRODUCTS[0]]);
  expect(find(views, 'hitapps-starter-offer').eligible).toBe(true);
  const late = reviewOffers({ ...context, now: 300_000_000, owned: undefined });
  expect(find(late, 'hitapps-starter-offer').eligible).toBe(false);
  expect(find(late, 'azur-iap-welcome-offer').eligible).toBe(false);
});

it('caps the piggy once per win and retains refund history by exact grant', () => {
  const before: PiggyTrial = { version: 1, accountId: context.accountId, cycle: 'piggy-1', limit: 20, held: 0, wins: [] };
  const partial = fillPiggy(before, 'win1', 14);
  expect(fillPiggy(partial, 'win1', 14)).toBe(partial);
  const held = fillPiggy(partial, 'win2', 14);
  expect(held.held).toBe(20);
  const verified = { accountId: context.accountId, cycle: held.cycle, grantId: 'purchase-grant', amount: 20 };
  expect(unlockTrialPiggy(held, { ...verified, accountId: 'different-player' })).toBe(held);
  const paid = unlockTrialPiggy(held, verified);
  expect(paid.payout?.amount).toBe(20);
  expect(unlockTrialPiggy(paid, verified)).toBe(paid);
  const revoked = revokeTrialPiggy(paid, verified.grantId);
  expect(revoked.payout?.refunded).toBe(true);
  expect(unlockTrialPiggy(revoked, verified)).toBe(revoked);
});

it('keeps pass, VIP, no-ads scopes and voluntary rewarded distinct', () => {
  const season = { id: 'one', start: 0, end: 150 };
  const vip = { accountId: context.accountId, receiptId: 'proof', valid: { ...season, end: 200 } };
  expect(trialPassTracks({ ...context, season })).toEqual({ free: true, premium: false });
  const pass = { grantId: 'pass', sku: 'sku', seasonId: 'one', good: { type: 'pass', term: 'season' } } as const;
  expect(trialPassTracks({ ...context, goods: [pass], season })).toEqual({ free: true, premium: true });
  expect(trialPassTracks({ ...context, goods: [pass], season, now: 150 })).toEqual({ free: false, premium: false });
  expect(trialVipActive(vip, { ...context, now: 150 })).toBe(true);
  expect(trialVipActive({ ...vip, revoked: true }, context)).toBe(false);
  expect(noAdsEligibility([{ grantId: 'ads', sku: 'sku', good: { type: 'no-ads', placements: 'interstitial', lifetime: true } }]))
    .toEqual({ banner: true, interstitial: false, rewarded: true });
  expect(noAdsEligibility([])).toEqual({ banner: true, interstitial: true, rewarded: true });
});
