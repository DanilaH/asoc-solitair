import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameplayActivityCoordinator, type StorageAdapter } from '@danilah/mini-games-kit/platform';
import { introDeal as deal } from '../../src/content/intro';
import { dispatch, freshSave } from '../../src/domain/engine';
import { applyReceipt, parseReceipt, purchaseHelper, useContinue, platformState, interstitialEligible, markCampaignWin, type EarnedReceipt } from '../../src/domain/services';
import { SaveStore, SAVE_KEY, decodeSave } from '../../src/platform/storage';
import { createAds, type AdsBridge, type AdEvent } from '../../src/platform/ads';
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
    prepareInterstitial: vi.fn(async () => undefined), show: vi.fn(async () => ({ shown: true, outcome: 'dismissed' as const })),
    measureBanner: vi.fn(async () => null), placeBanner: vi.fn(async () => undefined), hideBanner: vi.fn(async () => undefined), cancelPending: vi.fn(async () => undefined), dispose: vi.fn(async () => undefined),
    addListener: vi.fn(async (_name, cb) => { event = cb; return { remove: vi.fn(async () => undefined) }; }),
  };
  return { api, emit: (value: AdEvent) => event(value) };
}
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

describe('optional native services', () => {
  it('deduplicates receipts after failed ack while allowing commands and spending', async () => {
    const b = bridge(), m = memory(), store = new SaveStore(m.storage, deal, fresh); await store.open();
    b.api.pending = vi.fn(async () => ({ receipts: [receipt] })); b.api.acknowledge = vi.fn(async () => { throw Error('ack failed'); });
    const activity = new GameplayActivityCoordinator(() => undefined, () => undefined);
    const ads = createAds({ activity, commit: r => store.mutate(next => applyReceipt(next, r)), beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined }, b.api);
    await ads.recover(); expect(store.state.profile.hints).toBe(5);
    await store.mutate(next => { next.profile.hints--; });
    await ads.recover(); expect(store.state.profile.hints).toBe(4); expect(b.api.acknowledge).toHaveBeenCalledTimes(2); ads.destroy();
  });
  it('never grants on dismissal and does not clear independent native-background blockers', async () => {
    const b = bridge(), shown = deferred<Awaited<ReturnType<AdsBridge['show']>>>(); b.api.show = vi.fn(() => shown.promise);
    const activity = new GameplayActivityCoordinator(() => undefined, () => undefined), commit = vi.fn(async () => 'applied' as const);
    const ads = createAds({ activity, commit, beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined }, b.api);
    await ads.refresh(); const display = ads.show({ kind: 'rewarded', placement: 'hint', attempt: 'attempt-1', dealId: deal.id, mode: 'campaign' });
    await Promise.resolve(); expect(activity.getBlockReasons()).toContain('ad'); activity.setBlocked('native-background', true);
    shown.resolve({ shown: true, outcome: 'dismissed' }); await display; await ads.recover();
    expect(commit).not.toHaveBeenCalled(); expect(activity.getBlockReasons()).toEqual(['native-background']); ads.destroy();
  });
  it('bounds unresolved optional calls and retains late pending results without freezing gameplay', async () => {
    vi.useFakeTimers(); const b = bridge(), pending = deferred<{ receipts: unknown[] }>(), status = deferred<Awaited<ReturnType<AdsBridge['status']>>>();
    b.api.pending = vi.fn(() => pending.promise); b.api.status = vi.fn(() => status.promise);
    const activity = new GameplayActivityCoordinator(() => undefined, () => undefined), commit = vi.fn(async () => 'applied' as const);
    const ads = createAds({ activity, commit, beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined }, b.api);
    await vi.advanceTimersByTimeAsync(60_000); expect(b.api.pending).toHaveBeenCalledTimes(1); expect(b.api.status).toHaveBeenCalledTimes(1); expect(activity.isBlocked()).toBe(false);
    pending.resolve({ receipts: [receipt] }); await ads.recover(); expect(commit).toHaveBeenCalledTimes(1); ads.destroy();
  });
  it('removes listeners arriving after disposal and ignores late results', async () => {
    const b = bridge(), listener = deferred<{ remove(): Promise<void> }>(), remove = vi.fn(async () => undefined), onStatus = vi.fn();
    b.api.addListener = vi.fn(() => listener.promise);
    const ads = createAds({ activity: new GameplayActivityCoordinator(() => undefined, () => undefined), commit: vi.fn(), beforeShow: async () => undefined, onStatus, onEvent: () => undefined }, b.api);
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
