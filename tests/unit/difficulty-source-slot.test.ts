import { expect, it } from 'vitest';
import { updateSourceDifficultySlot as update } from '../../tools/content/source-difficulty-slot';

it('writes native-static ExtraSteps and Restart before a win and advances only on win', () => {
  const extra = update(undefined, 'ContinueRequested');
  expect(extra).toEqual({ slot: { outcome: 'ExtraSteps', restarts: 0 }, advance: false });
  const restart = update(extra.slot, 'RestartedLevelBegin');
  expect(restart).toEqual({ slot: { outcome: 'Restart', restarts: 1 }, advance: false });
  expect(update(restart.slot, 'ContinueRequested')).toEqual(restart);
  const twice = update(restart.slot, 'RestartedLevelBegin');
  expect(update(twice.slot, 'LevelWon')).toEqual({ slot: { outcome: 'Restart', restarts: 2 }, advance: true });
  expect(update(extra.slot, 'LevelWon')).toEqual({ ...extra, advance: true });
  expect(update(undefined, 'LevelWon')).toEqual({ slot: { outcome: 'Clean', restarts: 0 }, advance: true });
  expect(update({ outcome: 'Clean', restarts: 0 }, 'ContinueRequested')).toEqual(extra);
});

it('qualifies EasyDeals separately from the stable-move adjustment', async () => {
  const { planFutureDifficulty } = await import('../../src/domain/difficulty');
  const input = { level: 16, random: true, stable: true, previousLosses: 2, difficulty: 'normal', special: false,
    baseBudget: 130, historyPenalty: -5, levelPenalty: 0 } as const;
  const settings = { enabled: true, minLevel: 16, byDifficulty: { normal: { lossThreshold: 3, targetSteps: 110 } } };
  expect(planFutureDifficulty(input, settings)).toEqual({ penalty: -5, effectiveBudget: 123, easyTarget: 110 });
  expect(planFutureDifficulty({ ...input, stable: false }, settings)).toEqual({ penalty: -5, effectiveBudget: 130, easyTarget: undefined });
  for (const condition of [{ random: false }, { special: true }, { previousLosses: 1 }, { difficulty: 'hard' as const }]) {
    expect(planFutureDifficulty({ ...input, ...condition }, settings).easyTarget).toBeUndefined();
  }
});

it('uses separate request-time evidence for future preview deals and preserves the current board', async () => {
  const { vi } = await import('vitest');
  vi.stubEnv('VITE_C8_OWNER_PREVIEW', 'director');
  vi.resetModules();
  try {
    const { futureDifficultyPenalty, recordCampaignOutcome } = await import('../../src/domain/difficulty');
    const { content8Wave } = await import('../../src/content/campaign-v8-dealer');
    const { freshSave } = await import('../../src/domain/engine');
    const base = content8Wave[0], save = freshSave(base, 'source-director');
    save.sourceDifficultyHistory = Array.from({ length: 10 }, () => ({ outcome: 'ExtraSteps', restarts: 0 }));
    save.sourceDifficultyPenalty = 10;
    save.attempt.sourceDifficulty = { outcome: 'ExtraSteps', restarts: 0 };
    recordCampaignOutcome(save);
    expect(futureDifficultyPenalty(save)).toBe(0);
    recordCampaignOutcome(save);
    expect(futureDifficultyPenalty(save)).toBe(-5);
    expect(save.difficultyHistory?.every(entry => entry.outcome === 'Clean')).toBe(true);
    expect(save.attempt.board).toEqual(base.initial);
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});
