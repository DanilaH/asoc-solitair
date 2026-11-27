import { describe, expect, it } from 'vitest';
import { quoteLayoutRetry, commitAdaptiveRetry } from '../../src/app/campaign-retry';
import { activelyTeaching, recordTeachingAction, teachingProtected } from '../../src/app/teaching-protection';
import { unlockedBetween, unlockTrack } from '../../src/app/unlock-track';
import { releaseProfile } from '../../src/config/profile';
import { hasReleaseLesson, lessonMarker } from '../../src/app/c8-tutorial';
import { campaignDeals, findDeal, layoutFingerprint, selectCampaignDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { findContinue } from '../../src/domain/continuation';
import { freshSave } from '../../src/domain/engine';
import { campaignId, dailyModeAvailable, dailyTasksAvailable } from '../../src/domain/progression';
import { applyReceipt, cancelContinueVideo, canShowContinueVideo, hasVideoContinueCredit, platformState, quoteContinueVideo, useVideoContinue, type EarnedReceipt } from '../../src/domain/services';
import { switchMode } from '../../src/domain/sessions';
import { decodeSave } from '../../src/platform/storage';
import { loadLoss, unrecoverable } from '../fixtures/content8-loss';
import { replayAuthoredRoute } from '../../tools/content/hitapps-authoring';
import type { Deal } from '../../src/domain/types';

function profileAt(level: number) {
  const save = freshSave(campaignDeals[level - 1], 'playtest');
  platformState(save).completedCampaign = Array.from({ length: level - 1 }, (_, i) => campaignId(i + 1));
  return save;
}

it.each([0, 1, 2, 3])('migrates %i old lives once with the refill and pending receipt intact', remaining => {
  const deal = campaignDeals[0], original = freshSave(deal, 'old-lives');
  const pending = { id: 'video', attemptId: original.attempt.id, dealId: deal.id };
  const lives = { version: 1, remaining, observedAt: 123, earnedCredits: 1, pending, lastEarned: { id: 'previous', dealId: deal.id },
    ...(remaining === 3 ? {} : { refillAt: 1000 }) };
  const decoded = decodeSave(JSON.stringify({ ...original, campaignLives: lives }), findDeal);
  expect(decoded.campaignLives).toEqual({ ...lives, version: 2, remaining: remaining + 2 });
  expect(decodeSave(JSON.stringify(decoded), findDeal).campaignLives).toEqual(decoded.campaignLives);
});

it('applies a quoted rewarded Continue to a solver-impossible position and preserves the deal and Undo', () => {
  const save = loadLoss(unrecoverable, 'unproven');
  const receipt: EarnedReceipt = { schema: 1, id: 'video-return', attempt: save.attempt.id,
    dealId: unrecoverable.id, mode: 'campaign', placement: 'continue' };
  expect(findContinue(save.attempt, unrecoverable, 0).status).toBe('UNSOLVABLE');
  expect(quoteContinueVideo(save)).toBe(true);
  expect(canShowContinueVideo(save, receipt)).toBe(true);
  const before = structuredClone(save.attempt);
  const options = { deal: unrecoverable, unrestrictedVideo: true };
  expect(applyReceipt(save, { ...receipt, dealId: 'wrong-deal' }, options)).toBe('already-applied');
  expect(applyReceipt(save, receipt, options)).toBe('applied');
  expect(save.attempt.board).toEqual({ ...before.board, movesLeft: 10, phase: 'playing' });
  expect(save.attempt.undo.map(board => board.movesLeft)).toEqual(before.undo.map(board => board.movesLeft! + 10));
  expect(applyReceipt(save, { ...receipt, id: 'duplicate' }, options)).toBe('already-applied');
  expect(hasVideoContinueCredit(save)).toBe(false);
});

it.skipIf(!releaseProfile)('recovers a parked Continue without mutating Daily and retires a no-fill quote', () => {
  let save = loadLoss(unrecoverable, 'parked-loss');
  const receipt: EarnedReceipt = { schema: 1, id: 'late-video', attempt: save.attempt.id,
    dealId: unrecoverable.id, mode: 'campaign', placement: 'continue' };
  expect(quoteContinueVideo(save)).toBe(true);
  cancelContinueVideo(save, receipt);
  expect(applyReceipt(save, receipt, { deal: unrecoverable, unrestrictedVideo: true })).toBe('already-applied');
  expect(quoteContinueVideo(save)).toBe(true);
  switchMode(save, 'daily', dailyForDay('2026-11-26'), 'daily-for-credit');
  save = decodeSave(JSON.stringify(save), findDeal);
  const daily = structuredClone(save.attempt);
  expect(applyReceipt(save, receipt, { deal: unrecoverable, unrestrictedVideo: true })).toBe('applied');
  expect(save.attempt).toEqual(daily);
  expect(hasVideoContinueCredit(save)).toBe(false);
  switchMode(save, 'campaign', unrecoverable, 'return');
  expect(useVideoContinue(save, unrecoverable)).toBe(true);
  expect(useVideoContinue(save, unrecoverable)).toBe(false);
});

describe.skipIf(!releaseProfile)('ordinary release follow-up', () => {
  it('protects the last teaching action and two accepted independent moves across save/load', () => {
    const save = profileAt(6), deal = selectCampaignDeal(save, campaignDeals[5]);
    save.attempt = freshSave(deal, 'bonus-lesson').attempt;
    expect(deal.bonusSlots).toEqual({ foundation: { coins: 100 }, tableau: undefined });
    expect(activelyTeaching(save, deal)).toBe(true);
    save.campaign = { version: 1, tutorials: ['intro:bonus-foundation'] };
    recordTeachingAction(save, deal, true, true);
    expect(teachingProtected(save, deal)).toBe(true);
    const reopened = decodeSave(JSON.stringify(save), findDeal);
    recordTeachingAction(reopened, deal, false, false);
    expect(reopened.attempt.teachingAds?.ordinary).toBe(0);
    recordTeachingAction(reopened, deal, false, true);
    expect(teachingProtected(reopened, deal)).toBe(true);
    recordTeachingAction(reopened, deal, false, true);
    expect(teachingProtected(reopened, deal)).toBe(false);
  });

  it('stages Daily and Tasks at their real boundaries and preserves early legacy access', () => {
    const before = profileAt(5), six = profileAt(6), seven = profileAt(7);
    expect(dailyModeAvailable(before)).toBe(false);
    expect(dailyModeAvailable(six)).toBe(true);
    expect(dailyTasksAvailable(six)).toBe(false);
    expect(dailyTasksAvailable(seven)).toBe(true);
    expect(unlockedBetween(before, six).map(item => item.id)).toEqual(['foundation', 'daily']);
    expect(unlockTrack(six).features.map(item => item.id)).toEqual(['tasks']);
    delete before.unlockSchedule;
    const legacy = decodeSave(JSON.stringify(before), findDeal);
    expect(dailyModeAvailable(legacy)).toBe(true);
    expect(dailyTasksAvailable(legacy)).toBe(true);
  });

  it('covers every ordinary L6–80 first issuance and L30 after its Shuffle lesson', () => {
    const protectedLevels: number[] = [], uncovered: number[] = [];
    for (const base of campaignDeals.slice(5, 80)) {
      const level = base.campaignLevel!, save = profileAt(level), deal = selectCampaignDeal(save, base);
      save.attempt = freshSave(deal, 'retry-coverage').attempt;
      save.attempt.board = { ...save.attempt.board, phase: 'exhausted', movesLeft: 0 };
      if (level === 30) {
        expect(quoteLayoutRetry(save)).toBeUndefined();
        save.campaign = { version: 1, tutorials: [lessonMarker('shuffle-used')] };
      } else if (deal.training || hasReleaseLesson(deal)) {
        protectedLevels.push(level);
        expect(quoteLayoutRetry(save)).toBeUndefined();
        continue;
      }
      if (quoteLayoutRetry(save)?.level !== level) uncovered.push(level);
    }
    expect(protectedLevels).toEqual([8, 17, 18, 19, 24, 28, 32]);
    expect(uncovered).toEqual([]);
  });

  it.each([6, 11, 16, 35, 45, 66, 80])('issues a different certified layout on two successive losses at L%i', level => {
    const save = profileAt(level), base = campaignDeals[level - 1];
    let deal: Deal = selectCampaignDeal(save, base);
    save.attempt = freshSave(deal, 'retry-first').attempt;
    for (let i = 0; i < 2; i++) {
      save.attempt.board = { ...save.attempt.board, phase: 'exhausted', movesLeft: 0 };
      const quote = quoteLayoutRetry(save)!;
      expect(quote?.level).toBe(level);
      expect(layoutFingerprint(quote.selected)).not.toBe(layoutFingerprint(deal));
      expect(replayAuthoredRoute(quote.selected, quote.selected.winningPath).phase).toBe('won');
      expect(commitAdaptiveRetry(save, quote, 'retry-' + i, 1000, quoteLayoutRetry)).toBe('started');
      deal = quote.selected;
      expect(decodeSave(JSON.stringify(save), findDeal).attempt.dealId).toBe(deal.id);
    }
    expect(save.campaignLives?.remaining).toBe(3);
  });
});
