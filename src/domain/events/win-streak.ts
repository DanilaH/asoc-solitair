import { CAMPAIGN_META } from '../../config/campaign-meta';
import type { Save } from '../types';

export const WIN_STREAK = [
  { wins: 2, coins: 30, hints: 0 },
  { wins: 3, coins: 70, hints: 1 },
  { wins: 5, coins: 100, hints: 1 },
] as const;

export interface WinStreak {
  version: 1;
  earned: number;
  claimed: number;
  progress: number;
}

const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;
const stage = (earned: number) => WIN_STREAK[earned % WIN_STREAK.length];

export function validWinStreak(value: WinStreak) {
  return Boolean(value && value.version === 1 && natural(value.earned) && natural(value.claimed) &&
    value.claimed <= value.earned && natural(value.progress) && value.progress < stage(value.earned).wins);
}

export function stagedStreak(save: Save) {
  return CAMPAIGN_META && (Boolean(save.meta?.winStreak) || !save.meta?.winCycle);
}

export function streakStatus(save: Save) {
  const state = save.meta?.winStreak;
  const earned = state?.earned ?? 0;
  return { progress: state?.progress ?? 0, goal: stage(earned).wins,
    index: earned % WIN_STREAK.length, ready: earned - (state?.claimed ?? 0), reward: stage(earned) };
}

export function addWinStreakProgress(save: Save, wins: number) {
  if (!save.meta || !natural(wins) || !wins) return;
  const state = save.meta.winStreak ??= { version: 1, earned: 0, claimed: 0, progress: 0 };
  while (wins > 0) {
    const goal = stage(state.earned).wins;
    const accepted = Math.min(wins, goal - state.progress);
    state.progress += accepted;
    wins -= accepted;
    if (state.progress === goal) {
      state.earned++;
      state.progress = 0;
    }
  }
}

export function finalizeStreakLoss(save: Save) {
  if (save.meta?.winStreak) save.meta.winStreak.progress = 0;
}

export function claimWinStreak(save: Save, expectedClaimed: number) {
  const state = save.meta?.winStreak;
  if (!state || expectedClaimed !== state.claimed || state.claimed === state.earned) return;
  let coins = 0, hints = 0;
  for (let index = state.claimed; index < state.earned; index++) {
    const prize = stage(index);
    coins += prize.coins; hints += prize.hints;
  }
  if (!natural(save.profile.coins + coins) || !natural(save.profile.hints + hints)) return;
  save.profile.coins += coins; save.profile.hints += hints;
  state.claimed = state.earned;
  return { coins, hints };
}
