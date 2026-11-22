const whole = (n: number) => Number.isSafeInteger(n) && n >= 0;
const positive = (n: number) => whole(n) && n > 0;

export interface TrialEventWindow { id: string; enabled: boolean; start: number; end: number; minimumLevel: number }
function inWindow(rule: TrialEventWindow, now: number, level: number): boolean {
  return rule.enabled && whole(now) && rule.start <= now && now < rule.end && level >= rule.minimumLevel;
}

interface RaceStage { goal: number; coins: number; trainingOpponents: readonly { id: string; intervalMs: number }[] }
interface RaceState { version: 1; stage: number; stageStartedAt: number; progress: number; uniqueWins: readonly string[];
  payout: number; claimed: readonly number[] }
export type RaceConfig = TrialEventWindow & { stages: readonly RaceStage[] };

export function raceRanks(config: RaceConfig, state: RaceState, now: number) {
  const stage = config.stages[state.stage];
  if (!stage) return [];
  const elapsed = Math.max(0, Math.min(now, config.end) - state.stageStartedAt);
  return [{ id: 'player', role: 'player' as const, points: state.progress },
    ...stage.trainingOpponents.filter(bot => positive(bot.intervalMs)).map(bot => ({
      id: bot.id, role: 'simulation' as const, points: Math.min(stage.goal, Math.floor(elapsed / bot.intervalMs)),
    }))].sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
}

export function raceWin(config: RaceConfig, state: RaceState, level: number, winId: string, now: number): RaceState {
  const stage = config.stages[state.stage];
  if (state.version !== 1 || !stage || !positive(stage.goal) || !inWindow(config, now, level) || now < state.stageStartedAt ||
    !winId || state.uniqueWins.includes(winId) || state.progress >= stage.goal) return state;
  return { ...state, progress: state.progress + 1, uniqueWins: [...state.uniqueWins, winId] };
}

export function claimRace(config: RaceConfig, state: RaceState, now: number): RaceState {
  const stage = config.stages[state.stage];
  if (!stage || state.progress < stage.goal || state.claimed.includes(state.stage) || !whole(now) || now < state.stageStartedAt ||
    !whole(stage.coins) || !whole(state.payout + stage.coins)) return state;
  return { ...state, stage: state.stage + 1, stageStartedAt: now, progress: 0, payout: state.payout + stage.coins,
    claimed: [...state.claimed, state.stage] };
}

interface LavaState { attemptOutcomes: readonly string[]; stages: readonly number[]; consecutive: number; claimed: readonly number[]; payout: number }
export function advanceLava(state: LavaState, event: { id: string; firstAttempt: boolean; won: boolean }): LavaState {
  if (!event.id || state.attemptOutcomes.includes(event.id)) return state;
  const consecutive = event.firstAttempt && event.won ? state.consecutive + 1 : 0;
  const reached = [2, 4].includes(consecutive) && !state.stages.includes(consecutive);
  return { ...state, attemptOutcomes: [...state.attemptOutcomes, event.id], consecutive,
    stages: reached ? [...state.stages, consecutive] : state.stages };
}

export function claimLava(state: LavaState, stage: number): LavaState {
  const coins = stage === 2 ? 10 : stage === 4 ? 24 : 0;
  return !coins || !state.stages.includes(stage) || state.claimed.includes(stage) || !whole(state.payout + coins) ? state :
    { ...state, claimed: [...state.claimed, stage], payout: state.payout + coins };
}

interface LifePolicy { enabled: boolean; max: number; refillMs: number }
interface LifeState { lives: number; refillAt?: number; observedAt: number; losses: readonly string[] }

export function observeLives(state: LifeState, policy: LifePolicy, now: number): LifeState {
  if (!policy.enabled || !positive(policy.max) || !positive(policy.refillMs) || !whole(now) || now < state.observedAt) return state;
  if (state.refillAt === undefined || now < state.refillAt) return now === state.observedAt ? state : { ...state, observedAt: now };
  const refills = 1 + Math.floor((now - state.refillAt) / policy.refillMs);
  const lives = Math.min(policy.max, state.lives + refills);
  return { ...state, lives, observedAt: now, refillAt: lives === policy.max ? undefined : state.refillAt + refills * policy.refillMs };
}

export function spendTrialLife(state: LifeState, policy: LifePolicy, result: { at: number; attemptId: string; finalLoss: boolean }) {
  if (!policy.enabled || !positive(policy.max) || !positive(policy.refillMs) || !whole(result.at) || result.at < state.observedAt ||
    !result.finalLoss || !result.attemptId || state.losses.includes(result.attemptId)) return state;
  const available = observeLives(state, policy, result.at);
  if (!available.lives) return available;
  return { ...available, lives: available.lives - 1, losses: [...available.losses, result.attemptId],
    refillAt: available.refillAt ?? result.at + policy.refillMs };
}

interface GoldPlan { attemptId: string; dealId: string; at: number; markerLimit: number; cardIds: readonly string[] }
interface GoldTrial { plans: readonly GoldPlan[]; wins: readonly string[]; progress: number; claimed: boolean; payout: number }
export type GoldConfig = TrialEventWindow & { markerLimit: number; goal: number; prizeCoins: number };

export function goldFinalPlan(state: GoldTrial, config: GoldConfig, plan: Omit<GoldPlan, 'markerLimit'>, level: number): GoldTrial {
  if (!inWindow(config, plan.at, level) || !plan.attemptId || !plan.dealId || !positive(config.markerLimit) ||
    !plan.cardIds.length || plan.cardIds.length > config.markerLimit || plan.cardIds.some(id => !id) || new Set(plan.cardIds).size !== plan.cardIds.length ||
    state.plans.some(previous => previous.attemptId === plan.attemptId)) return state;
  return { ...state, plans: [...state.plans, { ...plan, markerLimit: config.markerLimit }] };
}
export function scoreGoldWin(state: GoldTrial, win: { attemptId: string; dealId: string; won: boolean; collected: readonly string[] }): GoldTrial {
  const plan = state.plans.find(entry => entry.attemptId === win.attemptId && entry.dealId === win.dealId);
  if (!plan || !win.won || !win.collected.length || state.wins.includes(win.attemptId) || new Set(win.collected).size !== win.collected.length ||
    win.collected.some(item => !plan.cardIds.includes(item)) || win.collected.length > plan.markerLimit) return state;
  return { ...state, wins: [...state.wins, win.attemptId], progress: state.progress + win.collected.length };
}
export function claimGoldTrial(state: GoldTrial, config: GoldConfig): GoldTrial {
  return state.claimed || !positive(config.goal) || state.progress < config.goal || !whole(config.prizeCoins) || !whole(state.payout + config.prizeCoins)
    ? state : { ...state, claimed: true, payout: state.payout + config.prizeCoins };
}

export function prewarmEvents(now: number, level: number, candidates: readonly (TrialEventWindow & { priority: number })[]) {
  const ordered = candidates.filter(config => inWindow(config, now, level) && whole(config.priority))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  return [...new Set(ordered.map(config => config.id))].map(eventId => ({ eventId, action: 'prepare-assets' as const }));
}
