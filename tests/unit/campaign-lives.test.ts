import { expect, it } from 'vitest';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { authorizeLifeVideo, LIVES_RULES, mayStartCampaignAttempt, refillCampaignLife, refreshCampaignLives, validCampaignLives } from '../../src/domain/campaign-lives';
import { dispatch, freshSave } from '../../src/domain/engine';
import { recordLiveOpsWin, liveOpsDefinitions } from '../../src/domain/events/campaign-liveops';
import { eventKey, claimMilestone } from '../../src/domain/events/ledger';
import { applyReceipt } from '../../src/domain/services';

it('atomically blocks a fresh campaign attempt at zero, and neither timeout nor restamped earned can award twice', () => {
  const deal = content8Wave[0], save = freshSave(deal, 'confirmed-loss');
  const now = 1_000;
  save.attempt.board = { ...save.attempt.board, movesLeft: 0, phase: 'exhausted' };
  save.campaignLives = { version: 2, remaining: 1, observedAt: now, refillAt: now + LIVES_RULES.refillMs, earnedCredits: 0 };
  expect(mayStartCampaignAttempt(save, save.attempt, now, true)).toBe(false);
  expect(mayStartCampaignAttempt(save, save.attempt, now+1, true)).toBe(false);
  expect(save.attempt.lostLife).toBe(true);
  const quote = { revision: save.revision, method: 'coins', now } as const;
  expect(refillCampaignLife(save, quote)).toBe(true);
  expect(refillCampaignLife(save, quote)).toBe(false);
  expect(mayStartCampaignAttempt(save, save.attempt, now, true)).toBe(true);
  expect(authorizeLifeVideo(save, now, 'separate-opportunity', false)).toBe(false);
  expect(authorizeLifeVideo(save, now, 'separate-opportunity', true)).toBe(true);
  refreshCampaignLives(save, now + LIVES_RULES.refillMs * (LIVES_RULES.max - 1));
  const receipt = { schema: 1, id: 'native', attempt: 'separate-opportunity', dealId: deal.id, mode: 'campaign', placement: 'life-refill' } as const;
  expect(applyReceipt(save, receipt)).toBe('applied');
  expect(applyReceipt(save, { ...receipt, id: 'restamped' })).toBe('already-applied');
  expect(save.campaignLives.earnedCredits).toBe(1);
  expect(validCampaignLives(save.campaignLives)).toBe(true);
});

it('keeps lifetime loss bookkeeping bounded after 10000 attempts', () => {
  const deal = content8Wave[0], save = freshSave(deal, 'history');
  for (let i = 0; i < 10_000; i++) {
    const now = i * LIVES_RULES.refillMs * 3;
    save.attempt = freshSave(deal, 'lost-' + i).attempt;
    save.attempt.board = { ...save.attempt.board, phase: 'exhausted', movesLeft: 0 };
    mayStartCampaignAttempt(save, save.attempt, now, true);
    if ([0, 30, 180, 365, 1099, 9999].includes(i)) expect(JSON.stringify(save.campaignLives).length).toBeLessThan(200);
  }
  expect(save.campaignLives?.remaining).toBe(LIVES_RULES.max - 1);
}, 20_000);

it('keeps event occurrences distinct and preserves an earned unclaimed prize across rollover', () => {
  const t = Date.UTC(2026, 10, 22), later = t + 7 * 86_400_000;
  let save = freshSave(content8Wave[0], 'event-owner');
  for (const [i, at] of [t, t, later, later].entries()) {
    const deal = content8Wave[i];
    save.attempt = freshSave(deal, 'event-owner-' + i).attempt;
    for (const move of deal.winningPath.slice(0, -1)) save = dispatch(save, move, deal).next;
    const won = dispatch(save, deal.winningPath.at(-1)!, deal).next;
    recordLiveOpsWin(save, won, deal, at);
    save = won;
  }
  const first = eventKey(liveOpsDefinitions(t)[0]), second = eventKey(liveOpsDefinitions(later)[0]);
  expect(first).not.toEqual(second);
  expect(claimMilestone(save, first, 'stage-1')).toBe(true);
  expect(claimMilestone(save, second, 'stage-1')).toBe(true);
  expect(claimMilestone(save, first, 'stage-1')).toBe(false);
});
