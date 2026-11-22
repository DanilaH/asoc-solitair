import type { Attempt, CampaignOutcome, DifficultyTier, Save } from './types';

export const DIFFICULTY_WINDOW = 10;
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const isInt32 = (n: number) => Number.isInteger(n) && n >= INT32_MIN && n <= INT32_MAX;

// Product preview settings. Original live values are unknown.
export const C8_DIFFICULTY = {
  minLevel: 11, minRate: 70, maxRate: 90, hardPenalty: -5, easyPenalty: 10, lossThreshold: 3,
} as const;

export function recordCampaignOutcome(save: Save) {
  const previous = difficultyPenalty(save);
  const restarts = save.attempt.director?.restarts ?? 0;
  const outcome: CampaignOutcome['outcome'] = restarts ? 'Restart' : save.attempt.continued ? 'ExtraSteps' : 'Clean';
  save.difficultyHistory = [...(save.difficultyHistory ?? []), { outcome, restarts }].slice(-DIFFICULTY_WINDOW);
  save.difficultyPenalty = nextPenalty(save.difficultyHistory, previous, C8_DIFFICULTY);
  if (SOURCE_DIFFICULTY_PREVIEW) {
    const previousSource = save.sourceDifficultyPenalty ?? nextPenalty(save.sourceDifficultyHistory ?? [], 0, C8_DIFFICULTY);
    const entry = updateSourceDifficultySlot(save.attempt.sourceDifficulty, 'LevelWon').slot;
    save.sourceDifficultyHistory = [...(save.sourceDifficultyHistory ?? []), entry].slice(-DIFFICULTY_WINDOW);
    if (save.sourceDifficultyHistory.length === DIFFICULTY_WINDOW) {
      save.sourceDifficultyPenalty = nextPenalty(save.sourceDifficultyHistory, previousSource, C8_DIFFICULTY);
    }
  }
}

export function difficultyPenalty(save: Save): number {
  // A 0.19.4 save may already have a full history but no applied penalty.
  return save.difficultyPenalty ?? nextPenalty(save.difficultyHistory ?? [], 0, C8_DIFFICULTY);
}

export function easyDealTarget(input: {
  level: number; random: boolean; stable: boolean; previousLosses: number; difficulty: DifficultyTier; special: boolean;
}, config: {
  enabled: boolean; minLevel: number;
  byDifficulty: Partial<Record<DifficultyTier, { lossThreshold: number; targetSteps: number }>>;
}) {
  if (!config.enabled || input.level < config.minLevel || !input.random || !input.stable || input.special) return;
  const setting = config.byDifficulty[input.difficulty];
  if (!setting || !Number.isSafeInteger(setting.lossThreshold) || setting.lossThreshold < 1 ||
    !Number.isSafeInteger(setting.targetSteps) || setting.targetSteps < 1) return;
  if (!Number.isSafeInteger(input.previousLosses) || input.previousLosses < 0 || input.previousLosses + 1 < setting.lossThreshold) return;
  return setting.targetSteps;
}

/** Full source event history takes precedence only in the isolated director build. */
export function futureDifficultyPenalty(save: Save): number {
  const source = save.sourceDifficultyHistory;
  if (!SOURCE_DIFFICULTY_PREVIEW || !source || source.length < DIFFICULTY_WINDOW) return difficultyPenalty(save);
  return save.sourceDifficultyPenalty ?? nextPenalty(source, 0, C8_DIFFICULTY);
}

export function planFutureDifficulty(input: Parameters<typeof easyDealTarget>[0] & {
  baseBudget: number;
  levelPenalty: number;
  historyPenalty: number;
}, easy: Parameters<typeof easyDealTarget>[1]) {
  return {
    penalty: input.levelPenalty + input.historyPenalty,
    effectiveBudget: adjustedMoveBudget(input.baseBudget, input.levelPenalty + input.historyPenalty, input.stable),
    easyTarget: easyDealTarget(input, easy),
  };
}

export function recordCampaignExhaustion(attempt: Attempt) {
  const progress = attempt.director ??= { restarts: 0, previousLosses: 0 };
  progress.exhausted = true;
}

export function carryCampaignRestart(previous: Attempt, next: Attempt) {
  const { restarts = 0, previousLosses = 0, exhausted = previous.board.phase === 'exhausted' } = previous.director ?? {};
  if (SOURCE_DIFFICULTY_PREVIEW) next.sourceDifficulty = updateSourceDifficultySlot(previous.sourceDifficulty, 'RestartedLevelBegin').slot;
  next.director = { restarts: restarts + 1, previousLosses: previousLosses + Number(exhausted) };
}

export function difficultyStats(history: readonly CampaignOutcome[]) {
  if (history.length < DIFFICULTY_WINDOW) return;
  const window = history.slice(-DIFFICULTY_WINDOW);
  const clean = window.filter(entry => entry.outcome === 'Clean').length;
  const weight = window.reduce((total, entry) => total + (entry.outcome === 'Restart' ? 1 / (entry.restarts + 1) : 1), 0);
  // Product rounding for the rate. Native tie rounding for this statistic is open.
  return { cleanRate: clean * 10, adjustedRate: Math.round(weight * 10) };
}

export function nextPenalty(history: readonly CampaignOutcome[], current: number, config: {
  minRate: number; maxRate: number; hardPenalty: number; easyPenalty: number;
}): number {
  const { minRate, maxRate, hardPenalty, easyPenalty } = config;
  if (![minRate, maxRate].every(rate => Number.isFinite(rate) && rate >= 0 && rate <= 100) ||
    minRate > maxRate || ![hardPenalty, easyPenalty, current].every(isInt32)) throw Error('Invalid difficulty configuration');
  const stats = difficultyStats(history);
  if (!stats) return current;
  if (stats.adjustedRate > maxRate) return current > 0 ? 0 : hardPenalty;
  if (stats.adjustedRate < minRate) return current < 0 ? 0 : easyPenalty;
  return current;
}

/** Hitapps GetStepsLimit numeric contract on signed source inputs. */
export function adjustedMoveBudget(base: number, penalty: number, stableMoves: boolean): number {
  if (![base, penalty].every(isInt32)) throw Error('Invalid authored budget or penalty');
  if (!stableMoves || penalty === 0) return base;
  const delta = Math.fround(Math.fround(Math.imul(base, penalty)) / 100);
  return (base + (delta < 0 ? -Math.round(-delta) : Math.round(delta))) | 0;
}

type SourceProgressEvent = 'ContinueRequested' | 'RestartedLevelBegin' | 'LevelWon';

/** Native-static transition of the current slot. Original timing/config remains device evidence. */
export function updateSourceDifficultySlot(slot: CampaignOutcome | undefined, event: SourceProgressEvent) {
  if (event === 'RestartedLevelBegin') return {
    slot: { outcome: 'Restart', restarts: (slot?.restarts ?? 0) + 1 } satisfies CampaignOutcome, advance: false,
  };
  if (event === 'ContinueRequested') return {
    slot: slot?.outcome === 'Restart' ? slot : { outcome: 'ExtraSteps', restarts: 0 } satisfies CampaignOutcome,
    advance: false,
  };
  return { slot: slot ?? { outcome: 'Clean', restarts: 0 } satisfies CampaignOutcome, advance: true };
}

export const SOURCE_DIFFICULTY_PREVIEW = import.meta.env?.VITE_C8_OWNER_PREVIEW === 'director';

export function recordSourceContinue(save: Save, deal: { campaignLevel?: number }) {
  const attempt = save.attempt;
  if (!SOURCE_DIFFICULTY_PREVIEW || attempt.daily || deal.campaignLevel === undefined ||
      attempt.board.phase !== 'exhausted' || attempt.sourceDifficulty?.outcome === 'Restart' ||
      attempt.sourceDifficulty?.outcome === 'ExtraSteps') return;
  attempt.sourceDifficulty = updateSourceDifficultySlot(attempt.sourceDifficulty, 'ContinueRequested').slot;
  save.revision++;
}
