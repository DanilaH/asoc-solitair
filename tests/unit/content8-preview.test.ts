import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('reference slice save ownership', () => {
  it('opens an existing C7 attempt and its history before starting the new version explicitly', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
    const { campaignDeals, findDeal } = await import('../../src/content/campaign');
    const { dispatch, freshSave } = await import('../../src/domain/engine');
    const { beginDeal } = await import('../../src/domain/campaign');
    const { campaignId } = await import('../../src/domain/progression');
    const { decodeSave } = await import('../../src/platform/storage');
    const old = findDeal('campaign-c7-015')!, candidate = campaignDeals[14];
    expect(candidate.id).toBe('campaign-c8-dealer-015');
    let save = freshSave(old, 'old-c7');
    save.contentVersion = 7;
    save = dispatch(save, old.winningPath[0], old).next;
    save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
      completedCampaign: Array.from({ length: 14 }, (_, i) => campaignId(i + 1)) };
    const restored = decodeSave(JSON.stringify(save), findDeal);
    expect(restored.contentVersion).toBe(8);
    expect(restored.attempt).toEqual(save.attempt);
    expect(restored.profile).toEqual(save.profile);
    expect(restored.platform).toEqual(save.platform);
    beginDeal(restored, candidate, 'new-c8');
    expect(restored.attempt.board.stock).toHaveLength(42);
    expect(restored.attempt.id).toBe('new-c8');
    expect(decodeSave(JSON.stringify(restored), findDeal)).toEqual(restored);
    expect(() => decodeSave(JSON.stringify({ ...restored, contentVersion: 7 }), findDeal)).toThrow();
  }, 20000);

  it('retains a parked C7 attempt and daily attempt under the new envelope', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
    const { findDeal } = await import('../../src/content/campaign');
    const { dailyForDay } = await import('../../src/content/daily');
    const { dispatch, freshSave } = await import('../../src/domain/engine');
    const { decodeSave } = await import('../../src/platform/storage');
    const old = findDeal('campaign-c7-012')!, daily = dailyForDay('2026-11-19');
    const parked = dispatch(freshSave(old, 'parked-c7'), old.winningPath[0], old).next.attempt;
    const save = freshSave(daily, 'active-daily');
    save.contentVersion = 7;
    save.parked = { campaign: parked };
    expect(decodeSave(JSON.stringify(save), findDeal)).toEqual({ ...save, contentVersion: 8 });
  }, 20000);
});

it('keeps an old C8 board and its Undo when the same level receives a new layout', async () => {
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  const { campaignDeals, findDeal } = await import('../../src/content/campaign');
  const { dispatch, freshSave } = await import('../../src/domain/engine');
  const { decodeSave } = await import('../../src/platform/storage');
  const archived = findDeal('campaign-c8-015')!;
  const old = dispatch(freshSave(archived, 'old-c8'), archived.winningPath[0], archived).next;
  expect(decodeSave(JSON.stringify(old), findDeal)).toEqual(old);
  expect(campaignDeals[14].id).not.toBe(old.attempt.dealId);
}, 20000);
