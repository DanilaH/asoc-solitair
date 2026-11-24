import { describe, expect, it, vi } from 'vitest';
import { GameplayActivityCoordinator, type StorageAdapter } from '@danilah/mini-games-kit/platform';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { authorizeLifeVideo, cancelLifeVideo, mayStartCampaignAttempt, refreshCampaignLives } from '../../src/domain/campaign-lives';
import { dispatch, freshSave } from '../../src/domain/engine';
import { applyReceipt, type EarnedReceipt } from '../../src/domain/services';
import { createAds, type AdsBridge } from '../../src/platform/ads';
import { SaveStore } from '../../src/platform/storage';

const deal = content8Wave[0];
const now = 1_000_000;
function reachableTwoLives() {
  let save = freshSave(deal, 'life-before-loss');
  while (save.attempt.board.phase === 'playing') {
    const result = dispatch(save, { type: save.attempt.board.stock.length ? 'draw' : 'recycle' }, deal);
    expect(result.accepted).toBe(true);
    save = result.next;
  }
  expect(save.attempt.board.phase).toBe('exhausted');
  expect(mayStartCampaignAttempt(save, save.attempt, now, true)).toBe(true);
  save = dispatch(save, { type: 'restart', attemptId: 'life-restarted' }, deal).next;
  expect(save.campaignLives?.remaining).toBe(2);
  return save;
}
function memory() {
  let raw: string | null = null;
  const adapter: StorageAdapter = {
    getItem: async () => raw,
    setItem: async (_key, value) => { raw = value; },
    removeItem: async () => { raw = null; },
  };
  return { adapter };
}

describe('life rewarded recovery', () => {
  it.each(['native-read', 'save-before-commit', 'save-after-commit'] as const)('preserves an earned life through %s failure before UI cancellation', async failure => {
    const mem = memory();
    const store = new SaveStore(mem.adapter, deal, reachableTwoLives);
    await store.open();
    const id = 'life-authorized';
    await store.mutate(next => authorizeLifeVideo(next, now, id, true));
    const earned: EarnedReceipt = { schema: 1, id: 'native-life-earned', attempt: id, dealId: deal.id, mode: 'campaign', placement: 'life-refill' };
    let receipt: EarnedReceipt | undefined;
    let unavailable = false;
    const originalWrite = mem.adapter.setItem;
    mem.adapter.setItem = async (key, value) => {
      if (failure === 'save-before-commit' && unavailable && JSON.parse(value).campaignLives.remaining === 3)
        throw Error('temporary native save I/O failure before commit');
      await originalWrite(key, value);
      if (failure === 'save-after-commit' && unavailable && JSON.parse(value).campaignLives.remaining === 3)
        throw Error('lost native response after successful disk commit');
    };
    const acknowledge = vi.fn(async () => { receipt = undefined; });
    const api: AdsBridge = {
      status: async () => ({ rewarded: true, interstitial: false, banner: false, mode: 'test', ready: true }),
      prepareInterstitial: async () => undefined,
      show: async () => { receipt = earned; unavailable = true; return { shown: true, outcome: 'dismissed' }; },
      pending: async () => {
        if (failure === 'native-read' && unavailable) throw Error('temporary earned journal I/O failure');
        return { receipts: receipt ? [receipt] : [], activeLife: null };
      },
      acknowledge,
      pendingShown: async () => ({ shown: null }), acknowledgeShown: async () => undefined,
      cancelPending: async () => undefined, measureBanner: async () => null,
      placeBanner: async () => undefined, hideBanner: async () => undefined, dispose: async () => undefined,
      addListener: async () => ({ remove: async () => undefined }),
    };
    let uiOwnsRequest = true;
    const ads = createAds({
      pendingLife: () => uiOwnsRequest ? undefined : store.state.campaignLives?.pending,
      async retireLife(request) { await store.mutate(next => cancelLifeVideo(next, request.id)); },
      activity: new GameplayActivityCoordinator(() => undefined, () => undefined),
      beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined,
      commit: value => store.mutate(next => applyReceipt(next, value)),
      commitShown: async () => 'already-applied',
    }, api);
    try {
      await ads.refresh(); await ads.recover();
      await ads.show({ kind: 'rewarded', mode: 'campaign', placement: 'life-refill', attempt: id, dealId: deal.id });
      await ads.recover();
      expect(store.state.campaignLives?.remaining).toBe(failure === 'save-after-commit' ? 3 : 2);
      expect(receipt).toEqual(failure === 'save-after-commit' ? undefined : earned);
      if (receipt) expect(store.state.campaignLives?.pending?.id).toBe(id);
      uiOwnsRequest = false; unavailable = false;
      await ads.recover();
      expect(acknowledge).toHaveBeenCalledTimes(1);
      expect(receipt).toBeUndefined();
      expect(store.state.campaignLives?.remaining, 'earned life must survive transient receipt/save failure').toBe(3);
    } finally { ads.destroy(); }
  });

  it('recovers a request persisted immediately before process termination, so later life videos remain usable', async () => {
    const mem = memory();
    const first = new SaveStore(mem.adapter, deal, reachableTwoLives);
    await first.open();
    expect(await first.mutate(next => authorizeLifeVideo(next, now, 'before-process-kill', true))).toBe(true);
    // Process stops after authorizing but before native.show. No receipt exists to settle it.
    const reopened = new SaveStore(mem.adapter, deal, () => { throw Error('must reopen existing save'); });
    await reopened.open();
    let activeLife: { id: string; dealId: string } | null = { id: 'before-process-kill', dealId: deal.id };
    let failRead = true;
    const api: AdsBridge = {
      status: async () => ({ rewarded: true, interstitial: false, banner: false, mode: 'test' }),
      prepareInterstitial: async () => undefined,
      show: async () => ({ shown: false, outcome: 'cancelled' }),
      pending: async () => {
        if (failRead) throw Error('Temporary journal read failure');
        return { receipts: [], activeLife };
      },
      acknowledge: async () => undefined, pendingShown: async () => ({ shown: null }), acknowledgeShown: async () => undefined,
      cancelPending: async () => undefined, measureBanner: async () => null, placeBanner: async () => undefined,
      hideBanner: async () => undefined, dispose: async () => undefined, addListener: async () => ({ remove: async () => undefined }),
    };
    const ads = createAds({
      activity: new GameplayActivityCoordinator(() => undefined, () => undefined),
      beforeShow: async () => undefined, onStatus: () => undefined, onEvent: () => undefined,
      commit: value => reopened.mutate(next => applyReceipt(next, value, { offerNow: now })),
      commitShown: async () => 'already-applied',
      pendingLife: () => reopened.state.campaignLives?.pending,
      async retireLife(request) { await reopened.mutate(next => cancelLifeVideo(next, request.id)); },
    }, api);
    try {
      await ads.recover();
      expect(reopened.state.campaignLives?.pending?.id).toBe('before-process-kill');
      failRead = false;
      await ads.recover();
      expect(reopened.state.campaignLives?.pending?.id).toBe('before-process-kill');
      activeLife = null;
      await ads.recover();
      expect(reopened.state.campaignLives?.pending).toBeUndefined();
      expect(reopened.state.campaignLives?.remaining).toBe(2);
      expect(await reopened.mutate(next => authorizeLifeVideo(next, now + 1, 'next-life-video', true))).toBe(true);
    } finally { ads.destroy(); }
  });

  it('retains earned credit when the refill deadline passes during the video, independently of interval ordering', () => {
    const before = reachableTwoLives();
    const deadline = before.campaignLives!.refillAt!;
    expect(authorizeLifeVideo(before, deadline - 1_000, 'near-refill-deadline', true)).toBe(true);
    const earned: EarnedReceipt = { schema: 1, id: 'after-deadline-earned', attempt: 'near-refill-deadline',
      dealId: deal.id, mode: 'campaign', placement: 'life-refill' };
    const intervalFirst = structuredClone(before), receiptFirst = structuredClone(before);
    refreshCampaignLives(intervalFirst, deadline + 1_000);
    applyReceipt(intervalFirst, earned, { offerNow: deadline + 1_000 });
    applyReceipt(receiptFirst, earned, { offerNow: deadline + 1_000 });
    refreshCampaignLives(receiptFirst, deadline + 1_000);
    expect(intervalFirst.campaignLives?.remaining).toBe(3);
    expect(intervalFirst.campaignLives?.earnedCredits).toBe(1);
    expect(receiptFirst.campaignLives?.remaining).toBe(3);
    expect(receiptFirst.campaignLives?.earnedCredits,
      'natural refill and a genuinely earned life must both survive foreground callback ordering').toBe(1);
    expect(receiptFirst).toEqual(intervalFirst);
    expect(applyReceipt(receiptFirst, { ...earned, id: 'redelivered' }, { offerNow: deadline - 5000 })).toBe('already-applied');
    expect(receiptFirst.campaignLives?.earnedCredits).toBe(1);
  });
});
