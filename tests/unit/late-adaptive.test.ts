import { afterEach, expect, it, vi } from 'vitest';
import { advance } from '../../tools/qa/gameplay-oracle';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it('independently replays both archived budgets on every eligible ordinary and localized campaign deal', async () => {
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  vi.stubEnv('VITE_CONTENT8_BEYOND80', '1');
  const { campaignDeals, findDeal, lateAdaptiveDeals } = await import('../../src/content/campaign');
  const { content8Wave, content8Late } = await import('../../src/content/campaign-v8-dealer');
  const { applyBoard } = await import('../../src/domain/engine');
  for (const base of [...content8Wave, ...content8Late, ...campaignDeals.slice(80)]) {
    expect(findDeal(base.id + '-tight-r2'), base.id).toBeDefined();
    expect(findDeal(base.id + '-relief-r2'), base.id).toBeDefined();
  }
  for (const variant of lateAdaptiveDeals) {
    let board = variant.initial;
    for (const move of variant.winningPath) {
      const result = applyBoard(board, move, variant);
      if (typeof result === 'string') throw Error(variant.id + ': ' + result);
      expect(result.board, variant.id).toEqual(advance(board, move, variant));
      board = result.board;
    }
    expect(board.phase, variant.id).toBe('won');
    expect(findDeal(variant.id)).toBe(variant);
  }
}, 30_000);

it('uses relief and tightening only on new starts and restores playing, parked and Undo identities', async () => {
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  vi.stubEnv('VITE_CONTENT8_BEYOND80', '1');
  vi.stubEnv('VITE_CONTENT8_LOCALE', '1');
  vi.stubEnv('VITE_C8_OWNER_PREVIEW', 'director');
  const { campaignDeals, findDeal, selectCampaignDeal, isCurrentCampaignDeal } = await import('../../src/content/campaign');
  const { dispatch, freshSave } = await import('../../src/domain/engine');
  const { dailyForDay } = await import('../../src/content/daily');
  const { switchMode } = await import('../../src/domain/sessions');
  const { decodeSave } = await import('../../src/platform/storage');
  const base = campaignDeals[80], history = freshSave(base, 'history');
  history.settings.contentLanguage = 'en';
  history.difficultyHistory = Array.from({ length: 10 }, () => ({ outcome: 'Clean', restarts: 0 }));
  const tight = selectCampaignDeal(history, base);
  expect(tight.id).toBe('campaign-c8-beyond-81-en-r1-tight-r2');
  expect(isCurrentCampaignDeal(tight.id, base)).toBe(true);
  history.difficultyHistory = Array.from({ length: 10 }, () => ({ outcome: 'Restart', restarts: 1 }));
  expect(selectCampaignDeal(history, base).adaptive?.direction).toBe('relief');
  const old = freshSave(tight, 'live');
  old.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0, completedCampaign: [] };
  const { campaignId } = await import('../../src/domain/progression');
  old.platform.completedCampaign = Array.from({length: 80}, (_, i) => campaignId(i + 1));
  let save = dispatch(old, tight.winningPath[0], tight).next;
  const active = structuredClone(save.attempt);
  switchMode(save, 'daily', dailyForDay('2026-11-21'), 'daily');
  save = decodeSave(JSON.stringify(save), findDeal);
  switchMode(save, 'campaign', tight, 'return');
  expect(save.attempt).toEqual(active);
  expect(dispatch(save, { type: 'undo' }, tight).next.attempt.board).toEqual(tight.initial);
});
