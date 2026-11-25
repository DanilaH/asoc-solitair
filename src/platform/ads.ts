import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { DurableReceiptQueue, type ReceiptCommitResult, type GameplayActivityCoordinator } from '@danilah/mini-games-kit/platform';
import type { NativeBannerPlacement, NativeBannerPlacementInput } from '@danilah/mini-games-kit/layout';
import { parseFullscreenShown, parseReceipt, type EarnedReceipt, type FullscreenShown, type RewardPlacement } from '../domain/services';

export interface AdRequest { kind: 'rewarded' | 'interstitial'; placement: RewardPlacement; attempt: string; dealId: string; mode: 'campaign' | 'daily' }
export interface AdOutcome { shown: boolean; outcome: 'dismissed' | 'unavailable' | 'error' | 'cancelled' }
export interface AdStatus { rewarded: boolean; interstitial: boolean; banner: boolean; mode: string; ready?: boolean; interstitialLoaded?: boolean; campaignApproved?: boolean; livesApproved?: boolean; offersApproved?: boolean }
export interface AdEvent { kind: 'rewarded' | 'interstitial' | 'banner'; phase: string; placement?: string }
interface PendingLife { id: string; dealId: string }
export interface AdsBridge {
  status(): Promise<AdStatus>;
  prepareInterstitial(): Promise<void>;
  show(request: AdRequest): Promise<AdOutcome>;
  pending(): Promise<{ receipts: unknown[]; activeLife?: PendingLife | null }>;
  acknowledge(options: { id: string }): Promise<void>;
  pendingShown(): Promise<{ shown: unknown | null }>;
  acknowledgeShown(options: { id: string }): Promise<void>;
  cancelPending(): Promise<void>;
  measureBanner(options: { viewportWidth: number; slotX: number; slotWidth: number }): Promise<Omit<NativeBannerPlacementInput, 'slot' | 'viewport'> | null>;
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
  commitShown(shown: FullscreenShown): Promise<ReceiptCommitResult>;
  beforeShow(request: AdRequest): Promise<void>;
  pendingLife?(): PendingLife | undefined;
  retireLife?(request: PendingLife): Promise<void>;
  onStatus(status: AdStatus): void;
  onEvent(event: AdEvent): void;
}, bridge?: AdsBridge) {
  const native = bridge ?? (Capacitor.isNativePlatform() ? registerPlugin<AdsBridge>('SolitaireAds') : undefined);
  let alive = true, showing = false;
  let retryDelay = 1000;
  let status = disabledStatus;
  let listener: PluginListenerHandle | undefined;
  let recoveryFlight: Promise<void> | undefined, shownFlight: Promise<boolean> | undefined, prepareFlight: Promise<void> | undefined, statusFlight: Promise<void> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const queue = new DurableReceiptQueue<EarnedReceipt>({ commit: async r => {
    if (!alive) throw Error('Disposed receipt receiver');
    return options.commit(r);
  }, acknowledge: async id => { if (!alive) throw Error('Disposed receipt receiver'); await native?.acknowledge({ id }); } });
  const shownQueue = new DurableReceiptQueue<FullscreenShown>({ commit: async shown => {
    if (!alive) throw Error('Disposed display receiver');
    return options.commitShown(shown);
  }, acknowledge: async id => { if (!alive) throw Error('Disposed display receiver'); await native?.acknowledgeShown({ id }); } });
  function schedule() {
    if (!alive || !native || retry !== undefined) return;
    retry = setTimeout(() => { retry = undefined; void refresh(); void recover(); retryDelay = Math.min(30_000, retryDelay * 2); schedule(); }, status.ready ? 30_000 : retryDelay);
  }
  function recoverEarned(): Promise<void> {
    if (!alive || !native) return Promise.resolve();
    if (recoveryFlight) return recoveryFlight;
    recoveryFlight = (async () => {
      try {
        const life = options.pendingLife?.();
        const result = await native.pending();
        if (!alive) return;
        const receipts = result.receipts.map(parseReceipt);
        for (const receipt of receipts) { if (!alive) return; await queue.deliver(receipt); }
        // Only a successful native snapshot can establish that the authorization
        // cannot earn a reward. Older bridges omit activeLife, so keep their request.
        if (alive && life && result.activeLife === null && !receipts.some(receipt =>
            receipt.placement === 'life-refill' && receipt.attempt === life.id && receipt.dealId === life.dealId)) {
          // Shown cadence may still need this nonce after a process restart.
          // Read again after any earlier lookup, which may have predated the show.
          await shownFlight;
          if (await recoverShown() && alive) await options.retireLife?.(life);
        }
      } catch { /* Retry in the background, retaining the exact native receipt. */ }
      finally { recoveryFlight = undefined; }
    })();
    return recoveryFlight;
  }
  function recoverShown(): Promise<boolean> {
    if (!alive || !native) return Promise.resolve(false);
    if (shownFlight) return shownFlight;
    shownFlight = (async () => {
      const { shown } = await native.pendingShown();
      if (!alive) return false;
      if (shown !== null) await shownQueue.deliver(parseFullscreenShown(shown));
      return true;
    })().catch(() => false).finally(() => { shownFlight = undefined; });
    return shownFlight;
  }
  async function recover(): Promise<void> {
    await Promise.all([recoverEarned(), recoverShown()]);
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
      if (event.kind === 'interstitial' && ['loaded', 'load_error', 'show', 'show_error', 'dismiss'].includes(event.phase))
        status = { ...status, interstitialLoaded: event.phase === 'loaded' };
      options.onEvent(event);
      if (['earned', 'receipt_pending', 'dismiss'].includes(event.phase)) void recoverEarned();
      if (event.phase === 'show') void recoverShown();
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
      if (!alive || !native || showing || options.activity.isBlocked()) return unavailable;
      options.onEvent({ kind: request.kind, phase: 'show_request', placement: request.placement });
      if (!status[request.kind]) { options.onEvent({ kind: request.kind, phase: 'unavailable', placement: request.placement }); return unavailable; }
      showing = true; options.activity.setBlocked('ad', true);
      try {
        await options.beforeShow({ ...request });
        if (!alive) return unavailable;
        const result = await native.show({ ...request });
        if (!result.shown) options.onEvent({ kind: request.kind, phase: result.outcome, placement: request.placement });
        if (result.shown) {
          // The earlier read may have started before the SDK callback.
          await shownFlight;
          await recoverShown();
        }
        return result;
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
