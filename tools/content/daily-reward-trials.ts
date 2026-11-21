const DAY = 86_400_000;
const UTC = /^\d{4}-\d{2}-\d{2}$/;
const natural = (n: number) => Number.isSafeInteger(n) && n >= 0;
const token = (id: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(id);
const validDay = (day: string) => UTC.test(day) && new Date(Date.parse(day) || 0).toISOString().slice(0, 10) === day;
type RandomIndex = (count: number) => number;

interface BonusRound { dayUtc: string; columns: number; wonColumnIndex: number; chosen?: number }
interface FortuneRound { dayUtc: string; amounts: readonly number[]; picked?: number; second?: { requestId: string; choice: number; receiptId?: string } }

export interface DailyRewardTrial {
  schema: 1;
  lastObservedDay: string;
  wallet: number;
  bonus: readonly BonusRound[];
  login: { lastClaim?: string; dayIndex: number; received: number };
  fortune: readonly FortuneRound[];
}

export function emptyDailyTrials(wallet: number): DailyRewardTrial {
  return { schema: 1, lastObservedDay: '', wallet, bonus: [], login: { dayIndex: 0, received: 0 }, fortune: [] };
}

function eligibleDay(state: DailyRewardTrial, day: string): boolean {
  return state.schema === 1 && validDay(day) && day >= state.lastObservedDay;
}

export function openDailyBonus(state: DailyRewardTrial, day: string, columns: number, randomIndex: RandomIndex): DailyRewardTrial {
  if (!eligibleDay(state, day) || !natural(columns) || columns < 2 || columns > 8 || state.bonus.some(round => round.dayUtc === day)) return state;
  const chosen = randomIndex(columns);
  if (!natural(chosen) || chosen >= columns) return state;
  return { ...state, lastObservedDay: day, bonus: [...state.bonus, { dayUtc: day, columns, wonColumnIndex: chosen }] };
}

export function revealDailyBonus(state: DailyRewardTrial, day: string, column: number): DailyRewardTrial {
  const round = state.bonus.find(item => item.dayUtc === day);
  if (!eligibleDay(state, day) || !round || round.chosen !== undefined || !natural(column) || column >= round.columns) return state;
  const amount = column === round.wonColumnIndex ? 25 : 0;
  if (!natural(state.wallet + amount)) return state;
  return { ...state, lastObservedDay: day, wallet: state.wallet + amount,
    bonus: state.bonus.map(item => item === round ? { ...item, chosen: column } : item) };
}

export function claimLoginReward(state: DailyRewardTrial, day: string): DailyRewardTrial {
  if (!eligibleDay(state, day) || day === state.login.lastClaim) return state;
  const consecutive = state.login.lastClaim !== undefined && Date.parse(day) - Date.parse(state.login.lastClaim) === DAY;
  const values = [8, 12, 20] as const;
  const dayIndex = consecutive ? state.login.dayIndex % values.length + 1 : 1;
  const amount = values[dayIndex - 1];
  if (!natural(state.wallet + amount)) return state;
  return { ...state, lastObservedDay: day, wallet: state.wallet + amount,
    login: { lastClaim: day, dayIndex, received: state.login.received + 1 } };
}

export function openFortuneRound(state: DailyRewardTrial, day: string, randomIndex: RandomIndex): DailyRewardTrial {
  if (!eligibleDay(state, day) || state.fortune.some(round => round.dayUtc === day)) return state;
  const amounts = [4, 6, 10];
  for (let index = amounts.length - 1; index > 0; index--) {
    const chosen = randomIndex(index + 1);
    if (!natural(chosen) || chosen > index) return state;
    [amounts[index], amounts[chosen]] = [amounts[chosen], amounts[index]];
  }
  return { ...state, lastObservedDay: day, fortune: [...state.fortune, { dayUtc: day, amounts }] };
}

export function pickFortune(state: DailyRewardTrial, day: string, choice: number): DailyRewardTrial {
  const round = state.fortune.find(item => item.dayUtc === day);
  if (!eligibleDay(state, day) || !round || round.picked !== undefined || !natural(choice) || choice >= round.amounts.length ||
    !natural(state.wallet + round.amounts[choice])) return state;
  return { ...state, lastObservedDay: day, wallet: state.wallet + round.amounts[choice],
    fortune: state.fortune.map(item => item === round ? { ...item, picked: choice } : item) };
}

export function requestFortuneRetry(state: DailyRewardTrial, day: string, requestId: string, choice: number): DailyRewardTrial {
  const round = state.fortune.find(item => item.dayUtc === day);
  if (!eligibleDay(state, day) || !round || round.picked === undefined || round.picked === choice || round.second ||
    !natural(choice) || choice >= round.amounts.length || !token(requestId) ||
    state.fortune.some(item => item.second?.requestId === requestId)) return state;
  return { ...state, lastObservedDay: day, fortune: state.fortune.map(item => item === round ? { ...item, second: { requestId, choice } } : item) };
}

export function earnFortuneRetry(state: DailyRewardTrial, event: { day: string; requestId: string; receiptId: string }): DailyRewardTrial {
  const round = state.fortune.find(item => item.dayUtc === event.day && item.second?.requestId === event.requestId);
  if (!round?.second || round.second.receiptId || !token(event.receiptId) ||
    state.fortune.some(item => item.second?.receiptId === event.receiptId) || !natural(state.wallet + round.amounts[round.second.choice])) return state;
  const second = { ...round.second, receiptId: event.receiptId };
  return { ...state, wallet: state.wallet + round.amounts[second.choice],
    fortune: state.fortune.map(item => item === round ? { ...item, second } : item) };
}
