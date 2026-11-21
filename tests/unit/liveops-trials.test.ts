import { expect, it } from 'vitest';
import { advanceLava, claimGoldTrial, claimLava, claimRace, goldFinalPlan, observeLives, prewarmEvents,
  raceRanks, raceWin, scoreGoldWin, spendTrialLife } from '../../tools/content/liveops-trials';

const window = { id: 'trial', start: 100, end: 1000, enabled: true, minimumLevel: 16 };

it('runs Race stages and clearly labels timed simulation opponents', () => {
  const rules = { ...window, stages: [{ goal: 2, coins: 20, trainingOpponents: [{ id: 'bot-one', intervalMs: 60 }] }] };
  const before = { version: 1 as const, stage: 0, stageStartedAt: 100, progress: 0, payout: 0, claimed: [], uniqueWins: [] };
  const first = raceWin(rules, before, 16, 'win-1', 170);
  expect(raceWin(rules, first, 16, 'win-1', 170)).toBe(first);
  expect(raceRanks(rules, first, 170)).toContainEqual({ id: 'bot-one', role: 'simulation', points: 1 });
  expect(claimRace(rules, first, 170)).toBe(first);
  const second = raceWin(rules, first, 16, 'win-2', 200);
  expect(claimRace(rules, second, 1200)).toMatchObject({ stage: 1, payout: 20, claimed: [0] });
});

it('keeps Lava first-attempt wins and Lives independent', () => {
  const lava = { attemptOutcomes: [], stages: [], consecutive: 0, claimed: [], payout: 0 };
  let advanced = advanceLava(lava, { id: 'win', won: true, firstAttempt: true });
  advanced = advanceLava(advanced, { id: 'win-2', won: true, firstAttempt: true });
  advanced = advanceLava(advanced, { id: 'replay', won: true, firstAttempt: false });
  expect(advanced).toMatchObject({ consecutive: 0, stages: [2] });
  expect(claimLava(advanced, 2).claimed).toEqual([2]);

  const policy = { enabled: true, max: 3, refillMs: 60 };
  const lives = { lives: 3, losses: [], observedAt: 0 };
  const loss = { attemptId: 'attempt', finalLoss: true, at: 100 };
  expect(spendTrialLife(lives, { ...policy, enabled: false }, loss)).toBe(lives);
  const spent = spendTrialLife(lives, policy, loss);
  expect(spent.lives).toBe(2);
  expect(spendTrialLife(spent, policy, loss)).toBe(spent);
  expect(observeLives(spent, policy, 99)).toBe(spent);
  expect(observeLives(spent, policy, 160).lives).toBe(3);
});

it('separates a GoldRush Final plan from an actually claimed collection and prewarm', () => {
  const config = { ...window, markerLimit: 2, goal: 2, prizeCoins: 15 };
  const initial = { plans: [], wins: [], progress: 0, claimed: false, payout: 0 };
  const plan = { attemptId: 'attempt', dealId: 'gold', at: 150, cardIds: ['one', 'two'] };
  expect(goldFinalPlan(initial, { ...config, enabled: false }, plan, 16)).toBe(initial);
  const assigned = goldFinalPlan(initial, config, plan, 16);
  expect(assigned.progress).toBe(0);
  const win = { ...plan, won: true, collected: ['one', 'two'] };
  expect(scoreGoldWin(assigned, { ...win, dealId: 'mismatched' })).toBe(assigned);
  const scored = scoreGoldWin(assigned, win);
  expect(scored.progress).toBe(2);
  expect(scoreGoldWin(scored, win)).toBe(scored);
  expect(claimGoldTrial(scored, config)).toMatchObject({ claimed: true, payout: 15 });
  expect(prewarmEvents(160, 16, [{ ...window, priority: 2 }, { ...window, priority: 1, id: 'first' }]))
    .toEqual([{ eventId: 'first', action: 'prepare-assets' }, { eventId: 'trial', action: 'prepare-assets' }]);
});
