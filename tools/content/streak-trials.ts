interface Award { id: string; coins: number; claimed?: true }
interface TrialWindow { id: string; start: number; end: number }
interface StreakOutcome {
  attemptId: string;
  at: number;
  mode: 'campaign' | 'daily';
  result: 'first-win' | 'replay-win' | 'abandoned-loss';
}
export interface StreakTrials {
  version: 1;
  window: TrialWindow;
  observedAt: number;
  coins: number;
  hitapps: { consecutive: number; attempts: string[] };
  unico: { wins: number; taskRun: number; taskDay?: string; attempts: string[] };
  azur: { attemptId?: string; combo: number; peak: number; moves: string[] };
  earned: Award[];
}

const dayMs = 86_400_000;
const natural = (n: number) => Number.isSafeInteger(n) && n >= 0;
const key = (id: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(id);
const active = (state: StreakTrials, at: number) => state.version === 1 && natural(at) && at <= 8.64e15 && at >= state.observedAt &&
  at >= state.window.start && at < state.window.end;

export function streakTrial(window: TrialWindow, coins: number): StreakTrials {
  return { version: 1, window, coins, observedAt: 0, hitapps: { consecutive: 0, attempts: [] },
    unico: { wins: 0, taskRun: 0, attempts: [] }, azur: { combo: 0, peak: 0, moves: [] }, earned: [] };
}

function milestone(state: StreakTrials, track: string, count: number, at: number, threshold: number, coins: number) {
  const id = `${state.window.id}:${track}:${threshold}`;
  return { observedAt: at, earned: count >= threshold && !state.earned.some(award => award.id === id)
    ? [...state.earned, { id, coins }] : state.earned };
}

export function hitappsStreakTrial(state: StreakTrials, event: StreakOutcome): StreakTrials {
  const { hitapps } = state;
  if (!active(state, event.at) || event.mode !== 'campaign' || !key(event.attemptId) || event.result === 'replay-win' ||
    hitapps.attempts.includes(event.attemptId)) return state;
  const consecutive = event.result === 'first-win' ? hitapps.consecutive + 1 : 0;
  return { ...state, hitapps: { consecutive, attempts: [...hitapps.attempts, event.attemptId] },
    ...milestone(state, 'hitapps-win', consecutive, event.at, 3, 15) };
}

export function unicoWinTrial(state: StreakTrials, event: StreakOutcome): StreakTrials {
  const { unico } = state;
  if (!active(state, event.at) || !key(event.attemptId) || event.result === 'replay-win' || unico.attempts.includes(event.attemptId)) return state;
  const wins = event.result === 'first-win' ? unico.wins + 1 : 0;
  return { ...state, unico: { ...unico, wins, attempts: [...unico.attempts, event.attemptId] },
    ...milestone(state, 'unico-win', wins, event.at, 2, 10) };
}

export function unicoTaskTrial(state: StreakTrials, item: { at: number; dayUtc: string; completedDailySet: boolean }): StreakTrials {
  const { unico } = state;
  if (!active(state, item.at) || !item.completedDailySet || !/^\d{4}-\d{2}-\d{2}$/.test(item.dayUtc) ||
    item.dayUtc !== new Date(item.at).toISOString().slice(0, 10) || item.dayUtc <= (unico.taskDay ?? '')) return state;
  const consecutive = unico.taskDay !== undefined && Date.parse(item.dayUtc) - Date.parse(unico.taskDay) === dayMs;
  const taskRun = consecutive ? unico.taskRun + 1 : 1;
  return { ...state, unico: { ...unico, taskRun, taskDay: item.dayUtc },
    ...milestone(state, 'unico-task', taskRun, item.at, 2, 5) };
}

export function azurComboTrial(state: StreakTrials, move: { at: number; attemptId: string; moveId: string;
  action: 'transfer' | 'draw' | 'recycle' | 'undo'; accepted: boolean }): StreakTrials {
  const { azur } = state;
  if (!active(state, move.at) || !move.accepted || !key(move.attemptId) || !key(move.moveId) || azur.moves.includes(move.moveId)) return state;
  const combo = move.action === 'transfer' ? (azur.attemptId === move.attemptId ? azur.combo : 0) + 1 : 0;
  const peak = Math.max(azur.peak, combo);
  return { ...state, azur: { attemptId: move.attemptId, combo, peak, moves: [...azur.moves, move.moveId] },
    ...milestone(state, 'azur-combo', peak, move.at, 4, 8) };
}

export function claimStreakTrial(state: StreakTrials, id: string): StreakTrials {
  const award = state.earned.find(offer => offer.id === id);
  if (!award || award.claimed || !natural(state.coins + award.coins)) return state;
  return { ...state, coins: state.coins + award.coins, earned: state.earned.map(offer => offer === award ? { ...offer, claimed: true } : offer) };
}
