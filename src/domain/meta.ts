import { BALANCE } from './balance';
import type { RewardGrant, Save } from './types';
export const metaState = (save: Save) => save.meta ??= { version: 1, winCycle: 0, cycles: 0, dailyDates: [], dailyStreak: 0 };
export const daysLabel = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'дня' : 'дней'}`;
export const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function dayNumber(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('Некорректная дата');
  const n = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== day) throw Error('Некорректная дата');
  return n / 86400000;
}
export function campaignCount(save: Save): number {
  const ids = save.platform?.completedCampaign ?? []; let n = 0;
  while (ids.includes(`campaign-${String(n + 1).padStart(3, '0')}`)) n++;
  return n;
}
export const cosmeticUnlocked = (save: Save, kind: 'palette' | 'cardBack') => campaignCount(save) >= (kind === 'palette' ? 10 : 20);
function grant(save: Save, reward: RewardGrant): RewardGrant[] {
  if (save.profile.rewards.includes(reward.key)) return [];
  save.profile.rewards.push(reward.key); save.profile.coins += reward.coins;
  save.profile.hints += reward.hints ?? 0; save.profile.undos += reward.undos ?? 0;
  return [reward];
}
export function milestoneRewards(save: Save): RewardGrant[] {
  const rewards: RewardGrant[] = [];
  for (let level = 10; level <= campaignCount(save); level += 10) rewards.push(...grant(save, { key: `milestone:${level}`, reason: 'campaign_milestone', label: `Веха · ${level} уровней${level === 10 ? ' · стол «Чернила»' : level === 20 ? ' · рубашка «Ромбы»' : ''}`, coins: BALANCE.meta.milestoneCoins }));
  return rewards;
}
/** Called only after the first-clear ledger accepts a new campaign id. */
export function campaignRewards(save: Save): RewardGrant[] {
  const state = metaState(save), rewards = milestoneRewards(save);
  if (++state.winCycle === 5) {
    state.winCycle = 0; state.cycles++;
    rewards.push(...grant(save, { key: `cycle:${state.cycles}`, reason: 'campaign_win_cycle', label: 'Пять новых побед', coins: BALANCE.meta.cycleCoins, hints: BALANCE.meta.cycleHints }));
  }
  return rewards;
}
export function abandonCampaign(save: Save): void { if (!save.attempt.daily && save.attempt.board.phase !== 'won') metaState(save).winCycle = 0; }
export const dailyRewardEligible = (save: Save, today: string) => save.attempt.daily?.dayId === today && !metaState(save).dailyDates.includes(today);
export function currentDailyStreak(save: Save, today: string): number {
  const state = metaState(save);
  return state.lastDaily && dayNumber(today) - dayNumber(state.lastDaily) <= 1 ? state.dailyStreak : 0;
}
export function finishDaily(save: Save, today: string): RewardGrant[] {
  if (!dailyRewardEligible(save, today)) return [];
  const state = metaState(save), previous = state.lastDaily;
  const backwards = previous !== undefined && dayNumber(today) < dayNumber(previous);
  // A backwards clock cannot add consecutive-day progress; dates/reward identities remain durable.
  if (!backwards) {
    state.dailyStreak = previous && dayNumber(today) - dayNumber(previous) === 1 ? state.dailyStreak + 1 : 1;
    state.lastDaily = today;
  }
  state.dailyDates.push(today);
  const rewards = grant(save, { key: `daily:${today}`, reason: 'daily_completion', label: 'Задание дня', coins: BALANCE.meta.dailyCoins });
  if (!backwards && (state.dailyStreak === 3 || state.dailyStreak % 7 === 0)) {
    const seven = state.dailyStreak % 7 === 0;
    rewards.push(...grant(save, { key: `daily-streak:${today}:${state.dailyStreak}`, reason: 'daily_streak_milestone', label: `${daysLabel(state.dailyStreak)} подряд`, coins: seven ? BALANCE.meta.day7Coins : BALANCE.meta.day3Coins, ...(seven ? { undos: BALANCE.meta.day7Undos } : {}) }));
  }
  return rewards;
}
