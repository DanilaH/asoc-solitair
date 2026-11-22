import { expect, it } from 'vitest';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { authorizeCoffee, cancelCoffee, eligibleAdBreak, recordAdRevenue } from '../../src/domain/campaign-advertising';
import { freshSave } from '../../src/domain/engine';
import { applyFullscreenShown, applyReceipt, parseFullscreenShown } from '../../src/domain/services';

it('requires native approval, waits for idle and counts only the confirmed display', () => {
  const deal = content8Wave[0], save = freshSave(deal, 'approved-ads'), now = 200_000;
  save.attempt.telemetry = { started: true, finished: false, activeMs: 1 };
  expect(eligibleAdBreak(save, deal, now, 0, false, true)).toBe(false);
  expect(eligibleAdBreak(save, deal, now, 0, true, false)).toBe(false);
  expect(eligibleAdBreak(save, deal, now, 0, true, true)).toBe(true);
  expect(save.campaignAds).toBeUndefined();
  const shown = parseFullscreenShown({ schema: 1, id: 'source-shown', attempt: save.attempt.id, dealId: deal.id,
    kind: 'interstitial', mode: 'campaign', placement: 'ads-break', shownAt: now });
  expect(applyFullscreenShown(save, shown, 16)).toBe('applied');
  expect(applyFullscreenShown(save, shown, 16)).toBe('already-applied');
  expect(save.campaignAds?.shownLevels).toEqual([16]);
  expect(eligibleAdBreak(save, deal, now * 3, 0, true, true)).toBe(false);
});

it('does not grant on a request or no-fill, deduplicates earned coffee and keeps paid data separate', () => {
  const deal = content8Wave[0], save = freshSave(deal, 'coffee'), before = save.profile.coins;
  expect(authorizeCoffee(save, deal, false)).toBe(false);
  expect(authorizeCoffee(save, deal, true)).toBe(true);
  expect(save.profile.coins).toBe(before);
  cancelCoffee(save, save.attempt.id, deal.id);
  expect(save.profile.coins).toBe(before);
  expect(authorizeCoffee(save, deal, true)).toBe(true);
  const receipt = { schema: 1, id: 'native-earned', attempt: save.attempt.id, dealId: deal.id,
    mode: 'campaign', placement: 'coffee-break' } as const;
  expect(applyReceipt(save, receipt)).toBe('applied');
  expect(applyReceipt(save, receipt)).toBe('already-applied');
  expect(save.profile.coins).toBe(before + 10);
  expect(recordAdRevenue(save, {id: 'native-paid', currency: 'RUB', kind: 'rewarded', micros: 12})).toBe(true);
  expect(recordAdRevenue(save, {id: 'native-paid', currency: 'RUB', kind: 'rewarded', micros: 99})).toBe(false);
  expect(recordAdRevenue(save, {id: 'invalid', currency: 'rub', kind: 'rewarded', micros: 99})).toBe(false);
  expect(save.profile.coins).toBe(before + 10);
});
