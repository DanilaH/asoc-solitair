import type { Attempt, CampaignOutcome, Save } from './types';

export const DIFFICULTY_WINDOW = 10;
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const isInt32 = (n: number) => Number.isInteger(n) && n >= INT32_MIN && n <= INT32_MAX;

export function recordCampaignOutcome(save: Save) {
  const restarts = save.attempt.director?.restarts ?? 0;
  const outcome: CampaignOutcome['outcome'] = restarts ? 'Restart' : save.attempt.continued ? 'ExtraSteps' : 'Clean';
  save.difficultyHistory = [...(save.difficultyHistory ?? []), { outcome, restarts }].slice(-DIFFICULTY_WINDOW);
}

export function recordCampaignExhaustion(attempt: Attempt) {
  const progress = attempt.director ??= { restarts: 0, previousLosses: 0 };
  progress.exhausted = true;
}

export function carryCampaignRestart(previous: Attempt, next: Attempt) {
  const { restarts = 0, previousLosses = 0, exhausted = previous.board.phase === 'exhausted' } = previous.director ?? {};
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
