import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { DurableReceiptQueue, type ReceiptCommitResult, type GameplayActivityCoordinator } from '@danilah/mini-games-kit/platform';
import type { NativeBannerPlacement, NativeBannerPlacementInput } from '@danilah/mini-games-kit/layout';
import { parseReceipt, type EarnedReceipt, type RewardPlacement } from '../domain/services';

export interface AdRequest { kind: 'rewarded' | 'interstitial'; placement: RewardPlacement; attempt: string; mode: 'campaign' | 'daily' }
export interface AdOutcome { shown: boolean; outcome: 'dismissed' | 'unavailable' | 'error' | 'cancelled' }
export interface AdStatus { rewarded: boolean; interstitial: boolean; banner: boolean; mode: string; ready?: boolean }
export interface AdEvent { kind: 'rewarded' | 'interstitial' | 'banner'; phase: string }
export interface AdsBridge {
  status(): Promise<AdStatus>;
  prepareInterstitial(): Promise<void>;
  show(request: AdRequest): Promise<AdOutcome>;
  pending(): Promise<{ receipts: unknown[] }>;
  acknowledge(options: { id: string }): Promise<void>;
  cancelPending(): Promise<void>;
  measureBanner(options: { viewportWidth: number; slotWidth: number }): Promise<Omit<NativeBannerPlacementInput, 'slot' | 'viewport'> | null>;
  placeBanner(options: { placement: NativeBannerPlacement; generation: number }): Promise<void>;
  hideBanner(options: { generation: number }): Promise<void>;
  dispose(): Promise<void>;
  addListener(name: 'adEvent', callback: (event: AdEvent) => void): Promise<PluginListenerHandle>;
}
export const disabledStatus: AdStatus = { rewarded: false, interstitial: false, banner: false, mode: 'disabled' };
const unavailable: AdOutcome = { shown: false, outcome: 'unavailable' };
/** No web mocks; injected bridges exist solely as ordinary unit-test constructor dependencies. */
export function createAds(options: {
  activity: Pick<GameplayActivityCoordinator, 'setBlocked' | 'isBlocked'>;
  commit(receipt: EarnedReceipt): Promise<ReceiptCommitResult>;
  beforeShow(request: AdRequest): Promise<void>;
  onStatus(status: AdStatus): void;
  onEvent(event: AdEvent): void;
}, bridge?: AdsBridge) {
  const native = bridge ?? (Capacitor.isNativePlatform() ? registerPlugin<AdsBridge>('SolitaireAds') : undefined);
  let alive = true, showing = false;
  let status = disabledStatus;
  let listener: PluginListenerHandle | undefined;
  let recoveryFlight: Promise<void> | undefined, prepareFlight: Promise<void> | undefined, statusFlight: Promise<void> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const queue = new DurableReceiptQueue<EarnedReceipt>({ commit: async r => {
    if (!alive) throw Error('Disposed receipt receiver');
    return options.commit(r);
  }, acknowledge: async id => { if (!alive) throw Error('Disposed receipt receiver'); await native?.acknowledge({ id }); } });
  function schedule() {
    if (!alive || !native || retry !== undefined) return;
    retry = setTimeout(() => { retry = undefined; void refresh(); void recover(); schedule(); }, status.ready ? 30_000 : 2000);
  }
  function recover(): Promise<void> {
    if (!alive || !native) return Promise.resolve();
    if (recoveryFlight) return recoveryFlight;
    recoveryFlight = (async () => {
      try {
        const result = await native.pending();
        if (!alive) return;
        for (const value of result.receipts) { if (!alive) return; await queue.deliver(parseReceipt(value)); }
      } catch { /* Retry in the background, retaining the exact native receipt. */ }
      finally { recoveryFlight = undefined; }
    })();
    return recoveryFlight;
  }
  function refresh(): Promise<void> {
    if (!alive || !native) return Promise.resolve();
    if (statusFlight) return statusFlight;
    statusFlight = native.status().then(value => {
      if (!alive) return;
      status = value; options.onStatus({ ...status });
    }).catch(() => undefined).finally(() => { statusFlight = undefined; });
    return statusFlight;
  }
  if (native) {
    void native.addListener('adEvent', event => {
      if (!alive) return;
      options.onEvent(event);
      if (['earned', 'receipt_pending', 'dismiss'].includes(event.phase)) void recover();
    }).then(handle => { if (!alive) void handle.remove().catch(() => undefined); else listener = handle; }).catch(() => undefined);
    void refresh(); void recover(); schedule();
  }
  return {
    get status() { return status; },
    get bridge() { return native; },
    get showing() { return showing; },
    refresh, recover,
    prepareInterstitial(): Promise<void> {
      if (!alive || !native || showing || !status.interstitial) return Promise.resolve();
      if (prepareFlight) return prepareFlight;
      prepareFlight = native.prepareInterstitial().catch(() => undefined).finally(() => { prepareFlight = undefined; });
      return prepareFlight;
    },
    async show(request: AdRequest): Promise<AdOutcome> {
      if (!alive || !native || showing || options.activity.isBlocked() || !status[request.kind]) return unavailable;
      showing = true; options.activity.setBlocked('ad', true);
      try {
        await options.beforeShow({ ...request });
        if (!alive) return unavailable;
        return await native.show({ ...request });
      } catch { return { shown: false, outcome: 'error' }; }
      finally { showing = false; options.activity.setBlocked('ad', false); if (alive) void recover(); }
    },
    destroy() {
      if (!alive) return; alive = false;
      clearTimeout(retry); void listener?.remove().catch(() => undefined);
      void native?.dispose().catch(() => undefined);
    },
  };
}
