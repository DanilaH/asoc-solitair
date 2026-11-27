import { describe, expect, it } from 'vitest';
import { commitAdaptiveRetry, quoteLayoutRetry } from '../../src/app/campaign-retry';
import { lesson } from '../../src/app/tutorial';
import { campaignCorePolicy, CAMPAIGN_CORE_STAGE1 } from '../../src/config/hitapps-r4';
import { campaignDeals, campaignIssuance, findDeal, layoutFingerprint, selectCampaignDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { bonusOffer } from '../../src/domain/bonus-slots';
import { buyUnlimitedAccess } from '../../src/domain/campaign-recovery';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId, helperUnlocked } from '../../src/domain/progression';
import { canShuffle } from '../../src/domain/proof-shuffle';
import { allowsRandomJoker } from '../../src/domain/random-joker';
import { switchMode } from '../../src/domain/sessions';
import type { Deal } from '../../src/domain/types';
import { decodeSave } from '../../src/platform/storage';

function profile(level: number, anchor = 'stage1-profile') {
  const base = campaignDeals[level - 1], save = freshSave(base, anchor);
  save.platform = { receipts: [], continueCredits: 0, continuedAttempts: [], winsSinceInterstitial: 0, lastFullscreenAt: 0,
    completedCampaign: Array.from({ length: level - 1 }, (_, index) => campaignId(index + 1)) };
  return { base, save };
}

describe.skipIf(!CAMPAIGN_CORE_STAGE1)('ordinary campaign core stage 1', () => {
  it.each(Array.from({ length: 14 }, (_, index) => index + 2))('L%i issues four distinct layouts and restores every passport', level => {
    const { base, save } = profile(level);
    const entry = selectCampaignDeal(save, base), previous = save.attempt;
    save.attempt = freshSave(entry, 'first').attempt;
    save.attempt.issuance = campaignIssuance(save, base, entry, previous);
    const geometries = new Set([layoutFingerprint(entry)]);
    for (let index = 1; index <= 3; index++) {
      save.attempt.board.phase = 'exhausted';
      save.attempt.board.movesLeft = 0;
      const quote = quoteLayoutRetry(save)!;
      expect(quote).toBeDefined();
      expect(commitAdaptiveRetry(save, quote, 'repeat-' + index, 1000, quoteLayoutRetry)).toBe('started');
      expect(save.attempt.issuance).toMatchObject({ policy: campaignCorePolicy, dealId: quote.selected.id });
      geometries.add(layoutFingerprint(quote.selected));
      expect(decodeSave(JSON.stringify(save), findDeal).attempt).toEqual(save.attempt);
    }
    expect(geometries.size).toBe(4);
    expect(save.campaignLives?.remaining).toBe(2);
  });

  it.each([16, 23, 39, 66, 80])('L%i rotates past the previous two layouts at every certified penalty', level => {
    for (const penalty of [-5, 0, 10]) {
      const { base, save } = profile(level);
      save.difficultyPenalty = penalty;
      const first = selectCampaignDeal(save, base), previous = save.attempt;
      save.attempt = freshSave(first, 'late-first').attempt;
      save.attempt.issuance = campaignIssuance(save, base, first, previous);
      const seen = new Set([layoutFingerprint(first)]);
      for (let index = 1; index <= 2; index++) {
        const quote = quoteLayoutRetry(save)!;
        expect(commitAdaptiveRetry(save, quote, 'late-repeat-' + index, 1000, quoteLayoutRetry)).toBe('started');
        expect(save.attempt.board.rulesVersion).toBe(4);
        seen.add(layoutFingerprint(quote.selected));
      }
      expect(seen.size).toBe(3);
    }
  });

  it('does not consume a life on explicit early reroll and parks the exact board and Undo', () => {
    const old = findDeal('campaign-c8-dealer-006-bonus-r2')!;
    const { save } = profile(6);
    save.attempt = freshSave(old, 'old-l6').attempt;
    const previous = dispatch(save, old.winningPath[0], old).next;
    switchMode(previous, 'daily', dailyForDay('2026-11-27'), 'daily');
    const restored = decodeSave(JSON.stringify(previous), findDeal);
    switchMode(restored, 'campaign', old, 'resume');
    expect(restored.attempt).toEqual(previous.parked?.campaign);
    const quote = quoteLayoutRetry(restored)!;
    expect(commitAdaptiveRetry(restored, quote, 'new-l6', 1000, quoteLayoutRetry)).toBe('started');
    expect(restored.campaignLives?.remaining).toBe(5);
    expect(restored.attempt.board.rulesVersion).toBe(4);
    expect(bonusOffer(quote.selected, 'tableau')?.coins).toBe(60);
    expect(bonusOffer(quote.selected, 'foundation')?.coins).toBe(100);
  });

  it('keeps the distinct rights on early and very late campaign layouts', () => {
    for (const level of [2, 7, 80]) {
      const { base, save } = profile(level);
      const deal: Deal = selectCampaignDeal(save, base);
      save.attempt = freshSave(deal, 'helpers-at-' + level).attempt;
      save.profile.coins = 500;
      expect(helperUnlocked(save, 'joker', deal)).toBe(true);
      expect(allowsRandomJoker(save.attempt, deal)).toBe(true);
      expect(deal.extraHelpers?.randomJokerCoins).toBe(250);
      expect(canShuffle(save, deal)).toBe(false);
      expect(deal.shuffleCost).toBe('charge');
      expect(buyUnlimitedAccess(save, deal, 'early-time', 1000)).toBe(true);
      expect(decodeSave(JSON.stringify(save), findDeal).attempt.unlimited).toEqual(save.attempt.unlimited);
    }
  });

  it('keeps L1 fixed and free of a move budget and skips repeat L2 teaching', () => {
    const { base, save } = profile(1);
    const first = selectCampaignDeal(save, base, save.attempt);
    save.attempt = freshSave(first, 'l1').attempt;
    expect(first.initial.movesLeft).toBeNull();
    expect(quoteLayoutRetry(save)).toBeUndefined();
    expect(lesson(save, first)?.action?.type).toBe('transfer');
    const second = profile(2);
    const entry = selectCampaignDeal(second.save, second.base);
    second.save.attempt = freshSave(entry, 'l2').attempt;
    second.save.campaign = { version: 1, tutorials: ['learn:category', 'learn:match', 'learn:stock', 'learn:waste'] };
    expect(lesson(second.save, entry)).toBeUndefined();
  });
});
