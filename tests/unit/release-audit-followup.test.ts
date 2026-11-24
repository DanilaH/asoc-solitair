import { expect, it } from 'vitest';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { dailyForDay } from '../../src/content/daily';
import { switchMode } from '../../src/domain/sessions';
import { recoveryDeal } from '../../src/content/campaign';
import { buyUnlimitedAccess, expireUnlimited, beginUnlimited, unlimitedRemaining, grantUnlimitedAccess, useUnlimitedAccess } from '../../src/domain/campaign-recovery';
import { createProductOfferAdapter, noUsefulMoveFact, startOfferSession } from '../../src/domain/commerce/product-offers';
import { OfferTrigger } from '../../src/domain/commerce/offer-campaigns';
import { dispatch, freshSave } from '../../src/domain/engine';
import { decodeSave } from '../../src/platform/storage';
import { campaignId } from '../../src/domain/progression';

it('maps a real local shortage without an account, with durable reservation and no grant on dispatch', async () => {
  const deal = content8Wave[0];
  let save = freshSave(deal, 'missing-coins');
  save.profile.coins = 0;
  startOfferSession(save, 1000);
  const adapter = createProductOfferAdapter({ async mutate<T>(cb: (draft: typeof save) => T) {
    const draft = structuredClone(save);
    const result = cb(draft);
    save = JSON.parse(JSON.stringify(draft));
    return result;
  } });
  const profile = structuredClone(save.profile);
  const fact = { trigger: OfferTrigger.OutOfCoins, key: 'short-hint-0', resource: 'hint' } as const;
  const accepted = await adapter(save, deal, fact, 1020);
  expect(accepted).toMatchObject({ status: 'presenter-accepted', campaignId: 'c8-local-resources' });
  expect(save.productOffers?.reservation).toMatchObject({ attemptId: 'missing-coins', surface: 'resources', resource: 'hint' });
  expect(await adapter(save, deal, fact, 1021)).toMatchObject({ status: 'duplicate' });
  expect(save.profile).toEqual(profile);
  expect(save.commerceAccount).toBeUndefined();
  const actions = save.productOffers?.reservation;
  save.profile.coins = 200;
  expect(await adapter(save, deal, { ...fact, key: 'stale-shortage' }, 1022)).toMatchObject({ status: 'no-presentation' });
  expect(save.productOffers?.reservation).toEqual(actions);
  expect(noUsefulMoveFact(save, deal, () => true)).toBeUndefined();
  expect(noUsefulMoveFact(save, deal, () => false)).toMatchObject({ trigger: OfferTrigger.NoValidMoves });
  save.attempt.board.phase = 'exhausted';
  expect(noUsefulMoveFact(save, deal, () => false)).toBeUndefined();
});

it.each(['active', 'parked'] as const)('expires timed %s access on monotonic time through rollback and reload, restoring Undo budgets', mode => {
  const deal = { ...recoveryDeal, id: 'regression-recovery-clock' };
  let save = freshSave(deal, 'timed-clock');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: 15 }, (_, i) => campaignId(i + 1)) };
  const initial = save.attempt.board.movesLeft!;
  expect(beginUnlimited(save, deal, { id: 'clock-1', attemptId: save.attempt.id, until: 16_000 }, 10_000)).toBe(true);
  expireUnlimited(save, 10_000, { timeline: 'android-17', elapsed: 100 });
  const before = structuredClone(save.attempt.board);
  const move = dispatch(save, { type: 'draw' }, deal);
  expect(move.accepted).toBe(true);
  save = move.next;
  expect(save.attempt.undo[0]).toEqual(before);
  const campaign = save.attempt;
  const daily = dailyForDay('2026-11-24');
  if (mode === 'parked') switchMode(save, 'daily', daily, 'daily-attempt');
  const resolve = (id: string) => id === deal.id ? deal : id === daily.id ? daily : undefined;
  save = decodeSave(JSON.stringify(save), resolve);
  expect(unlimitedRemaining(campaign.unlimited!, 9000, { timeline: 'android-17', elapsed: 4200 })).toBe(1900);
  expect(expireUnlimited(save, 9000, { timeline: 'android-17', elapsed: 6100 })).toBe(true);
  const recovered = mode === 'active' ? save.attempt : save.parked!.campaign!;
  expect(recovered.unlimited?.expired).toBe(true);
  expect(recovered.board.movesLeft).toBe(initial - 1);
  expect(recovered.undo[0].movesLeft).toBe(initial);
  expect(expireUnlimited(save, 8000, { timeline: 'android-17', elapsed: 8000 })).toBe(false);
  save = decodeSave(JSON.stringify(save), resolve);
  if (mode === 'parked') switchMode(save, 'campaign', deal, 'switch-back');
  expect(save.attempt).toEqual(recovered);
  expect(dispatch(save, { type: 'undo' }, deal).next.attempt.board.movesLeft).toBe(initial);
});

it('leaves a historical indefinite right in place and handles a changed Android boot conservatively', () => {
  const deal = { ...recoveryDeal, id: 'regression-recovery-boot', extraHelpers: { version: 1 as const, unlimitedCoins: 120, unlimitedMs: 60_000 } };
  const save = freshSave(deal, 'historical');
  save.profile.coins = 120;
  expect(buyUnlimitedAccess(save, deal, 'from-coins', 100)).toBe(true);
  expireUnlimited(save, 100, { timeline: 'android-1', elapsed: 1000 });
  expect(expireUnlimited(save, 120, { timeline: 'android-2', elapsed: 10 })).toBe(true);
  const legacy = freshSave(deal, 'indefinite');
  expect(beginUnlimited(legacy, deal, { id: 'old-right', attemptId: legacy.attempt.id }, 100)).toBe(true);
  expect(expireUnlimited(legacy, 120, { timeline: 'android-2', elapsed: 10 })).toBe(false);
  expect(legacy.attempt.board.movesLeft).toBeNull();
});

it('uses the time left on an unspent earned right without starting a new timer', () => {
  const save = freshSave(recoveryDeal, 'earned-clock');
  expect(grantUnlimitedAccess(save, recoveryDeal, { version: 1, id: 'earned', attemptId: save.attempt.id,
    source: 'rewarded', issuedAt: 10_000, until: 16_000 })).toBe(true);
  expireUnlimited(save, 10_000, { timeline: 'android-17', elapsed: 100 });
  const reloaded = decodeSave(JSON.stringify(save), recoveryDeal);
  expect(useUnlimitedAccess(reloaded, recoveryDeal, 'earned', 9_000, { timeline: 'android-17', elapsed: 4100 })).toBe(true);
  expect(unlimitedRemaining(reloaded.attempt.unlimited!, 9_000, { timeline: 'android-17', elapsed: 4100 })).toBe(2000);
  expect(expireUnlimited(save, 9000, { timeline: 'android-17', elapsed: 6100 })).toBe(true);
  expect(save.attempt.unlimitedAccess?.expired).toBe(true);
});
