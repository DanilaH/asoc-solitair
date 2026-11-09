import { expect, it } from 'vitest';
import { campaignDeals, findDeal } from '../../src/content/campaign';
import { introDeal } from '../../src/content/intro';
import { expansionDeals } from '../../src/content/expansion';
import { dispatch, freshSave } from '../../src/domain/engine';
import { decodeSave } from '../../src/platform/storage';
import { dailyForDay } from '../../src/content/daily';
it('has 54 distinct appended puzzles spanning the new topics and existing modifiers with bounded witnesses', () => {
  expect(campaignDeals).toHaveLength(80); expect(expansionDeals).toHaveLength(54);
  expect(expansionDeals.filter(d => d.tags?.includes('ordered'))).toHaveLength(11);
  expect(expansionDeals.filter(d => d.lock)).toHaveLength(10);
  expect(new Set(expansionDeals.map(d => JSON.stringify([d.initial.tableau,d.initial.stock,d.initial.faceUp]))).size).toBe(54);
  expect(expansionDeals.every(d => d.winningPath.length <= 62 && d.initial.movesLeft! > d.winningPath.length)).toBe(true);
});
it('migrates content-v4 active campaign and parked daily without altering reward identities, spending, appearance or attempt state', () => {
  const save = freshSave(campaignDeals[25], 'old-campaign'); save.contentVersion = 4; save.profile.rewards = ['milestone:10','milestone:20','cycle:1']; save.profile.coins = 319; save.profile.jokers = 0;
  save.parked = { daily: freshSave(dailyForDay('2026-11-09'),'old-daily').attempt }; save.settings.palette = 'ink'; save.settings.deckSide = 'left';
  const migrated = decodeSave(JSON.stringify(save), findDeal);
  expect(migrated.attempt).toEqual(save.attempt); expect(migrated.parked).toEqual(save.parked); expect(migrated.profile).toEqual(save.profile); expect(migrated.settings).toEqual(save.settings); expect(migrated.meta).toEqual(save.meta);
  expect(migrated.contentVersion).toBe(5);
});
it('Undo from temporary exhaustion reopens the telemetry outcome marker for a later win', () => {
  const save = freshSave(introDeal, 'exhausted-undo'); save.attempt.board.movesLeft = 1; save.attempt.telemetry = { started: true, finished: false, activeMs: 10 };
  const exhausted = dispatch(save, introDeal.winningPath[0], introDeal).next; exhausted.attempt.telemetry!.finished = true;
  const restored = dispatch(exhausted, { type: 'undo' }, introDeal).next;
  expect(restored.attempt.board.phase).toBe('playing'); expect(restored.attempt.telemetry!.started).toBe(true); expect(restored.attempt.telemetry!.finished).toBe(false); expect(restored.meta).toEqual(exhausted.meta);
});
