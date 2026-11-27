import { afterEach, expect, it, vi } from 'vitest';
import { adjustedMoveBudget, difficultyStats, easyDealTarget, nextPenalty } from '../../src/domain/difficulty';
import { applyShufflePattern, prepareFreshPlan, preparePriorityPlan } from '../../tools/content/candidate-pipeline';
import { eligibleForEquality, selectEquality } from '../../tools/content/difficulty-selection';
import { advance } from '../../tools/qa/gameplay-oracle';
import { dealOrdinary } from '../../tools/content/plain-dealer';
import directorBank from '../../src/content/campaign-v8-director.json';
import type { Board, BoardCommand, CampaignOutcome, Deal } from '../../src/domain/types';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it('uses ten outcomes, weights repeated restarts and rounds signed budget changes away from zero', () => {
  const clean = { outcome: 'Clean', restarts: 0 } as const;
  const extra = { outcome: 'ExtraSteps', restarts: 0 } as const;
  const config = { minRate: 55, maxRate: 90, hardPenalty: -10, easyPenalty: 10 };
  const wins = Array<CampaignOutcome>(10).fill(clean);
  const restarts = Array<CampaignOutcome>(10).fill({ outcome: 'Restart', restarts: 1 });
  expect(difficultyStats(wins.slice(1))).toBeUndefined();
  expect(difficultyStats([clean, clean, clean, clean, extra, extra, extra, extra,
    { outcome: 'Restart', restarts: 1 }, { outcome: 'Restart', restarts: 3 }])).toEqual({ cleanRate: 40, adjustedRate: 88 });
  expect(difficultyStats([...wins, ...restarts])).toEqual({ cleanRate: 0, adjustedRate: 50 });
  expect(nextPenalty(wins, 0, config)).toBe(-10);
  expect(nextPenalty(wins, 8, config)).toBe(0);
  expect(nextPenalty(restarts, 0, config)).toBe(10);
  expect(nextPenalty(restarts, -8, config)).toBe(0);
  expect(nextPenalty(restarts, 2, { ...config, minRate: 50 })).toBe(2);
  expect(adjustedMoveBudget(25, -10, true)).toBe(22);
  expect(adjustedMoveBudget(25, 10, true)).toBe(28);
  expect(adjustedMoveBudget(25, 10, false)).toBe(25);
});

it('uses explicit relief and special config gates independently', () => {
  const relief = { enabled: true, minLevel: 6, byDifficulty: { hard: { lossThreshold: 3, targetSteps: 25 } } };
  const input = { level: 6, random: true, stable: true, difficulty: 'hard' as const, previousLosses: 2, special: false };
  expect(easyDealTarget(input, relief)).toBe(25);
  expect(easyDealTarget({ ...input, previousLosses: 1 }, relief)).toBeUndefined();
  expect(easyDealTarget({ ...input, stable: false }, relief)).toBeUndefined();
  expect(easyDealTarget({ ...input, special: true }, relief)).toBeUndefined();
  const config = { enabled: true, minLevel: 6, limit: 2, segments: ['NonPayer'] as const };
  const request = { level: 6, seed: 1, issued: 1, segment: 'NonPayer' as const };
  expect(eligibleForEquality(request, config)).toBe(true);
  expect(eligibleForEquality({ ...request, seed: 0 }, config)).toBe(false);
  expect(eligibleForEquality({ ...request, issued: 2 }, config)).toBe(false);
  expect(eligibleForEquality({ ...request, segment: 'unknown' }, config)).toBe(false);
});

function trappedDeal(stock: boolean): Deal {
  const cards = Object.fromEntries(['a', 'b', 'a1', 'b1', 'a2'].map(id => [id,
    { id, category: id[0], leader: id.length === 1, text: id, explanation: '' }]));
  const initial: Board = {
    foundations: [[]], tableau: [['a', 'a1'], ['b', 'b1']], stock: stock ? ['a2'] : [], waste: stock ? [] : ['a2'],
    faceUp: stock ? ['a1', 'b1'] : ['a1', 'b1', 'a2'], collected: [], movesLeft: 100, phase: 'playing',
  };
  return { id: 'equality-fixture', version: 1, editorialStatus: 'fixture', title: '', initial, cards, winningPath: [] };
}

it('selects only after each game-policy failure spends at least 80% of the budget', () => {
  const trapAt = (id: string, step: number) => ({ id, choose(board: Board, legal: BoardCommand[]) {
    return legal.find(action => action.type === (board.movesLeft === 101 - step ? 'transfer' : board.stock.length ? 'draw' : 'recycle'));
  } });
  const a = trappedDeal(false), b = trappedDeal(true);
  expect(selectEquality([a], [trapAt('79-percent', 79)])).toEqual({ attempts: 1 });
  expect(selectEquality([b], [trapAt('80-percent', 80), trapAt('82-percent', 82)]))
    .toMatchObject({ deal: b, attempts: 1, runs: [{ status: 'LOST', steps: 80 }, { status: 'LOST', steps: 82 }] });
  expect(selectEquality([b], [trapAt('80-percent', 80), { id: 'unknown', choose: () => undefined }])).toEqual({ attempts: 1 });
  expect(() => selectEquality([b], [])).toThrow();
});

it('reseeds once on an eligible fresh Shuffle even if its first pattern fails', () => {
  const shuffle = vi.fn((value: number, seed: number) => value + seed);
  const feature = { enabled: true, minLevel: 1, level: 1, pattern: 0, featureSeed: 2, shuffle };
  const appliers = {
    lockers: (s: ReturnType<typeof prepareFreshPlan<number>>) => applyShufflePattern(s, {
      ...feature, apply: () => undefined, appliedFlag: 2, failedFlag: 4,
    }),
    frozen: (s: ReturnType<typeof prepareFreshPlan<number>>) => applyShufflePattern(s, {
      ...feature, apply: v => v * 2, appliedFlag: 32, failedFlag: 64,
    }),
  };
  expect(prepareFreshPlan(10, appliers)).toMatchObject({ snapshot: 24, appliedFlags: 32, failedFlags: 4 });
  expect(shuffle).toHaveBeenCalledExactlyOnceWith(10, 2);
  shuffle.mockClear();
  expect(preparePriorityPlan({
    appliers, requests: [10], drawSeed: vi.fn(), shuffle: n => n,
    digest: JSON.stringify, evaluate: () => ({ steps: 1, value: 1 }), target: 1, tolerancePercent: 0,
  })).toMatchObject({ selected: { afterShuffle: { snapshot: 20, failedFlags: 4 } } });
  expect(shuffle).not.toHaveBeenCalled();
});

it('keeps campaign difficulty history and loss on restart across save reload and awards', async () => {
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  const { findDeal } = await import('../../src/content/campaign');
  const { dispatch, freshSave } = await import('../../src/domain/engine');
  const { applyReceipt } = await import('../../src/domain/services');
  const { decodeSave } = await import('../../src/platform/storage');
  const deal = findDeal('campaign-c8-dealer-015')!;
  let save = freshSave(deal, 'loss-1');
  save.attempt.board.movesLeft = 1;
  save = dispatch(save, { type: 'draw' }, deal).next;
  expect(save.attempt.board.phase).toBe('exhausted');
  expect(save.attempt.director).toEqual({ restarts: 0, previousLosses: 0, exhausted: true });
  applyReceipt(save, { schema: 1, id: 'earned', attempt: 'loss-1', dealId: deal.id, placement: 'continue', mode: 'campaign' });
  const recovered = decodeSave(JSON.stringify(save), findDeal);
  expect(recovered.attempt.board.phase).toBe('exhausted');
  expect(recovered.platform?.continueCredits).toBe(1);
  expect(recovered.platform?.receipts).toEqual(['earned']);
  save = dispatch(recovered, { type: 'restart', attemptId: 'loss-2' }, deal).next;
  expect(save.attempt.director).toEqual({ restarts: 1, previousLosses: 1 });
  expect(save.attempt.board).toEqual(deal.initial);
  for (const action of deal.winningPath) {
    const step = dispatch(save, action, deal);
    expect(step.accepted, step.reason).toBe(true);
    save = step.next;
  }
  expect(save.attempt.board.phase).toBe('won');
  expect(save.difficultyHistory).toEqual([{ outcome: 'Restart', restarts: 1 }]);
  expect(decodeSave(JSON.stringify(save), findDeal)).toEqual(save);
  expect(decodeSave(JSON.stringify(freshSave(deal, 'legacy-no-history')), findDeal).difficultyHistory).toBeUndefined();
});

it('restores the archived C8 director variants with the same identity across reload and Restart', async () => {
  vi.stubEnv('VITE_ASOC_ARCHIVE_227', '1');
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  const { campaignDeals, findDeal, selectCampaignDeal } = await import('../../src/content/campaign');
  const { content8DirectorDeals } = await import('../../src/content/campaign-v8-director');
  const { beginDeal } = await import('../../src/domain/campaign');
  const { dispatch, freshSave } = await import('../../src/domain/engine');
  const { campaignId } = await import('../../src/domain/progression');
  const { switchMode } = await import('../../src/domain/sessions');
  const { dailyForDay } = await import('../../src/content/daily');
  const { decodeSave } = await import('../../src/platform/storage');
  const base = campaignDeals[11];
  let save = freshSave(base, 'original');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0,
    lastFullscreenAt: 0, completedCampaign: campaignDeals.slice(0, 11).map(d => campaignId(d.campaignLevel!)) };
  save.difficultyHistory = Array.from({ length: 9 }, () => ({ outcome: 'Clean', restarts: 0 }));
  const bonusRevision = import.meta.env.VITE_ASOC_PROFILE ? '-bonus-r2' : '';
  expect(selectCampaignDeal(save, base).id).toBe(base.id + bonusRevision);
  save.difficultyHistory.push({ outcome: 'Clean', restarts: 0 });
  expect(selectCampaignDeal(save, campaignDeals[7])).toBe(campaignDeals[7]);
  const late = campaignDeals[15];
  const selected = selectCampaignDeal(save, late);
  if (import.meta.env.VITE_ASOC_PROFILE) expect(selected).toMatchObject({ campaignLevel: 16, recovery: { version: 1 }, randomJokerPreview: 1 });
  else expect(selected).toBe(late);
  const tight = selectCampaignDeal(save, base);
  expect(tight.id).toBe(base.id + '-tight-r1' + bonusRevision);
  expect(tight.initial.movesLeft).toBe(64);
  save.attempt.board.movesLeft = 0;
  save.attempt.board.phase = 'exhausted';
  save.attempt.director = { previousLosses: 1, restarts: 1, exhausted: true };
  expect(selectCampaignDeal(save, base, save.attempt)).toBe(tight);
  save.attempt.director = { previousLosses: 2, restarts: 2, exhausted: true };
  const relief = selectCampaignDeal(save, base, save.attempt);
  expect(relief.id).toBe(base.id + '-relief-r1' + bonusRevision);
  expect(relief.initial.movesLeft).toBe(74);
  expect(relief.initial.stock).not.toEqual(base.initial.stock);
  beginDeal(save, relief, 'relief', base);
  expect(save.attempt.director).toEqual({ previousLosses: 3, restarts: 3 });
  save = dispatch(save, { type: 'draw' }, relief).next;
  expect(save.attempt.board.movesLeft).toBe(73);
  save.difficultyPenalty = -5;
  const parked = structuredClone(save.attempt);
  switchMode(save, 'daily', dailyForDay('2026-11-20'), 'daily');
  save = decodeSave(JSON.stringify(save), findDeal);
  switchMode(save, 'campaign', relief, 'resume');
  expect(save.attempt).toEqual(parked);
  expect(dispatch(save, { type: 'restart', attemptId: 'restart' }, relief).next.attempt).toMatchObject({
    dealId: relief.id, board: relief.initial,
  });
  save.platform!.completedCampaign.push(campaignId(12));
  expect(selectCampaignDeal(save, base, save.attempt).id).toBe(base.id + bonusRevision);

  expect(content8DirectorDeals).toHaveLength(10);
  for (const entry of directorBank) {
    const initial = entry.relief.initial;
    const cards = Object.keys(findDeal(entry.baseId)!.cards);
    expect(dealOrdinary(cards, initial.stock.length, initial.tableau.map(col => col.length), entry.relief.seed))
      .toEqual({ tableau: initial.tableau, stock: initial.stock });
  }
  for (const deal of content8DirectorDeals) {
    expect(findDeal(deal.id)).toBe(deal);
    let board = deal.initial;
    for (const action of deal.winningPath) {
      const result = advance(board, action, deal);
      expect(result, deal.id).toBeDefined();
      board = result!;
    }
    expect(board.phase, deal.id).toBe('won');
    expect(board.movesLeft!, deal.id).toBeGreaterThanOrEqual(3);
  }
});

it('offers another stored layout only after C8 exhaustion and keeps both starts playable', async () => {
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  const { campaignRedeal, campaignDeals, findDeal } = await import('../../src/content/campaign');
  const { applyBoard, freshSave } = await import('../../src/domain/engine');
  const { dailyForDay } = await import('../../src/content/daily');
  const exhausted = (deal: Deal) => {
    const board = { ...deal.initial, phase: 'exhausted' as const, movesLeft: 0 };
    return { ...freshSave(deal, 'lost').attempt, board };
  };
  for (const level of [12, 13, 14, 15]) {
    const base = campaignDeals[level - 1], relief = findDeal(base.id + '-relief-r1')!, tight = findDeal(base.id + '-tight-r1')!;
    expect(campaignRedeal(exhausted(base))).toBe(relief);
    expect(campaignRedeal(exhausted(tight))).toBe(relief);
    expect(campaignRedeal(exhausted(relief))).toBe(base);
    expect(relief.cards).toBe(base.cards);
    expect(relief.initial.tableau).not.toEqual(base.initial.tableau);
    for (const deal of [base, relief]) {
      let board = deal.initial;
      for (const move of deal.winningPath) {
        const result = applyBoard(board, move, deal);
        if (typeof result === 'string') throw Error(result);
        expect(result.board).toEqual(advance(board, move, deal));
        board = result.board;
      }
      expect(board.phase).toBe('won');
    }
  }
  const sameLayout = campaignDeals[10];
  expect(campaignRedeal(exhausted(sameLayout))).toBeUndefined();
  expect(campaignRedeal(exhausted(findDeal(sameLayout.id + '-relief-r1')!))).toBeUndefined();
  expect(campaignRedeal(exhausted(campaignDeals[15]))).toBeUndefined();
  expect(campaignRedeal(exhausted(dailyForDay('2026-11-20')))).toBeUndefined();
  expect(campaignRedeal(freshSave(campaignDeals[11], 'playing').attempt)).toBeUndefined();
});
