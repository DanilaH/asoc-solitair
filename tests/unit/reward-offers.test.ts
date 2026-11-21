import { expect, it } from 'vitest';
import { BALANCE } from '../../src/domain/balance';
import { dispatch, freshSave } from '../../src/domain/engine';
import { applyReceipt, useContinue } from '../../src/domain/services';
import { offerQuote, prepareRewardOffer, revealRelatedWord, validRewardOffers } from '../../src/domain/reward-offers';
import { cardReader } from '../../src/game/card-reader';
import { loadLoss, recoverable, winningRescue } from '../fixtures/content8-loss';

function win() {
  let save = loadLoss(recoverable, 'win-offers');
  applyReceipt(save, { schema: 1, placement: 'continue', id: 'credit', attempt: 'no-match', dealId: recoverable.id, mode: 'campaign' });
  expect(useContinue(save, { attemptId: save.attempt.id, deal: recoverable, path: winningRescue })).toBe(true);
  for (const move of winningRescue) save = dispatch(save, move, recoverable).next;
  return save;
}

it('quotes separate rewards, preserves the baseline and commits one canonical earned delta after reload', () => {
  const save = win(), base = BALANCE.winCoins;
  const quote = (kind: Parameters<typeof offerQuote>[2]) => offerQuote(save, recoverable, kind, 100)?.amount;
  expect([quote('win-double'), quote('win-triple'), quote('win-fivefold'), quote('win-flat')]).toEqual([base, 2 * base, 4 * base, 20]);
  const pending = prepareRewardOffer(save, recoverable, 'win-fivefold', 100, 'source-id')!;
  const overlap = prepareRewardOffer(save, recoverable, 'win-double', 100, 'other-source')!;
  expect(prepareRewardOffer(save, recoverable, 'win-fivefold', 101, 'retry-id')).toBe(pending);
  expect(save.profile.coins).toBe(base + BALANCE.initialCoins + save.attempt.streak.coins);
  const reloaded: typeof save = JSON.parse(JSON.stringify(save)), oldCoins = reloaded.profile.coins;
  expect(validRewardOffers(reloaded.rewardOffers!)).toBe(true);
  const receipt = { schema: 1, id: 'earned-id', placement: 'win-fivefold', attempt: pending.id,
    dealId: recoverable.id, mode: 'campaign' } as const;
  applyReceipt(reloaded, { ...receipt, id: 'wrong', attempt: 'invalid' }, { offerNow: 200 });
  expect(reloaded.profile.coins).toBe(oldCoins);
  reloaded.attempt = freshSave(recoverable, 'new-attempt').attempt;
  applyReceipt(reloaded, receipt, { offerNow: 200 });
  expect(reloaded.profile.coins).toBe(oldCoins + 4 * base);
  expect(applyReceipt(reloaded, receipt, { offerNow: 250 })).toBe('already-applied');
  applyReceipt(reloaded, { ...receipt, id: 'late-other', attempt: overlap.id, placement: overlap.kind }, { offerNow: 300 });
  expect(reloaded.profile.coins).toBe(oldCoins + 4 * base);
  expect(reloaded.rewardOffers?.settledWins).toHaveLength(1);

  const replay = win();
  replay.rewardOffers = reloaded.rewardOffers;
  expect(offerQuote(replay, recoverable, 'win-double', 300)).toBeUndefined();
});

it('keeps a separate timed theme and shop entitlement with durable receipts', () => {
  const save = freshSave(recoverable, 'shop');
  const offer = prepareRewardOffer(save, recoverable, 'shop-free-coins', 100, 'shop-id')!;
  const theme = prepareRewardOffer(save, recoverable, 'rewarded-theme', 100, 'theme-id')!;
  expect(save.profile.coins).toBe(BALANCE.initialCoins);
  applyReceipt(save, { schema: 1, id: 'shop-earned', placement: offer.kind,
    attempt: offer.id, dealId: offer.dealId, mode: 'campaign' }, { offerNow: 200 });
  applyReceipt(save, { schema: 1, id: 'theme-earned', placement: theme.kind,
    attempt: theme.id, dealId: theme.dealId, mode: 'campaign' }, { offerNow: 300 });
  expect(save.profile.coins).toBe(BALANCE.initialCoins + 30);
  expect(offerQuote(save, recoverable, 'shop-free-coins', 86_400_199)).toBeUndefined();
  expect(offerQuote(save, recoverable, 'shop-free-coins', 86_400_200)?.amount).toBe(30);
  expect(offerQuote(save, recoverable, 'rewarded-theme', 86_400_299)).toBeUndefined();
  expect(offerQuote(save, recoverable, 'rewarded-theme', 86_400_300)?.amount).toBe(0);
});

it('spends only the optional word charge and leaves card reading, move budget and balance available', () => {
  const save = freshSave(recoverable, 'word');
  const pair = Object.values(recoverable.cards).filter(value => value.category === Object.values(recoverable.cards)[0].category);
  const leader = pair.find(value => value.leader)!, member = pair.find(value => !value.leader)!;
  save.attempt.board.faceUp = [leader.id];
  expect(revealRelatedWord(save, recoverable, leader.id)).toBeUndefined();
  expect(save.rewardOffers).toBeUndefined();
  save.attempt.board.faceUp.push(member.id);
  const before = structuredClone(save);
  expect(revealRelatedWord(save, recoverable, leader.id)).toBe(member.text);
  expect(revealRelatedWord(save, recoverable, leader.id)).toBeUndefined();
  expect(save.rewardOffers?.definitions).toBe(0);
  expect(save.attempt).toEqual(before.attempt);
  expect(save.profile).toEqual(before.profile);
  expect(cardReader(leader, recoverable).title).toBe(leader.text);
});
