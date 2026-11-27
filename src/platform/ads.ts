import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { DurableReceiptQueue, type ReceiptCommitResult, type GameplayActivityCoordinator } from '@danilah/mini-games-kit/platform';
import type { NativeBannerPlacement, NativeBannerPlacementInput } from '@danilah/mini-games-kit/layout';
import { parseFullscreenShown, parseReceipt, type EarnedReceipt, type FullscreenShown, type AdPlacement } from '../domain/services';

export interface AdRequest { kind: 'rewarded' | 'interstitial'; placement: AdPlacement; attempt: string; dealId: string; mode: 'campaign' | 'daily' }
export interface AdOutcome { shown: boolean; terminalNoReward?: true; pendingTerminal?: true; outcome: 'dismissed' | 'unavailable' | 'error' | 'cancelled' }
export interface AdStatus { rewarded: boolean; interstitial: boolean; banner: boolean; mode: string; ready?: boolean; interstitialLoaded?: boolean; campaignApproved?: boolean; livesApproved?: boolean; offersApproved?: boolean }
export interface AdEvent { kind: 'rewarded' | 'interstitial' | 'banner'; phase: string; placement?: string }
interface PendingLife { id: string; dealId: string }
export interface AdsBridge {
  status(): Promise<AdStatus>;
  prepareInterstitial(): Promise<void>;
  discardInterstitial?(): Promise<void>;
  show(request: AdRequest): Promise<AdOutcome>;
  fullscreenState?(): Promise<{ foreground: boolean; session: 'idle' | 'active' | 'awaiting-terminal'; shown: boolean }>;
  pending(): Promise<{ receipts: unknown[]; activeLife?: PendingLife | null }>;
  acknowledge(options: { id: string }): Promise<void>;
  rewardOfferIdle?(): Promise<{ idle: boolean }>;
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
const unavailable: AdOutcome = { shown: false, outcome: 'unavailable', terminalNoReward: true };
const SHOWN_CHECK_MS = 1500;
const TERMINAL_CHECK_MS = 1600;

async function withinShownCheck<T>(work: Promise<T>): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<undefined>(resolve => {
      timer = setTimeout(() => resolve(undefined), SHOWN_CHECK_MS);
    })]);
  } finally { clearTimeout(timer); }
}
/** No web mocks; injected bridges exist solely as ordinary unit-test constructor dependencies. */
export function createAds(options: {
  activity: Pick<GameplayActivityCoordinator, 'setBlocked' | 'isBlocked'>;
  commit(receipt: EarnedReceipt): Promise<ReceiptCommitResult>;
  commitShown(shown: FullscreenShown): Promise<ReceiptCommitResult>;
  beforeShow(request: AdRequest): Promise<void>;
  pendingLife?(): PendingLife | undefined;
  retireLife?(request: PendingLife): Promise<void>;
  pendingOffer?(): string | undefined;
  retireOffer?(id: string): Promise<void>;
  onStatus(status: AdStatus): void;
  onEvent(event: AdEvent): void;
}, bridge?: AdsBridge) {
  const native = bridge ?? (Capacitor.isNativePlatform() ? registerPlugin<AdsBridge>('SolitaireAds') : undefined);
  let alive = true, showing = false, nativeNeedsTerminal = false;
  let retryDelay = 1000;
  let interstitialEpoch = 0, readinessRevision = 0;
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
      const record = await withinShownCheck(native.pendingShown());
      if (!alive || !record) return false;
      if (record.shown !== null) await shownQueue.deliver(parseFullscreenShown(record.shown));
      return true;
    })().catch(() => false).finally(() => { shownFlight = undefined; });
    return shownFlight;
  }
  async function recover(): Promise<void> {
    await Promise.all([recoverEarned(), recoverShown()]);
  }
  async function nativeCanShow() {
    if (!nativeNeedsTerminal) return true;
    if (!native?.fullscreenState) return false;
    const state = await withinShownCheck(native.fullscreenState()).catch(() => undefined);
    if (state?.foreground && state.session === 'idle') nativeNeedsTerminal = false;
    return !nativeNeedsTerminal;
  }
  async function showUntilForeground(request: AdRequest): Promise<AdOutcome> {
    const result = native!.show(request);
    if (!native?.fullscreenState) return result;
    let done = false, timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([result, new Promise<AdOutcome>(resolve => {
        const check = async () => {
          if (done) return;
          if (!alive) { resolve({ shown: false, outcome: 'cancelled' }); return; }
          const state = await withinShownCheck(native.fullscreenState!()).catch(() => undefined);
          if (done) return;
          if (state?.foreground && (state.session === 'idle' || state.session === 'awaiting-terminal')) {
            // An observation of the activity cannot serve as a reward or a
            // terminal no-reward answer for a persisted offer.
            resolve({ shown: state.shown === true, outcome: 'error', ...(state.session !== 'idle' && { pendingTerminal: true }) });
          } else timer = setTimeout(() => { void check(); }, TERMINAL_CHECK_MS);
        };
        timer = setTimeout(() => { void check(); }, TERMINAL_CHECK_MS);
      })]);
    } finally { done = true; clearTimeout(timer); }
  }
  async function reconcileOffer(): Promise<boolean> {
    const offer = options.pendingOffer?.();
    if (!offer) return true;
    if (!alive || !native?.rewardOfferIdle || showing) return false;
    // Both journals are consulted on the same native handler. An unavailable
    // snapshot cannot establish that a persisted authorization is terminal.
    try {
      await withinShownCheck(recover());
      const status = await withinShownCheck(native.rewardOfferIdle());
      if (alive && !showing && status?.idle && options.pendingOffer?.() === offer) await options.retireOffer?.(offer);
    } catch { /* Preserve the quote for the next foreground/recovery attempt. */ }
    return options.pendingOffer?.() === undefined;
  }
  function refresh(): Promise<void> {
    if (!alive || !native) return Promise.resolve();
    if (statusFlight) return statusFlight;
    const revision = readinessRevision;
    statusFlight = native.status().then(value => {
      if (!alive) return;
      if (revision === readinessRevision) {
        if (value.interstitialLoaded && !status.interstitialLoaded) interstitialEpoch++;
        status = value;
      } else status = { ...value, interstitialLoaded: status.interstitialLoaded };
      options.onStatus({ ...status });
    }).catch(() => undefined).finally(() => { statusFlight = undefined; });
    return statusFlight;
  }
  if (native) {
    void native.addListener('adEvent', event => {
      if (!alive) return;
      if (event.kind === 'interstitial' && ['loaded', 'load_error', 'show', 'show_error', 'dismiss', 'discarded'].includes(event.phase)) {
        readinessRevision++;
        if (event.phase === 'loaded') interstitialEpoch++;
        status = { ...status, interstitialLoaded: event.phase === 'loaded' };
      }
      if (event.phase === 'initialized') void refresh();
      options.onEvent(event);
      if (['earned', 'receipt_pending', 'dismiss'].includes(event.phase)) void recoverEarned();
      if (event.phase === 'show') void recoverShown();
    }).then(handle => { if (!alive) void handle.remove().catch(() => undefined); else { listener = handle; void refresh(); } }).catch(() => undefined);
    void refresh(); void recover(); schedule();
  }
  return {
    get status() { return status; },
    get bridge() { return native; },
    get showing() { return showing; },
    get interstitialEpoch() { return interstitialEpoch; },
    async discardInterstitial() {
      readinessRevision++;
      status = { ...status, interstitialLoaded: false };
      if (native?.discardInterstitial) await withinShownCheck(native.discardInterstitial()).catch(() => undefined);
    },
    refresh, recover,
    async canAuthorizeOffer() {
      if (!alive || !native || !status.rewarded || showing) return false;
      return await nativeCanShow() && Boolean(await withinShownCheck(recoverShown())) && await reconcileOffer();
    },
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
      showing = true;
      let ownsActivity = false, enteredNative = false;
      try {
        // Resolve any persisted display before re-evaluating product cooldown.
        // The game stays available throughout the journal preflight.
        if (!await nativeCanShow() || !await withinShownCheck(recoverShown()) || !alive || options.activity.isBlocked()) return unavailable;
        ownsActivity = true;
        options.activity.setBlocked('ad', true);
        await options.beforeShow({ ...request });
        if (!alive) return unavailable;
        enteredNative = true;
        const result = await showUntilForeground({ ...request });
        if (result.pendingTerminal) nativeNeedsTerminal = true;
        if (!result.shown) options.onEvent({ kind: request.kind, phase: result.outcome, placement: request.placement });
        if (result.shown) {
          // The earlier read may have started before the SDK callback.
          await withinShownCheck((async () => {
            await shownFlight;
            await recoverShown();
          })());
        }
        return result;
      } catch { return { shown: false, outcome: 'error', ...(!enteredNative && { terminalNoReward: true as const }) }; }
      finally {
        showing = false;
        if (ownsActivity) options.activity.setBlocked('ad', false);
        if (alive) void recover();
      }
    },
    destroy() {
      if (!alive) return; alive = false;
      clearTimeout(retry); void listener?.remove().catch(() => undefined);
      void native?.dispose().catch(() => undefined);
    },
  };
}
