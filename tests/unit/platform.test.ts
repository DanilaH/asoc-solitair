import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameplayActivityCoordinator, type StorageAdapter } from '@danilah/mini-games-kit/platform';
import { introDeal as deal } from '../../src/content/intro';
import { content8BonusDeals } from '../../src/content/campaign-v8-bonus';
import { dailyForDay } from '../../src/content/daily';
import { CONTENT8_PREVIEW } from '../../src/domain/types';
import { recoverable, loadLoss, winningRescue } from '../fixtures/content8-loss';
import { dispatch, freshAttempt, freshSave } from '../../src/domain/engine';
import { applyFullscreenShown, applyReceipt, parseReceipt, purchaseHelper, useContinue, platformState, interstitialEligible, markCampaignWin, type EarnedReceipt, type FullscreenShown } from '../../src/domain/services';
import { SaveStore, SAVE_KEY, decodeSave } from '../../src/platform/storage';
import { createAds, type AdsBridge, type AdEvent, type AdRequest } from '../../src/platform/ads';
import { createHaptics } from '../../src/platform/haptics';
import { createTelemetry } from '../../src/platform/telemetry';
import { validEvent, createAnalytics } from '../../src/platform/analytics';

const receipt: EarnedReceipt = { schema: 1, id: 'receipt-1', attempt: 'attempt-1', dealId: deal.id, placement: 'hint', mode: 'campaign' };
const fresh = () => freshSave(deal, 'attempt-1');
function memory() {
  let value: string | null = null;
  const storage: StorageAdapter = { getItem: vi.fn(async () => value), setItem: vi.fn(async (_key, next) => { value = next; }), removeItem: vi.fn(async () => { value = null; }) };
  return { storage, raw: () => value };
}
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (e: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function bridge() {
  let event: (value: AdEvent) => void = () => undefined;
  const api: AdsBridge = {
    status: vi.fn(async () => ({ rewarded: true, interstitial: true, banner: true, mode: 'test', ready: true })),
    pending: vi.fn(async () => ({ receipts: [] })), acknowledge: vi.fn(async () => undefined),
    pendingShown: vi.fn(async () => ({ shown: null })), acknowledgeShown: vi.fn(async () => undefined),
    prepareInterstitial: vi.fn(async () => undefined), show: vi.fn(async () => ({ shown: true, outcome: 'dismissed' as const })),
    measureBanner: vi.fn(async () => null), placeBanner: vi.fn(async () => undefined), hideBanner: vi.fn(async () => undefined), cancelPending: vi.fn(async () => undefined), dispose: vi.fn(async () => undefined),
    addListener: vi.fn(async (_name, cb) => { event = cb; return { remove: vi.fn(async () => undefined) }; }),
  };
  return { api, emit: (value: AdEvent) => event(value) };
}
const ignoreShown = async () => 'already-applied' as const;
afterEach(() => { vi.useRealTimers(); });

describe('coordinated save writer and earned effects', () => {
  it('serializes a reward, a move and a settings change against the latest state', async () => {
    const m = memory(), store = new SaveStore(m.storage, deal, fresh); await store.open();
    const earned = store.mutate(next => applyReceipt(next, receipt));
    const command = store.mutate(next => Object.assign(next, dispatch(next, deal.winningPath[0], deal).next));
    const settings = store.mutate(next => { next.settings.haptics = false; });
    await Promise.all([earned, command, settings]);
    expect(store.state.profile.hints).toBe(5); expect(store.state.attempt.board.movesLeft).toBe(31);
    expect(store.state.settings.haptics).toBe(false); expect(JSON.parse(m.raw()!)).toEqual(store.state);
    const reopened = new SaveStore(m.storage, deal, fresh); await reopened.open(); expect(reopened.state).toEqual(store.state);
  });
  it('confirms an ambiguous write only from exact read-back', async () => {
    const m = memory(), store = new SaveStore(m.storage, deal, fresh); await store.open();
    const actual = m.storage.setItem;
    m.storage.setItem = async (key, value) => { await actual(key, value); throw Error('bridge disconnected after disk commit'); };
    await store.mutate(next => applyReceipt(next, receipt));
    expect(store.state.profile.hints).toBe(5); expect(store.needsRecovery).toBe(false);
  });
  it('rejects a failed write without publication, and recovers an unreadable commit before spending', async () => {
    const m = memory(), store = new SaveStore(m.storage, deal, fresh); await store.open();
    const original = m.storage.setItem, read = m.storage.getItem;
    m.storage.setItem = async () => { throw Error('disk full'); };
    await expect(store.mutate(next => applyReceipt(next, receipt))).rejects.toThrow();
    expect(store.state.profile.hints).toBe(3);
    m.storage.setItem = async (key, value) => { await original(key, value); throw Error('lost response'); };
    m.storage.getItem = async () => { throw Error('read unavailable'); };
    await expect(store.mutate(next => applyReceipt(next, receipt))).rejects.toThrow(); expect(store.needsRecovery).toBe(true);
    m.storage.getItem = read; m.storage.setItem = original;
    await store.mutate(next => { next.profile.hints--; next.revision++; });
    expect(store.state.profile.hints).toBe(4); expect(store.state.platform?.receipts).toEqual(['receipt-1']);
  });
  it('does not replace unreadable or corrupt native data with a new save', async () => {
    const m = memory(); await m.storage.setItem(SAVE_KEY, '{broken');
    await expect(new SaveStore(m.storage, deal, fresh).open()).rejects.toThrow(); expect(m.raw()).toBe('{broken');
    m.storage.getItem = async () => { throw Error('read failed'); };
    await expect(new SaveStore(m.storage, deal, fresh).open()).rejects.toThrow('read failed'); expect(m.raw()).toBe('{broken');
  });
  it('migrates the old snapshot without changing its board or awarding initial resources again', () => {
    const old = fresh(); old.profile.hints = 0; delete old.platform;
    expect(decodeSave(JSON.stringify(old), deal)).toEqual(old);
    applyReceipt(old, receipt); expect(old.profile.hints).toBe(2);
    old.platform!.receipts.push('receipt-1'); expect(() => decodeSave(JSON.stringify(old), deal)).toThrow();
  });
  it('applies each earned receipt once, and Undo/restart never refund an exchange', () => {
    let save = fresh(); expect(applyReceipt(save, receipt)).toBe('applied'); expect(applyReceipt(save, receipt)).toBe('already-applied');
    expect(purchaseHelper(save, 'undo')).toBe(true); expect(save.profile.coins).toBe(40);
    expect(purchaseHelper(save, 'undo')).toBe(false);
    save = dispatch(save, deal.winningPath[0], deal).next; save = dispatch(save, { type: 'undo' }, deal).next;
    expect(save.profile.hints).toBe(5); expect(save.profile.undos).toBe(5); expect(save.profile.coins).toBe(40);
    save = dispatch(save, { type: 'restart', attemptId: 'attempt-2' }, deal).next;
    expect(save.profile.hints).toBe(5); expect(save.platform?.receipts).toEqual(['receipt-1']);
  });
  it('continues only an exhausted attempt once; a late earned continuation remains a consumable credit', () => {
    let save = fresh(); save.attempt.board.movesLeft = 0; save.attempt.board.phase = 'exhausted';
    const r = { ...receipt, placement: 'continue' as const };
    applyReceipt(save, r); expect(save.attempt.board.movesLeft).toBe(10); expect(save.attempt.continued).toBe(true);
    applyReceipt(save, { ...r, id: 'different-callback-id' }); expect(platformState(save).continueCredits).toBe(0);
    save = dispatch(save, { type: 'restart', attemptId: 'attempt-2' }, deal).next;
    applyReceipt(save, { ...r, id: 'late', attempt: 'abandoned-attempt' }); expect(save.attempt.board.movesLeft).toBe(32);
    save.attempt.board.movesLeft = 0; save.attempt.board.phase = 'exhausted';
    expect(useContinue(save)).toBe(true); expect(useContinue(save)).toBe(false); expect(save.attempt.board.movesLeft).toBe(10);
  });
  it.skipIf(!CONTENT8_PREVIEW)('stores a late campaign continuation once while daily is active and re-proves it after returning', async () => {
    const campaign = loadLoss(recoverable, 'parked-loss'), daily = dailyForDay('2026-11-21');
    const current = freshSave(daily, 'active-daily');
    current.parked = { campaign: campaign.attempt };
    const resolve = (id: string) => [recoverable, daily].find(value => value.id === id);
    const memoryStore = memory();
    const store = new SaveStore(memoryStore.storage, resolve, () => current);
    await store.open();
    const earned = { ...receipt, placement: 'continue', attempt: campaign.attempt.id, dealId: recoverable.id } as const;
    const proof = { attemptId: earned.attempt, deal: recoverable, path: winningRescue };

    await store.mutate(next => applyReceipt(next, earned, { continueProof: proof }));
    await store.mutate(next => applyReceipt(next, { ...earned, id: 'duplicate-native-delivery' }, { continueProof: proof }));
    expect(store.state.attempt).toEqual(freshAttempt(daily, 'active-daily'));
    expect(store.state.parked?.campaign).toEqual(campaign.attempt);
    expect(store.state.platform?.continueCredits).toBe(1);

    const restored = new SaveStore(memoryStore.storage, resolve, () => current);
    await restored.open();
    expect(restored.state.platform?.continueCredits).toBe(1);
    await restored.mutate(next => {
      const parked = next.parked!.campaign!;
      next.parked = { daily: next.attempt };
      next.attempt = parked;
    });
    expect(await restored.mutate(next => useContinue(next, { ...proof, path: proof.path.slice(0, -1) }))).toBe(false);
    expect(await restored.mutate(next => useContinue(next, proof))).toBe(true);
    expect(restored.state.attempt.board).toMatchObject({ phase: 'playing', movesLeft: 10 });
    expect(restored.state.platform?.continueCredits).toBe(0);
    expect(await restored.mutate(next => applyReceipt(next, earned))).toBe('already-applied');
  });
  it('protects tutorials, daily, first-launch grace, rewarded cooldown and clock rollback', () => {
    const save = fresh();
    for (let level = 1; level <= 8; level++) markCampaignWin(save, `deal-${level}`, level);
    markCampaignWin(save, 'deal-8', 8); expect(platformState(save).winsSinceInterstitial).toBe(3);
    expect(interstitialEligible(save, 8, 'campaign', 300_000, 100_000)).toBe(true);
    expect(interstitialEligible(save, 5, 'campaign', 300_000, 100_000)).toBe(false);
    expect(interstitialEligible(save, 8, 'daily', 300_000, 100_000)).toBe(false);
    expect(interstitialEligible(save, 8, 'campaign', 110_000, 100_000)).toBe(false);
    platformState(save).lastFullscreenAt = 280_000;
    expect(interstitialEligible(save, 8, 'campaign', 300_000, 100_000)).toBe(false);
    expect(interstitialEligible(save, 8, 'campaign', 200_000, 100_000)).toBe(false);
    expect(() => parseReceipt({ ...receipt, placement: 'money', amount: 999999 })).toThrow();
  });
  it('keeps an earned continuation budget through Undo without restoring its allowance', () => {
    let save = fresh(); save.attempt.board.movesLeft = 1;
    save = dispatch(save, deal.winningPath[0], deal).next;
    expect(save.attempt.board.phase).toBe('exhausted');
    applyReceipt(save, { ...receipt, placement: 'continue' });
    save = dispatch(save, { type: 'undo' }, deal).next;
    expect(save.attempt.board.movesLeft).toBe(11); expect(save.attempt.continued).toBe(true);
    expect(useContinue(save)).toBe(false);
  });
});

describe('durable native fullscreen cadence', () => {
  const interstitial: AdRequest = { kind: 'interstitial', placement: 'continue', attempt: receipt.attempt, dealId: receipt.dealId, mode: receipt.mode };
  const rewarded: AdRequest = { ...interstitial, kind: 'rewarded', placement: 'hint' };
  const displayed: FullscreenShown = { ...interstitial, schema: 1, id: 'sdk-display', shownAt: 500_000 };
  const withLegacyCadence = () => {
    const save = fresh();
    Object.assign(platformState(save), { lastFullscreenAt: 280_000, winsSinceInterstitial: 3 });
    return save;
  };
  function receiver(store: SaveStore, b: ReturnType<typeof bridge>) {
    return createAds({
      activity: new GameplayActivityCoordinator(() => undefined, () => undefined),
      commit: value => store.mutate(save => applyReceipt(save, value)),
      commitShown: value => store.mutate(save => applyFullscreenShown(save, value)),
      beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined,
    }, b.api);
  }

  it('preserves legacy cadence across all no-show outcomes, including an impression-only event', async () => {
    const m = memory(), store = new SaveStore(m.storage, deal, withLegacyCadence);
    const original = await store.open(), b = bridge(), ads = receiver(store, b);
    try {
      await ads.refresh();
      expect(interstitialEligible(original, 6, 'campaign', 399_999, 100_000)).toBe(false);
      expect(interstitialEligible(original, 6, 'campaign', 400_000, 100_000)).toBe(true);
      for (const [request, outcome] of [[interstitial, 'unavailable'], [rewarded, 'unavailable'], [rewarded, 'cancelled']] as const) {
        vi.mocked(b.api.show).mockResolvedValueOnce({ shown: false, outcome });
        expect(await ads.show(request)).toEqual({ shown: false, outcome });
      }
      vi.mocked(b.api.show).mockImplementationOnce(() => { throw Error('SDK throw'); });
      expect((await ads.show(interstitial)).outcome).toBe('error');
      b.emit({ kind: 'interstitial', phase: 'impression' });
      const reopened = new SaveStore(m.storage, deal, fresh);
      expect(await reopened.open()).toEqual(original);
      expect(b.api.acknowledgeShown).not.toHaveBeenCalled();
    } finally { ads.destroy(); }
  });

  it('persists an actual show before dismissal and ignores repeated or differently bound SDK notices', async () => {
    const m = memory(), store = new SaveStore(m.storage, deal, withLegacyCadence);
    const original = await store.open(), b = bridge(), ads = receiver(store, b);
    let pending: FullscreenShown | null = null;
    b.api.pendingShown = vi.fn(async () => ({ shown: pending }));
    b.api.acknowledgeShown = vi.fn(async () => { pending = null; });
    const outcome = deferred<Awaited<ReturnType<AdsBridge['show']>>>();
    vi.mocked(b.api.show).mockImplementationOnce(() => outcome.promise);
    try {
      await ads.refresh(); await ads.recover();
      const showing = ads.show(interstitial);
      await vi.waitFor(() => expect(b.api.show).toHaveBeenCalledWith(interstitial));
      pending = displayed;
      b.emit({ kind: 'interstitial', phase: 'show' });
      await ads.recover();
      expect(ads.showing).toBe(true);
      const first = JSON.parse(m.raw()!);
      expect(first.platform).toMatchObject({
        lastFullscreenAt: 500_000, winsSinceInterstitial: 0,
        fullscreenCadence: { version: 1, lastShownId: displayed.id },
      });
      expect(first.profile).toEqual(original.profile);
      outcome.resolve({ shown: true, outcome: 'dismissed' });
      await showing;
      await store.mutate(save => { save.attempt.id = 'next-attempt'; platformState(save).winsSinceInterstitial = 1; });
      const progressed = store.state;
      for (const value of [displayed, { ...displayed, id: 'late-sdk-display', shownAt: 510_000 }]) {
        pending = value; b.emit({ kind: 'interstitial', phase: 'show' }); await ads.recover();
      }
      expect(JSON.parse(m.raw()!)).toEqual(progressed);
      expect(b.api.acknowledgeShown).toHaveBeenCalledTimes(3);
    } finally { ads.destroy(); }
  });

  it('replays a pending rewarded display after a failed write and only credits a later earned receipt', async () => {
    const m = memory(), store = new SaveStore(m.storage, deal, withLegacyCadence);
    const original = await store.open(), b = bridge(), ads = receiver(store, b);
    const display = { ...displayed, kind: 'rewarded', placement: 'hint' } as const;
    await ads.recover();
    b.api.pendingShown = vi.fn(async () => ({ shown: display }));
    const write = m.storage.setItem;
    m.storage.setItem = async () => { throw Error('storage offline'); };
    await ads.recover(); ads.destroy();
    expect(b.api.acknowledgeShown).not.toHaveBeenCalled();
    expect(JSON.parse(m.raw()!)).toEqual(original);
    m.storage.setItem = write;
    const reopened = new SaveStore(m.storage, deal, fresh); await reopened.open();
    const restarted = receiver(reopened, b);
    try {
      await restarted.recover();
      const persisted = reopened.state;
      expect(persisted.platform).toMatchObject({ lastFullscreenAt: 500_000, winsSinceInterstitial: 3 });
      expect(persisted.profile).toEqual(original.profile);
      await restarted.recover();
      expect(reopened.state.revision).toBe(persisted.revision);
      b.api.pending = vi.fn(async () => ({ receipts: [{ ...receipt, id: display.id }] }));
      b.emit({ kind: 'rewarded', phase: 'earned' }); await restarted.recover(); await restarted.recover();
      expect(reopened.state.profile.hints).toBe(original.profile.hints + 2);
      expect(reopened.state.platform?.receipts).toEqual([display.id]);
      expect(reopened.state.platform?.lastFullscreenAt).toBe(display.shownAt);
    } finally { restarted.destroy(); }
  });
});

describe('optional native services', () => {
  it('continues a proven C8 loss only after an earned native receipt', async () => {
    const b = bridge(), save = loadLoss(recoverable, 'attempt-1');
    const earned = { ...receipt, dealId: recoverable.id, placement: 'continue' } as const;
    const proof = { attemptId: save.attempt.id, deal: recoverable, path: winningRescue };
    const ads = createAds({
      activity: new GameplayActivityCoordinator(() => undefined, () => undefined),
      commit: async value => applyReceipt(save, value, { continueProof: proof }),
      commitShown: ignoreShown, beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined,
    }, b.api);
    try {
      await ads.refresh();
      const request = { kind: 'rewarded', placement: earned.placement, dealId: earned.dealId, mode: earned.mode, attempt: earned.attempt } as const;
      vi.mocked(b.api.show).mockResolvedValueOnce({ shown: false, outcome: 'unavailable' });
      await ads.show(request);
      await ads.show(request);
      await ads.recover();
      expect(save.attempt.board.movesLeft).toBe(0);
      b.api.pending = vi.fn(async () => ({ receipts: [earned, earned] }));
      await ads.recover();
      expect(save.attempt.board.movesLeft).toBe(10);
      expect(save.attempt.continued).toBe(true);
      expect(save.platform?.receipts).toEqual([earned.id]);
      expect(save.platform?.continueCredits).toBe(0);
    } finally { ads.destroy(); }
  });
  it('grants the exact bonus only for a journal receipt, through no-fill, dismissal and failed ack', async () => {
    const bonus = { ...content8BonusDeals[2], id: 'bonus-bridge-fixture' }, b = bridge(), m = memory();
    const store = new SaveStore(m.storage, bonus, () => freshSave(bonus, 'attempt-1'));
    await store.open();
    const reward: EarnedReceipt = { ...receipt, dealId: bonus.id, placement: 'bonus-tableau' };
    const ads = createAds({
      activity: new GameplayActivityCoordinator(() => undefined, () => undefined),
      commit: earned => store.mutate(next => applyReceipt(next, earned, { deal: bonus })),
      commitShown: ignoreShown, beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined,
    }, b.api);
    try {
      await ads.refresh();
      const request = { kind: 'rewarded', attempt: reward.attempt, placement: reward.placement, dealId: bonus.id, mode: 'campaign' } as const;
      vi.mocked(b.api.show).mockResolvedValueOnce({ shown: false, outcome: 'unavailable' });
      await ads.show(request);
      await ads.show(request);
      await ads.recover();
      expect(store.state.attempt.board.tableau).toHaveLength(4);
      b.api.pending = vi.fn(async () => ({ receipts: [reward] }));
      b.api.acknowledge = vi.fn(async () => { throw Error('ack failed'); });
      await ads.recover();
      await ads.recover();
      expect(store.state.attempt.board.tableau).toHaveLength(5);
      expect(store.state.attempt.board.foundations).toHaveLength(4);
      expect(store.state.profile.coins).toBe(100);
      expect(store.state.platform?.receipts).toEqual([reward.id]);
    } finally { ads.destroy(); }
  });
  it('deduplicates receipts after failed ack while allowing commands and spending', async () => {
    const b = bridge(), m = memory(), store = new SaveStore(m.storage, deal, fresh); await store.open();
    b.api.pending = vi.fn(async () => ({ receipts: [receipt] })); b.api.acknowledge = vi.fn(async () => { throw Error('ack failed'); });
    const activity = new GameplayActivityCoordinator(() => undefined, () => undefined);
    const ads = createAds({ activity, commit: r => store.mutate(next => applyReceipt(next, r)), commitShown: ignoreShown, beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined }, b.api);
    await ads.recover(); expect(store.state.profile.hints).toBe(5);
    await store.mutate(next => { next.profile.hints--; });
    await ads.recover(); expect(store.state.profile.hints).toBe(4); expect(b.api.acknowledge).toHaveBeenCalledTimes(2); ads.destroy();
  });
  it('never grants on dismissal and does not clear independent native-background blockers', async () => {
    const b = bridge(), shown = deferred<Awaited<ReturnType<AdsBridge['show']>>>(); b.api.show = vi.fn(() => shown.promise);
    const activity = new GameplayActivityCoordinator(() => undefined, () => undefined), commit = vi.fn(async () => 'applied' as const);
    const ads = createAds({ activity, commit, commitShown: ignoreShown, beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined }, b.api);
    await ads.refresh(); const display = ads.show({ kind: 'rewarded', placement: 'hint', attempt: 'attempt-1', dealId: deal.id, mode: 'campaign' });
    await Promise.resolve(); expect(activity.getBlockReasons()).toContain('ad'); activity.setBlocked('native-background', true);
    shown.resolve({ shown: true, outcome: 'dismissed' }); await display; await ads.recover();
    expect(commit).not.toHaveBeenCalled(); expect(activity.getBlockReasons()).toEqual(['native-background']); ads.destroy();
  });
  it('bounds unresolved optional calls and retains late pending results without freezing gameplay', async () => {
    vi.useFakeTimers(); const b = bridge(), pending = deferred<{ receipts: unknown[] }>(), status = deferred<Awaited<ReturnType<AdsBridge['status']>>>();
    b.api.pending = vi.fn(() => pending.promise); b.api.status = vi.fn(() => status.promise);
    const activity = new GameplayActivityCoordinator(() => undefined, () => undefined), commit = vi.fn(async () => 'applied' as const);
    const ads = createAds({ activity, commit, commitShown: ignoreShown, beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined }, b.api);
    await vi.advanceTimersByTimeAsync(60_000); expect(b.api.pending).toHaveBeenCalledTimes(1); expect(b.api.status).toHaveBeenCalledTimes(1); expect(activity.isBlocked()).toBe(false);
    pending.resolve({ receipts: [receipt] }); await ads.recover(); expect(commit).toHaveBeenCalledTimes(1); ads.destroy();
  });
  it('removes listeners arriving after disposal and ignores late results', async () => {
    const b = bridge(), listener = deferred<{ remove(): Promise<void> }>(), remove = vi.fn(async () => undefined), onStatus = vi.fn();
    b.api.addListener = vi.fn(() => listener.promise);
    const ads = createAds({ activity: new GameplayActivityCoordinator(() => undefined, () => undefined), commit: vi.fn(), commitShown: ignoreShown, beforeShow: async () => undefined, onStatus, onEvent: () => undefined }, b.api);
    ads.destroy(); listener.resolve({ remove }); await Promise.resolve(); await Promise.resolve(); expect(remove).toHaveBeenCalledTimes(1); expect(onStatus).not.toHaveBeenCalled();
  });
  it('cancels haptic generations on ad/background and independently saved mute', () => {
    const pulse = vi.fn(async (_options: { cue: string; issuedAt: number; generation: number }) => undefined), cancel = vi.fn(async () => undefined);
    const haptics = createHaptics({ pulse, cancel }); haptics.setBlocked(false); haptics.pulse('transfer');
    const firstGeneration = pulse.mock.calls[0][0].generation;
    haptics.setBlocked(true); haptics.pulse('win'); expect(pulse).toHaveBeenCalledTimes(1);
    haptics.setBlocked(false); haptics.pulse('complete'); expect(pulse.mock.calls[1][0].generation).toBeGreaterThan(firstGeneration);
    haptics.setEnabled(false); haptics.pulse('button'); expect(pulse).toHaveBeenCalledTimes(2); haptics.destroy(); expect(cancel).toHaveBeenCalled();
  });
  it('counts monotonic active time separately from modal/ad/background and whitelists telemetry fields', () => {
    let now = 0; const state = fresh(), activity = new GameplayActivityCoordinator(() => undefined, () => undefined), track = vi.fn();
    const telemetry = createTelemetry(() => state, activity, { track, destroy: () => undefined }, () => now);
    telemetry.ready(); now = 1000; activity.setBlocked('modal', true); now = 9000; expect(telemetry.activeMs()).toBe(1000);
    activity.setBlocked('ad', true); activity.setBlocked('modal', false); now = 15000; expect(telemetry.activeMs()).toBe(1000);
    activity.setBlocked('ad', false); now = 16000; expect(telemetry.activeMs()).toBe(2000);
    telemetry.track('helper_used', { helper: 'hint' }); const params = track.mock.calls[0][1];
    expect(validEvent('helper_used', params)).toBe(true); expect(validEvent('helper_used', { ...params, rawSave: 'secret' })).toBe(false); telemetry.destroy();
  });
  it('caps hung analytics transports without retaining full saves or growing RPC queues', () => {
    const report = vi.fn(() => new Promise<void>(() => undefined)); const analytics = createAnalytics({ report });
    const params = { schema: 1, mode: 'campaign', attemptId: 'a', dealId: 'd', rulesVersion: 1, contentVersion: 1, balanceVersion: 1, movesLeft: 10, activeMs: 100 };
    for (let i = 0; i < 100; i++) analytics.track('session_start', params);
    expect(report).toHaveBeenCalledTimes(32); analytics.destroy();
  });
});
