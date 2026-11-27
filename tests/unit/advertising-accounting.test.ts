import { expect, it } from 'vitest';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { eligibleAdBreak } from '../../src/domain/campaign-advertising';
import { freshSave } from '../../src/domain/engine';
import { claimShopCoins, offerQuote, prepareRewardOffer, selectedWinMultiplier } from '../../src/domain/reward-offers';
import { applyFullscreenShown, applyReceipt, type EarnedReceipt } from '../../src/domain/services';
import { decodeSave } from '../../src/platform/storage';

const deal = { ...content8Wave[0], id: 'advertising-accounting-level-16' };
function won(id: string) {
  const save = freshSave(deal, id);
  save.attempt.board = { ...deal.initial, tableau: deal.initial.tableau.map(() => []),
    stock: [], waste: [], faceUp: Object.keys(deal.cards), collected: Object.keys(deal.cards), phase: 'won', movesLeft: 5 };
  const rewardKey = 'win:' + id;
  save.profile.rewards.push(rewardKey);
  save.attempt.payout = [{ key: rewardKey, reason: 'win', coins: 75, label: 'Победа' }];
  save.attempt.victory = { version: 1, rewardKey, policy: 'test-source-components', tier: 2, tierBase: 50, movesBonus: 25,
    contentVersion: save.contentVersion, balanceVersion: save.balanceVersion };
  return save;
}

it.each([true, false])('applies P20 shown once independent of earned ordering (%s)', earnedFirst => {
  let save = won('first-win');
  const offer = prepareRewardOffer(save, deal, 'win-triple', 10_000, 'real-nonce', true, true)!;
  expect(offer.amount).toBe(100);
  const receipt: EarnedReceipt = {
    schema: 1, id: 'earned-proof', attempt: offer.id, dealId: deal.id, mode: 'campaign', placement: 'win-triple',
  };
  const shown = { ...receipt, id: 'actual-show', kind: 'rewarded' as const, shownAt: 20_000 };
  const before = save.profile.coins;
  if (earnedFirst) applyReceipt(save, receipt, { offerNow: 20_100 });
  save = decodeSave(JSON.stringify(save), deal);
  const unlinkedShow = { ...shown, id: 'unlinked-show', attempt: 'retired-quote', shownAt: 19_000 };
  expect(applyFullscreenShown(save, unlinkedShow)).toBe('applied');
  expect(save.platform!.lastFullscreenAt).toBe(19_000);
  applyReceipt(save, { ...receipt, id: 'unlinked-earn', attempt: unlinkedShow.attempt }, { offerNow: 19_100 });
  applyReceipt(save, { ...receipt, id: 'mismatched-earn', placement: 'win-fivefold' }, { offerNow: 19_100 });
  expect(save.profile.coins).toBe(before + (earnedFirst ? 100 : 0));
  expect(applyFullscreenShown(save, shown)).toBe('applied');
  expect(applyFullscreenShown(save, shown)).toBe('already-applied');
  expect(applyFullscreenShown(save, unlinkedShow)).toBe('already-applied');
  expect(save.platform!.lastFullscreenAt).toBe(20_000);
  expect(save.profile.coins).toBe(before + (earnedFirst ? 100 : 0));
  applyReceipt(save, receipt, { offerNow: 20_100 });
  expect(save.profile.coins).toBe(before + 100);
  save.attempt.board = structuredClone(deal.initial);
  save.attempt.telemetry = { started: true, finished: false, activeMs: 1 };
  expect(eligibleAdBreak(save, deal, 199_999, 0, true, true)).toBe(false);
  expect(eligibleAdBreak(save, deal, 200_000, 0, true, true)).toBe(true);
});

it('selects the third eligible win as x5 and freezes the choice at request, even without an impression', () => {
  const save = won('third-win');
  save.rewardOffers = { version: 1, pending: [], settledWins: [], freeAfter: 0, themeUntil: 0, definitions: 1,
    multiplier: { version: 1, eligible: 2, selected: {} } };
  expect(selectedWinMultiplier(save, deal)).toBe('win-fivefold');
  expect(prepareRewardOffer(save, deal, 'win-fivefold', 100, 'third-1', true, true)?.amount).toBe(200);
  expect(prepareRewardOffer(save, deal, 'win-fivefold', 200, 'third-2', true, true)?.amount).toBe(200);
  expect(save.rewardOffers.multiplier?.eligible).toBe(3);
});

it('gives free coins once offline and settles an authorized video across UTC midnight', () => {
  const save = freshSave(deal, 'shop');
  const midnight = 86_400_000;
  const before = save.profile.coins;
  expect(offerQuote(save, deal, 'shop-free-coins', midnight - 2, true)).toBeUndefined();
  expect(claimShopCoins(save, deal, midnight - 2)).toBe(true);
  expect(claimShopCoins(save, deal, midnight - 1)).toBe(false);
  const offer = prepareRewardOffer(save, deal, 'shop-free-coins', midnight - 1, 'older-day', true, true)!;
  expect(save.profile.coins).toBe(before + 30);
  expect(claimShopCoins(save, deal, midnight)).toBe(true);
  applyReceipt(save, { schema: 1, id: 'late-shop-receipt', attempt: offer.id,
    dealId: deal.id, placement: 'shop-free-coins', mode: 'campaign' }, { offerNow: midnight + 10 });
  expect(save.profile.coins).toBe(before + 90);
  expect(claimShopCoins(save, deal, midnight - 1)).toBe(false);
  expect(offerQuote(save, deal, 'shop-free-coins', midnight + 11, true)).toBeUndefined();
  expect(decodeSave(JSON.stringify(save), deal)).toEqual(save);
});
