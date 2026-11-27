import { describe, expect, it } from 'vitest';
import { quoteLayoutRetry, commitAdaptiveRetry } from '../../src/app/campaign-retry';
import { E4_M1, M1, M1_ID } from '../../src/config/economy';
import { campaignCoreDeals, campaignDeals, findDeal, layoutFingerprint, selectCampaignDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { bonusOffer, purchaseBonusSlot } from '../../src/domain/bonus-slots';
import { buyUnlimitedAccess, expireUnlimited, restoreCampaignStock, restoreQuote } from '../../src/domain/campaign-recovery';
import { applyBoard, dispatch, freshSave } from '../../src/domain/engine';
import { grantEventPrize, updatePreviewTasks } from '../../src/domain/events/daily-tasks';
import { ordinaryProgress } from '../../src/domain/ordinary-progress';
import { proveShuffle } from '../../src/game/shuffle-proof';
import { commitShuffle, type ShuffleRequest } from '../../src/domain/proof-shuffle';
import { buyRandomJokerAccess, placeRandomJoker, proveRandomJoker, randomJokerCount, settleRandomJoker } from '../../src/domain/random-joker';
import { claimShopCoins, offerQuote, prepareRewardOffer, selectedWinMultiplier, settleRewardOffer } from '../../src/domain/reward-offers';
import { switchMode } from '../../src/domain/sessions';
import type { Deal } from '../../src/domain/types';
import { decodeSave } from '../../src/platform/storage';
import { play, profileAt } from '../fixtures/functional-audit-225';

const roundTrip = (save: ReturnType<typeof freshSave>) => decodeSave(JSON.stringify(save), findDeal);
function atLevel(level: number) {
  const base = campaignDeals[level - 1], save = profileAt(base, 'm1-fixture');
  const deal = selectCampaignDeal(save, base);
  save.attempt = freshSave(deal, 'm1-entry').attempt;
  return { base, deal, save };
}

describe.skipIf(!E4_M1)('ordinary E4-M1 economy', () => {
  it.each([17, 18, 19, 24, 26, 27, 28, 32])('rotates three certified Rules4 geometries after the L%i demonstration at every penalty', level => {
    for (const penalty of [-5, 0, 10]) {
      const { save, deal } = atLevel(level);
      expect(deal.initial.rulesVersion).not.toBe(4);
      save.difficultyPenalty = penalty;
      const layouts = new Set<string>();
      for (let turn = 1; turn <= 3; turn++) {
        save.attempt.board = { ...save.attempt.board, phase: 'exhausted', movesLeft: 0 };
        const quote = quoteLayoutRetry(save)!;
        expect(quote.selected.initial.rulesVersion).toBe(4);
        expect(commitAdaptiveRetry(save, quote, 'm1-rotation-' + turn, 2000, quoteLayoutRetry)).toBe('started');
        layouts.add(layoutFingerprint(quote.selected));
      }
      expect(layouts.size).toBe(3);
      expect(roundTrip(save).attempt.dealId).toBe(save.attempt.dealId);
    }
  });

  it('banks only first-clear Combo, repeats its final rung and cannot create coins by retrying a prefix', () => {
    const { save, deal } = atLevel(16);
    let next = save;
    for (let attempt = 0; attempt < 7; attempt++) {
      next = play(next, deal, deal.winningPath.slice(0, -1));
      expect(next.profile.coins).toBe(save.profile.coins);
      expect(next.attempt.combo?.pending).toBeGreaterThan(0);
      expect(next.attempt.combo?.stage).toBe(4);
      expect(roundTrip(next).attempt.combo).toEqual(next.attempt.combo);
      next = dispatch(next, { type: 'restart', attemptId: 'm1-farm-' + attempt }, deal).next;
      expect(next.attempt.combo?.pending).toBe(0);
    }
    const won = play(next, deal, deal.winningPath);
    const base = won.attempt.victory!;
    expect(base.policy).toBe(M1_ID);
    expect(base.movesBonus).toBe((won.attempt.board.movesLeft ?? 0) * 5);
    const combo = won.attempt.payout?.find(row => row.reason === 'campaign_combo')!;
    expect(combo.coins).toBeGreaterThan(2 + 4 + 7 + 10 + 15);
    expect(won.attempt.combo?.pending).toBe(0);
    const replay = dispatch(won, { type: 'restart', attemptId: 'm1-replayed' }, deal).next;
    expect(play(replay, deal, deal.winningPath).profile.coins).toBe(won.profile.coins);
  }, 45_000);

  it('pays the wallet and tier-only video exactly once and retains a frozen old quote across migration', () => {
    const { save, deal } = atLevel(6);
    const won = play(save, deal, deal.winningPath);
    const time = Date.UTC(2026, 10, 27);
    expect(claimShopCoins(won, deal, time, true)).toBe(true);
    expect(claimShopCoins(won, deal, time, true)).toBe(false);
    const shop = prepareRewardOffer(won, deal, 'shop-free-coins', time, 'wallet-m1', true, true)!;
    expect(shop.amount).toBe(M1.videoWallet);
    const previous = roundTrip(won);
    const receipt = { attempt: shop.id, dealId: deal.id, placement: shop.kind, mode: 'campaign' as const };
    expect(settleRewardOffer(previous, receipt, time)).toBe(true);
    expect(settleRewardOffer(previous, receipt, time)).toBe(false);
    expect(previous.rewardOffers?.freeAfter).toBe(time + M1.videoWalletGapMs);
    expect(offerQuote(previous, deal, 'shop-free-coins', time + M1.videoWalletGapMs, true)).toBeUndefined();
    const kind = selectedWinMultiplier(previous, deal)!;
    const quote = prepareRewardOffer(previous, deal, kind, time, 'win-m1', true, true)!;
    expect(quote.amount).toBe(2 * previous.attempt.victory!.tierBase);
    const restored = roundTrip(previous);
    expect(settleRewardOffer(restored, { attempt: quote.id, dealId: deal.id, placement: kind, mode: 'campaign' }, time)).toBe(true);

    const old = profileAt(findDeal('campaign-c8-wave-016-c8-core-r1-rights-r1')!);
    old.balanceVersion = 3;
    old.rewardOffers = { version: 1, pending: [{ id: 'old-quote', dealId: old.attempt.dealId, kind: 'shop-free-coins',
      at: time, amount: 30, key: 'shop' }], definitions: 1, settledWins: [], freeAfter: 0, themeUntil: 0 };
    const migrated = roundTrip(old), coins = migrated.profile.coins;
    expect(migrated.balanceVersion).toBe(4);
    expect(settleRewardOffer(migrated, { attempt: 'old-quote', dealId: old.attempt.dealId, placement: 'shop-free-coins', mode: 'campaign' }, time)).toBe(true);
    expect(migrated.profile.coins - coins).toBe(30);
  });

  it('restores a committed recycle charge and its count once across Undo, Daily and reload', () => {
    const layout = [...campaignCoreDeals()].find(entry => entry.deal.campaignLevel === 16 && entry.deal.recovery && !entry.penalty)!;
    const deal = findDeal(layout.deal.id + '-m1')!;
    let save = profileAt(deal);
    save.profile.coins = 500;
    save.attempt.board.movesLeft = 500;
    const drain = () => {
      while (save.attempt.board.stock.length) save = play(save, deal, [{ type: 'draw' }]);
    };
    while (save.attempt.board.recyclesLeft) { drain(); save = play(save, deal, [{ type: 'recycle' }]); }
    drain();
    expect(restoreCampaignStock(save, deal, { attemptId: save.attempt.id, revision: save.revision, cost: 0 })).toBe(true);
    drain();
    const before = structuredClone(save);
    expect(restoreQuote(save.attempt, deal)).toBe(100);
    expect(restoreCampaignStock(save, deal, { attemptId: save.attempt.id, revision: save.revision, cost: 100 })).toBe(true);
    expect(save.profile.coins).toBe(before.profile.coins - 100);
    const historical = structuredClone(save);
    delete historical.attempt.restoreUndo;
    expect(dispatch(historical, { type: 'undo' }, deal).next.profile.coins).toBe(historical.profile.coins);
    switchMode(save, 'daily', dailyForDay('2026-11-27'), 'e4-daily');
    save = roundTrip(save);
    switchMode(save, 'campaign', deal, 'e4-resume');
    const undone = dispatch(save, { type: 'undo' }, deal);
    expect(undone.next.profile.coins).toBe(before.profile.coins);
    expect(undone.next.attempt.stockRestores).toBe(before.attempt.stockRestores);
    expect(undone.next.attempt.board).toEqual(before.attempt.board);
    expect(undone.events).toContainEqual({ type: 'undo', amount: 100 });
    expect(dispatch(undone.next, { type: 'undo' }, deal).next.profile.coins).toBe(before.profile.coins);
  });

  it('keeps both slots, a separate early Joker and a timed right under the ordinary policy', () => {
    const { save, deal } = atLevel(6);
    save.profile.coins = 2000;
    for (const kind of ['tableau', 'foundation'] as const) {
      expect(bonusOffer(deal, kind)?.coins).toBe(500);
      expect(purchaseBonusSlot(save, deal, save.attempt.id, kind)).toBe(true);
      expect(purchaseBonusSlot(save, deal, save.attempt.id, kind)).toBe(false);
    }
    const early = atLevel(2);
    early.save.profile.coins = 2000;
    expect(buyRandomJokerAccess(early.save, early.deal, 'early-paid-joker', 1000)).toBe(true);
    expect(early.save.profile.coins).toBe(1700);
    expect(randomJokerCount(roundTrip(early.save))).toBe(1);
    expect(dispatch(early.save, { type: 'place-joker', column: 0 }, early.deal).accepted).toBe(true);
    expect(randomJokerCount(early.save)).toBe(1);
    expect(buyUnlimitedAccess(early.save, early.deal, 'early-time', 1000)).toBe(true);
    expect(roundTrip(early.save).attempt.board.movesLeft).toBeNull();
    expireUnlimited(early.save, 61_001);
    expect(early.save.attempt.board.movesLeft).toBe(early.deal.initial.movesLeft);
  });

  it('charges Shuffle and Random Joker only after a fresh proof on the current issue', () => {
    const { save, deal } = atLevel(2);
    save.profile.coins = 1000;
    expect(buyRandomJokerAccess(save, deal, 'proof-paid-joker', 1000)).toBe(true);
    let joker = save;
    let verified = false;
    for (let step = 0; step < deal.winningPath.length && !verified; step++) {
      for (let column = 0; column < Math.min(5, joker.attempt.board.tableau.length) && !verified; column++) {
        const placed = placeRandomJoker(joker.attempt, deal, () => column, () => 'azj-stage2');
        if (!placed) continue;
        const request = { attemptId: joker.attempt.id, revision: joker.revision, column, id: 'azj-stage2' };
        expect(settleRandomJoker(joker, deal, { ...request, path: [] })).toBe(false);
        const route = proveRandomJoker(placed, deal, performance.now() + 220);
        if (!route?.length) continue;
        expect(settleRandomJoker(joker, deal, { ...request, path: route, revision: joker.revision - 1 })).toBe(false);
        verified = settleRandomJoker(joker, deal, { ...request, path: route });
      }
      if (!verified) joker = play(joker, deal, [deal.winningPath[step]]);
    }
    expect(verified).toBe(true);
    expect(randomJokerCount(joker)).toBe(0);

    const shuffled = atLevel(2);
    const state = shuffled.save;
    // The ordinary supplies grant the exact inventory field shared with Tasks.
    updatePreviewTasks(state, Date.UTC(2026, 10, 27));
    expect(grantEventPrize(state, { kind: 'Shuffle', quantity: 1 })).toBe(true);
    let accepted = false;
    for (let seed = 0; seed < 12 && !accepted; seed++) {
      const quote: ShuffleRequest = { attemptId: state.attempt.id, dealId: shuffled.deal.id, revision: state.revision,
        board: state.attempt.board, deal: shuffled.deal, seed };
      const path = proveShuffle(quote);
      if (!path) continue;
      expect(commitShuffle(state, shuffled.deal, { ...quote, revision: quote.revision - 1 }, path)).toBe(false);
      expect(state.dailyTasks?.inventory.shuffles).toBe(1);
      accepted = commitShuffle(state, shuffled.deal, quote, path);
    }
    expect(accepted).toBe(true);
    expect(roundTrip(state).dailyTasks?.inventory.shuffles).toBe(0);
  }, 45_000);

  it('separates useful play, stock loops and an inconclusive search', () => {
    const deal: Deal = { id: 'm1-stock-loop', title: 'loop', version: 1, editorialStatus: 'approved', cards: {
      a: { id: 'a', category: 'a', text: 'a', leader: true, explanation: '' }, b: { id: 'b', category: 'b', text: 'b', leader: true, explanation: '' },
      c: { id: 'c', category: 'c', text: 'c', leader: true, explanation: '' },
      x: { id: 'x', category: 'a', text: 'x', leader: false, explanation: '' },
    }, initial: { rulesVersion: 3, phase: 'playing', foundations: [[]], tableau: [['a']], faceUp: ['a'],
      stock: ['b', 'c', 'x'], waste: [], collected: [], movesLeft: null }, winningPath: [] };
    const stranded = { ...deal.initial, foundations: [['a']], tableau: [['x', 'b']], stock: ['c'], faceUp: ['a', 'b'] };
    expect(ordinaryProgress(deal.initial, deal)).toBe('reachable');
    expect(typeof applyBoard(stranded, { type: 'draw' }, deal)).toBe('object');
    expect(ordinaryProgress(stranded, deal)).toBe('stuck');
    expect(ordinaryProgress(stranded, deal, 1)).toBe('unknown');
  });
});
