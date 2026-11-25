import { expect, it } from 'vitest';
import { dailyForDay } from '../../src/content/daily';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import { coffeeBlocker, releaseLevelAdEligible, releasePlacementEligible, releaseAdCadence, validCampaignAds } from '../../src/domain/campaign-advertising';
import { freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { applyFullscreenShown, parseFullscreenShown, parseReceipt, platformState } from '../../src/domain/services';

it('admits a deliberate L2→L3 transition after startup without any victory counter', () => {
  const save = freshSave(content8Dealer[1], 'transition-r2');
  const state = platformState(save);
  expect(releaseLevelAdEligible(save, 2, 150_000, 1_000)).toBe(false);
  expect(releaseLevelAdEligible(save, 3, 120_999, 1_000)).toBe(false);
  expect(releaseLevelAdEligible(save, 3, 121_000, 1_000)).toBe(true);
  expect(state.winsSinceInterstitial).toBe(0);
  state.lastFullscreenAt = 150_000;
  expect(releaseLevelAdEligible(save, 3, 269_999, 1_000)).toBe(false);
  expect(releaseLevelAdEligible(save, 3, 270_000, 1_000)).toBe(true);
});

for (const mode of ['campaign', 'daily'] as const) {
  it(`records three actual Coffee shows of one ${mode} attempt across serialization without granting coins`, () => {
    const deal = mode === 'daily' ? dailyForDay('2026-11-25') : content8Dealer[5];
    let save = freshSave(deal, 'coffee-r2');
    platformState(save).completedCampaign = Array.from({ length: 5 }, (_, i) => campaignId(i + 1));
    save.attempt.telemetry = { started: true, finished: false, activeMs: 0 };
    const initial = structuredClone(save.attempt.board), coins = save.profile.coins;
    for (const [i, now] of [181_000, 361_000, 541_000].entries()) {
      expect(coffeeBlocker(save, deal, now - 1, 1_000, true, true)).toBe('cadence');
      expect(coffeeBlocker(save, deal, now, 1_000, true, false)).toBe('busy');
      expect(coffeeBlocker(save, deal, now, 1_000, true, true)).toBeUndefined();
      const identity = { schema: 1, id: 'show-' + i, attempt: save.attempt.id, dealId: deal.id,
        mode, kind: 'interstitial', placement: 'ads-break', shownAt: now };
      const actual = parseFullscreenShown(identity);
      expect(applyFullscreenShown(save, actual, deal.campaignLevel, deal)).toBe('applied');
      expect(applyFullscreenShown(save, actual, deal.campaignLevel, deal)).toBe('already-applied');
      expect(validCampaignAds(save.campaignAds!)).toBe(true);
      save = JSON.parse(JSON.stringify(save));
      expect(save.campaignAds?.coffeeDisplays?.[0].count).toBe(i + 1);
      if (mode === 'daily') expect(() => parseReceipt(identity)).toThrow();
    }
    expect(save.attempt.board).toEqual(initial);
    expect(save.profile.coins).toBe(coins);
    expect(save.attempt.adBreakShown).toBeUndefined();
  });
}

it('routes AZUR placements through one clock and keeps start and end complementary', () => {
  const save = freshSave(content8Dealer[2], 'placement-r3');
  const startup = 1_000, available = 121_000;
  expect(releaseAdCadence.banner.minimumLevel).toBe(2);
  const policy = releaseAdCadence.interstitial;
  expect(releasePlacementEligible(save, 2, 'menu', available, startup)).toBe(false);
  expect(releasePlacementEligible(save, 3, 'menu', available - 1, startup)).toBe(false);
  expect(releasePlacementEligible(save, 3, 'menu', available, startup)).toBe(true);
  expect(releasePlacementEligible(save, 3, 'level-start', available, startup)).toBe(true);
  expect(releasePlacementEligible(save, 3, 'level-end', available, startup)).toBe(false);
  expect(releasePlacementEligible(save, 3, 'theme', available, startup)).toBe(false);
  const testing = { ...policy, levelStart: false, theme: true };
  expect(releasePlacementEligible(save, 3, 'level-start', available, startup, testing)).toBe(false);
  expect(releasePlacementEligible(save, 3, 'level-end', available, startup, testing)).toBe(true);
  expect(releasePlacementEligible(save, 3, 'theme', available, startup, testing)).toBe(true);
  const identity = { schema: 1, id: 'show-menu', attempt: save.attempt.id, dealId: save.attempt.dealId,
    mode: 'campaign', kind: 'interstitial', placement: 'menu', shownAt: available };
  expect(() => parseReceipt(identity)).toThrow();
  expect(() => parseFullscreenShown({ ...identity, mode: 'daily' })).toThrow();
  expect(applyFullscreenShown(save, parseFullscreenShown(identity))).toBe('applied');
  expect(releasePlacementEligible(save, 3, 'level-start', available + 1000, startup)).toBe(false);
  expect(releasePlacementEligible(save, 3, 'level-start', available + 120_000, startup)).toBe(true);
});
