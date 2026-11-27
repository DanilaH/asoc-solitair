import { content7Deals } from '../../src/content/campaign-v7';
import { expect, it } from 'vitest';
import { advance } from '../../tools/qa/gameplay-oracle';
import { releaseProfile } from '../../src/config/profile';
import { campaignDeals, findDeal, integratedCampaignDeals, isCurrentCampaignDeal, selectCampaignDeal } from '../../src/content/campaign';
import { loadEqualityPreviewPolicy } from '../../src/content/campaign-v8-equality';
import { dailyForDay } from '../../src/content/daily';
import { beginDeal } from '../../src/domain/campaign';
import { mayStartCampaignAttempt } from '../../src/domain/campaign-lives';
import { applyBoard, dispatch, freshSave } from '../../src/domain/engine';
import { C8_DIFFICULTY, adjustedMoveBudget } from '../../src/domain/difficulty';
import { campaignId } from '../../src/domain/progression';
import { switchMode } from '../../src/domain/sessions';
import { decodeSave } from '../../src/platform/storage';

it('replays every integrated passport with both rules implementations', () => {
  expect(integratedCampaignDeals.length).toBeGreaterThan(2);
  for (const deal of integratedCampaignDeals) {
    expect(deal.id.length).toBeLessThanOrEqual(100);
    expect(findDeal(deal.id)).toBe(deal);
    let independent = deal.initial, production = deal.initial;
    for (const move of deal.winningPath) {
      const result = applyBoard(production, move, deal);
      const board = advance(independent, move, deal);
      if (typeof result === 'string') throw Error(`${deal.id}: ${result}`);
      expect(board, deal.id).toEqual(result.board);
      independent = board!;
      production = result.board;
    }
    expect(independent.phase, deal.id).toBe('won');
  }
}, 15000);

it.skipIf(!releaseProfile)('starts an adapted L16 with recovery and Joker, then preserves exact identity through Daily, Undo and reload', async () => {
  const previous = content7Deals[14], target = campaignDeals[15];
  const old = freshSave(previous, 'earlier');
  old.contentVersion = 7;
  old.platform = { receipts: ['earned'], continuedAttempts: [], continueCredits: 1, winsSinceInterstitial: 0, lastFullscreenAt: 0,
    completedCampaign: Array.from({ length: 15 }, (_, i) => campaignId(i + 1)) };
  old.difficultyPenalty = C8_DIFFICULTY.easyPenalty;
  let save = decodeSave(JSON.stringify(old), findDeal);
  expect(save.contentVersion).toBe(8);
  const selected = selectCampaignDeal(save, target);
  expect(selected).toMatchObject({ campaignLevel: 16, initial: { rulesVersion: 4, movesLeft: adjustedMoveBudget(target.initial.movesLeft!, C8_DIFFICULTY.easyPenalty, true) }, recovery: { version: 1 }, randomJokerPreview: 1, extraHelpers: { version: 1, randomJokerCoins: 250 } });
  expect(isCurrentCampaignDeal(selected.id, target)).toBe(true);
  expect(await loadEqualityPreviewPolicy()).toBeUndefined();
  expect(mayStartCampaignAttempt(save, save.attempt, 100)).toBe(true);
  beginDeal(save, selected, 'issued', previous);
  save = dispatch(save, selected.winningPath[0], selected).next;
  expect(save.attempt.undo).toHaveLength(1);
  const attempt = structuredClone(save.attempt);
  switchMode(save, 'daily', dailyForDay('2026-11-24'), 'daily');
  save = decodeSave(JSON.stringify(save), findDeal);
  switchMode(save, 'campaign', selected, 'resume');
  expect(save.attempt).toEqual(attempt);
  expect(save.platform).toMatchObject({ receipts: ['earned'], continueCredits: 1 });
  expect(dispatch(save, { type: 'undo' }, selected).next.attempt.board).toEqual(selected.initial);
});
