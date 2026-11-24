import { afterEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ enabled: true, read: vi.fn<() => Promise<{ boot: number; elapsed: number }>>() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.enabled },
  registerPlugin: () => ({ readRecoveryClock: native.read }),
}));
import { createRecoveryClock } from '../../src/platform/recovery-clock';
import { findDeal, recoveryDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { beginUnlimited, buyUnlimitedAccess, expireUnlimited, grantUnlimitedAccess, requiresNativeRecoveryClock, unlimitedRemaining, useUnlimitedAccess } from '../../src/domain/campaign-recovery';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { switchMode } from '../../src/domain/sessions';
import { decodeSave, SaveStore } from '../../src/platform/storage';

const deal = { ...recoveryDeal, id: 'mvp-clock-regression', extraHelpers: { version: 1 as const, unlimitedCoins: 120, unlimitedMs: 60_000 } };
const page = { timeline: 'page-11111111-1111-1111-1111-111111111111', elapsed: 1000 };
function fresh() {
  const save = freshSave(deal, 'clock-owner');
  save.profile.coins = 300;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: 15 }, (_, i) => campaignId(i + 1)) };
  return save;
}

/** Same persisted open -> native refresh -> expiry mutation as app startup, without a UI substitute. */
async function restartWithClock(save: ReturnType<typeof fresh>, now: number) {
  let raw: string | null = JSON.stringify(save);
  const store = new SaveStore({
    getItem: async () => raw,
    setItem: async (_key, value) => { raw = value; },
    removeItem: async () => { raw = null; },
  }, id => id === deal.id ? deal : findDeal(id), fresh);
  const clock = createRecoveryClock();
  await store.open();
  await clock.refresh();
  await store.mutate(next => expireUnlimited(next, now, clock.read()));
  return { store, clock };
}
afterEach(() => { vi.restoreAllMocks(); native.read.mockReset(); native.enabled = true; });

it('requires a successful fresh native acquisition before a timed debit, including after a cached sample', async () => {
  let elapsed = 10;
  vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
  native.read.mockRejectedValueOnce(Error('bridge unavailable'));
  const clock = createRecoveryClock(), save = fresh(), before = structuredClone(save);
  expect(await clock.acquire()).toBeUndefined();
  expect(clock.read()).toMatchObject({ native: true });
  expect(buyUnlimitedAccess(save, deal, 'unsafe-acquire', 100_000, clock.read())).toBe(false);
  expect(save).toEqual(before);
  native.read.mockResolvedValueOnce({ boot: 7, elapsed: 50_000 });
  const ready = await clock.acquire();
  expect(ready).toEqual({ timeline: 'android-7', elapsed: 50_000, native: true });
  expect(buyUnlimitedAccess(save, deal, 'durable-acquire', 100_000, ready)).toBe(true);
  expect(save.profile.coins).toBe(180);
  expect(save.attempt.unlimited?.clock).toEqual({ timeline: 'android-7', elapsed: 50_000, wall: 100_000 });
  elapsed += 61_000;
  native.read.mockRejectedValueOnce(Error('bridge unavailable again'));
  expect(await clock.acquire()).toBeUndefined();
  // A failed refresh does not suspend a right already running on the same boot.
  expect(expireUnlimited(save, 100_001, clock.read())).toBe(true);
  expect(save.attempt.unlimited?.expired).toBe(true);
});

it('rejects malformed native readings and leaves an earned right unconsumed until the bridge recovers', async () => {
  native.read.mockResolvedValueOnce({ boot: 7, elapsed: -1 });
  const clock = createRecoveryClock(), save = fresh();
  expect(await clock.acquire()).toBeUndefined();
  expect(grantUnlimitedAccess(save, deal, { version: 1, id: 'earned', attemptId: save.attempt.id,
    source: 'rewarded', issuedAt: 100_000, until: 160_000 }, clock.read())).toBe(false);
  expect(grantUnlimitedAccess(save, deal, { version: 1, id: 'earned', attemptId: save.attempt.id,
    source: 'rewarded', issuedAt: 100_000, until: 160_000 }, { timeline: 'android-7', elapsed: 50_000, native: true })).toBe(true);
  const before = structuredClone(save);
  expect(useUnlimitedAccess(save, deal, 'earned', 100_010, clock.read())).toBe(false);
  expect(save).toEqual(before);
  native.read.mockResolvedValueOnce({ boot: 7, elapsed: 90_000 });
  const ready = await clock.acquire();
  expect(useUnlimitedAccess(save, deal, 'earned', 99_000, ready)).toBe(true);
  expect(unlimitedRemaining(save.attempt.unlimited!, 99_000, ready)).toBeLessThanOrEqual(20_000);
  expect(save.attempt.unlimitedAccess?.consumed).toBe(true);
  expect(save.profile.coins).toBe(300);
});

it('startup preserves an unused native-bound earned right through a failed first read and recovers only its original remaining duration', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const save = fresh();
  expect(grantUnlimitedAccess(save, deal, { version: 1, id: 'earned-before-restart', attemptId: save.attempt.id,
    source: 'rewarded', issuedAt: 100_000, until: 160_000 }, { timeline: 'android-7', elapsed: 50_000, native: true })).toBe(true);
  const original = structuredClone(save.attempt.unlimitedAccess);
  native.read.mockRejectedValueOnce(Error('first process read failed'));
  const { store, clock } = await restartWithClock(save, 110_000);
  expect(requiresNativeRecoveryClock(store.state, clock.read())).toBe(true);
  expect(unlimitedRemaining(store.state.attempt.unlimitedAccess!, 110_000, clock.read())).toBeUndefined();
  expect(store.state.attempt.unlimitedAccess).toEqual(original);
  expect(store.state.attempt.board.movesLeft).toBe(deal.initial.movesLeft);
  expect(store.state.profile.coins).toBe(300);
  // Timer/resume passes must not write an expiry or a page anchor while the sample is unknown.
  expect(await store.mutate(next => expireUnlimited(next, 90_000, clock.read()))).toBe(false);
  expect(store.state.attempt.unlimitedAccess).toEqual(original);
  expect(useUnlimitedAccess(store.state, deal, 'earned-before-restart', 90_000, clock.read())).toBe(false);
  native.read.mockResolvedValueOnce({ boot: 7, elapsed: 90_000 });
  const healthy = (await clock.acquire())!;
  await store.mutate(next => expireUnlimited(next, 90_000, healthy));
  expect(requiresNativeRecoveryClock(store.state, healthy)).toBe(false);
  expect(unlimitedRemaining(store.state.attempt.unlimitedAccess!, 90_000, healthy)).toBe(20_000);
  expect(await store.mutate(next => useUnlimitedAccess(next, deal, 'earned-before-restart', 90_000, healthy))).toBe(true);
  expect(store.state.attempt.unlimited?.clock).toEqual(original!.clock);
  expect(store.state.attempt.unlimited?.until).toBe(160_000);
  expect(store.state.attempt.unlimitedAccess?.consumed).toBe(true);
});

it.each(['active', 'parked'] as const)('startup does not confuse an unknown native sample with a changed boot for %s effects; late read expires original time', async mode => {
  vi.spyOn(performance, 'now').mockReturnValue(0);
  let save = fresh();
  expect(buyUnlimitedAccess(save, deal, 'timed-before-restart', 100_000,
    { timeline: 'android-7', elapsed: 50_000, native: true })).toBe(true);
  save = dispatch(save, { type: 'draw' }, deal).next;
  const original = structuredClone(save.attempt), daily = dailyForDay('2026-11-24');
  if (mode === 'parked') switchMode(save, 'daily', daily, 'daily-with-pending-campaign-clock');
  native.read.mockRejectedValueOnce(Error('first read failed'));
  const { store, clock } = await restartWithClock(save, 110_000);
  const campaign = () => mode === 'active' ? store.state.attempt : store.state.parked!.campaign!;
  expect(requiresNativeRecoveryClock(store.state, clock.read())).toBe(true);
  expect(campaign().unlimited).toEqual(original.unlimited);
  expect(campaign().board.movesLeft).toBeNull();
  expect(campaign().undo).toEqual(original.undo);
  // Main blocks only this active infinite effect; a parked one must not block the finite Daily.
  expect(store.state.attempt.board.movesLeft === null).toBe(mode === 'active');
  expect(await store.mutate(next => expireUnlimited(next, 90_000, clock.read()))).toBe(false);
  native.read.mockResolvedValueOnce({ boot: 7, elapsed: 111_000 });
  await clock.refresh();
  expect(await store.mutate(next => expireUnlimited(next, 110_000, clock.read()))).toBe(true);
  expect(campaign().unlimited?.expired).toBe(true);
  expect(campaign().unlimited?.until).toBe(160_000);
  expect(campaign().board.movesLeft).toBe(deal.initial.movesLeft! - 1);
  expect(campaign().undo[0].movesLeft).toBe(deal.initial.movesLeft);
  expect(store.state.profile.coins).toBe(180);
  expect(requiresNativeRecoveryClock(store.state, clock.read())).toBe(false);
});

it('the original wall deadline can end a waiting right without a native sample; no timer pass gives it a new anchor', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const save = fresh();
  buyUnlimitedAccess(save, deal, 'waiting-until-deadline', 100_000, { timeline: 'android-7', elapsed: 50_000, native: true });
  native.read.mockRejectedValueOnce(Error('native offline'));
  const { store, clock } = await restartWithClock(save, 110_000);
  const originalClock = structuredClone(store.state.attempt.unlimited!.clock);
  expect(await store.mutate(next => expireUnlimited(next, 150_000, clock.read()))).toBe(false);
  expect(store.state.attempt.unlimited?.clock).toEqual(originalClock);
  expect(await store.mutate(next => expireUnlimited(next, 160_000, clock.read()))).toBe(true);
  expect(store.state.attempt.unlimited?.clock).toEqual(originalClock);
  expect(store.state.attempt.board.movesLeft).toBe(deal.initial.movesLeft);
  expect(requiresNativeRecoveryClock(store.state, clock.read())).toBe(false);
});

it('legacy deadline-only rights wait without acquiring a page anchor, and a healthy native sample retains the old deadline', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const save = fresh();
  grantUnlimitedAccess(save, deal, { version: 1, id: 'legacy-deadline', attemptId: save.attempt.id,
    source: 'campaign', issuedAt: 100_000, until: 160_000 });
  native.read.mockRejectedValueOnce(Error('native offline'));
  const { store, clock } = await restartWithClock(save, 110_000);
  expect(requiresNativeRecoveryClock(store.state, clock.read())).toBe(true);
  expect(store.state.attempt.unlimitedAccess?.clock).toBeUndefined();
  expect(store.state.attempt.unlimitedAccess?.expired).toBeUndefined();
  native.read.mockResolvedValueOnce({ boot: 7, elapsed: 60_000 });
  await clock.refresh();
  await store.mutate(next => expireUnlimited(next, 120_000, clock.read()));
  expect(store.state.attempt.unlimitedAccess).toMatchObject({ until: 160_000,
    clock: { timeline: 'android-7', elapsed: 60_000, wall: 120_000 } });
  expect(unlimitedRemaining(store.state.attempt.unlimitedAccess!, 120_000, clock.read())).toBe(40_000);
});

it('a confirmed new Android boot still expires a saved native-bound right', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const save = fresh();
  grantUnlimitedAccess(save, deal, { version: 1, id: 'earned-old-boot', attemptId: save.attempt.id,
    source: 'campaign', issuedAt: 100_000, until: 160_000 }, { timeline: 'android-7', elapsed: 50_000, native: true });
  native.read.mockResolvedValueOnce({ boot: 8, elapsed: 100 });
  const { store, clock } = await restartWithClock(save, 110_000);
  expect(store.state.attempt.unlimitedAccess?.expired).toBe(true);
  expect(requiresNativeRecoveryClock(store.state, clock.read())).toBe(false);
});

it.each(['active', 'parked'] as const)('expires historical page-clock %s rights after native recovery without rebasing time or Undo', mode => {
  let save = fresh();
  const budget = save.attempt.board.movesLeft!;
  expect(buyUnlimitedAccess(save, deal, 'legacy-page', 100_000)).toBe(true);
  expireUnlimited(save, 100_000, page);
  save = dispatch(save, { type: 'draw' }, deal).next;
  const daily = dailyForDay('2026-11-24');
  if (mode === 'parked') switchMode(save, 'daily', daily, 'daily-owner');
  const lookup = (id: string) => id === deal.id ? deal : id === daily.id ? daily : undefined;
  save = decodeSave(JSON.stringify(save), lookup);
  expect(expireUnlimited(save, 110_000, { timeline: 'android-7', elapsed: 70_000, native: true })).toBe(true);
  const campaign = mode === 'active' ? save.attempt : save.parked!.campaign!;
  expect(campaign.unlimited?.expired).toBe(true);
  expect(campaign.board.movesLeft).toBe(budget - 1);
  expect(campaign.undo[0].movesLeft).toBe(budget);
  expect(campaign.board.retainedMoves).toBeUndefined();
  expect(save.profile.coins).toBe(180);
  expect(decodeSave(JSON.stringify(save), lookup)).toEqual(save);
});

it('also expires an unconsumed old page right, preserving indefinite rights and completed boards', () => {
  const earned = fresh();
  grantUnlimitedAccess(earned, deal, { version: 1, id: 'legacy-earned', attemptId: earned.attempt.id,
    source: 'campaign', issuedAt: 100_000, until: 160_000 });
  expireUnlimited(earned, 100_000, page);
  expireUnlimited(earned, 110_000, { ...page, timeline: 'page-22222222-2222-2222-2222-222222222222', native: true });
  expect(earned.attempt.unlimitedAccess?.expired).toBe(true);
  expect(earned.attempt.unlimitedAccess?.consumed).toBeUndefined();
  const indefinite = fresh();
  beginUnlimited(indefinite, deal, { id: 'historical', attemptId: indefinite.attempt.id }, 100_000);
  expect(expireUnlimited(indefinite, 110_000, { timeline: 'android-8', elapsed: 1, native: true })).toBe(false);
  expect(indefinite.attempt.board.movesLeft).toBeNull();
  let won = fresh();
  buyUnlimitedAccess(won, deal, 'legacy-won', 100_000);
  expireUnlimited(won, 100_000, page);
  for (const action of deal.winningPath) won = dispatch(won, action, deal).next;
  expect(won.attempt.board.phase).toBe('won');
  expireUnlimited(won, 110_000, { timeline: 'android-8', elapsed: 1, native: true });
  expect(won.attempt.board.phase).toBe('won');
});

it('retains the browser page-clock path without requiring an unavailable native bridge', async () => {
  native.enabled = false;
  const clock = createRecoveryClock(), save = fresh(), ready = await clock.acquire();
  expect(ready?.timeline).toMatch(/^page-/);
  expect(ready?.native).toBeUndefined();
  expect(buyUnlimitedAccess(save, deal, 'browser', 100_000, ready)).toBe(true);
  expect(native.read).not.toHaveBeenCalled();
});
