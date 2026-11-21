import { expect, it } from 'vitest';
import { azurComboTrial, claimStreakTrial, hitappsStreakTrial, streakTrial, unicoTaskTrial, unicoWinTrial } from '../../tools/content/streak-trials';

const DAY = 86_400_000, start = Date.UTC(2026, 10, 21);
const blank = () => streakTrial({ id: 'nov', start, end: start + DAY * 4 }, 100);
const win = { at: start, attemptId: 'win-1', mode: 'campaign', result: 'first-win' } as const;

it('resets the loss-aware Hitapps track while keeping an earned unclaimed reward across reload', () => {
  let state = hitappsStreakTrial(blank(), win);
  expect(hitappsStreakTrial(state, win)).toBe(state);
  state = hitappsStreakTrial(state, { ...win, attemptId: 'win-2' });
  state = hitappsStreakTrial(state, { ...win, attemptId: 'win-3' });
  const earned = state.earned[0].id;
  const lost = hitappsStreakTrial(state, { ...win, attemptId: 'loss', result: 'abandoned-loss' });
  expect(lost.hitapps.consecutive).toBe(0);
  const claimed = claimStreakTrial(JSON.parse(JSON.stringify(lost)), earned);
  expect(claimed.coins).toBe(115);
  expect(claimStreakTrial(claimed, earned)).toBe(claimed);
  expect(hitappsStreakTrial(claimed, { ...win, at: start + DAY * 4, attemptId: 'expired' })).toBe(claimed);
});

it('keeps Unico win and task-day streaks independent despite a lost game', () => {
  const won = unicoWinTrial(blank(), { ...win, mode: 'daily' });
  const dayOne = unicoTaskTrial(won, { at: start, dayUtc: '2026-11-21', completedDailySet: true });
  const lost = unicoWinTrial(dayOne, { ...win, attemptId: 'loss', result: 'abandoned-loss' });
  expect(lost.unico).toMatchObject({ wins: 0, taskRun: 1 });
  const dayTwo = unicoTaskTrial(lost, { at: start + DAY, dayUtc: '2026-11-22', completedDailySet: true });
  expect(dayTwo.unico.taskRun).toBe(2);
  expect(dayTwo.earned.map(p => p.id)).toEqual(['nov:unico-task:2']);
  expect(unicoTaskTrial(dayTwo, { at: start, dayUtc: '2026-11-21', completedDailySet: true })).toBe(dayTwo);
  expect(unicoTaskTrial(dayTwo, { at: start + DAY * 3, dayUtc: '2026-11-24', completedDailySet: true }).unico.taskRun).toBe(1);
});

it('tracks only committed combo actions and does not undo a paid milestone', () => {
  let state = blank();
  const move = { at: start, attemptId: 'combo', moveId: 'm1', action: 'transfer', accepted: true } as const;
  expect(azurComboTrial(state, { ...move, accepted: false })).toBe(state);
  for (let n = 1; n <= 4; n++) state = azurComboTrial(state, { ...move, moveId: `m${n}` });
  expect(state.azur).toMatchObject({ combo: 4, peak: 4 });
  const paid = claimStreakTrial(state, state.earned[0].id);
  const undo = azurComboTrial(paid, { ...move, moveId: 'undo', action: 'undo' });
  expect(undo.coins).toBe(108);
  expect(undo.azur).toMatchObject({ combo: 0, peak: 4 });
  expect(azurComboTrial(undo, move)).toBe(undo);
});
