import { expect, it, vi } from 'vitest';
import { prepareFreshPlan, preparePriorityPlan, resolveCandidateSeed, SOURCE_SEED_MAX_EXCLUSIVE } from '../../tools/content/candidate-pipeline';
import { EmbeddedRandom } from '../../tools/content/plain-dealer';

it('separates explicit shuffle requests, injected native-range draws and signed RNG construction', () => {
  const draw = vi.fn(() => 42);
  expect(resolveCandidateSeed(0, draw)).toBe(0);
  expect(resolveCandidateSeed(SOURCE_SEED_MAX_EXCLUSIVE, draw)).toBe(SOURCE_SEED_MAX_EXCLUSIVE);
  expect(draw).not.toHaveBeenCalled();
  expect(resolveCandidateSeed(-2147483648, draw)).toBe(42);
  expect(draw).toHaveBeenCalledExactlyOnceWith(SOURCE_SEED_MAX_EXCLUSIVE);
  expect(resolveCandidateSeed(-1, () => 0)).toBe(0);
  expect(() => resolveCandidateSeed(-1, () => SOURCE_SEED_MAX_EXCLUSIVE)).toThrow();
  expect(() => resolveCandidateSeed(-2147483649, draw)).toThrow();
  expect(new EmbeddedRandom(-42).next()).toBe(new EmbeddedRandom(42).next());
});

it('runs distinct fresh and simulated phase orders with the correct shuffle context', () => {
  const log: string[] = [];
  type State = ReturnType<typeof prepareFreshPlan<number>>;
  function feature(id: string, expected: boolean, failedFlags = 0) {
    return (state: State): State => {
      expect(state.levelShuffled).toBe(expected);
      log.push(id);
      return { ...state, levelShuffled: state.levelShuffled || id === 'lockers', failedFlags: state.failedFlags | failedFlags };
    };
  }
  const appliers = {
    starterBooster: feature('booster', true), golden: feature('golden', true),
    bound: feature('bound', true), frozen: feature('frozen', true, 64),
    lockers: feature('lockers', false), ordered: feature('ordered', false), paywall: feature('paywall', false),
  };
  expect(prepareFreshPlan(42, appliers).failedFlags).toBe(64);
  expect(log.splice(0)).toEqual(['paywall', 'ordered', 'lockers', 'frozen', 'bound', 'golden', 'booster']);

  const plan = preparePriorityPlan({
    requests: [-1], drawSeed: () => 7, shuffle: seed => { log.push('deal'); return seed; },
    evaluate(state) {
      log.push('evaluate');
      expect(state.failedFlags).toBe(64);
      return { steps: 12, value: state.snapshot };
    },
    digest: JSON.stringify,
    target: 12, tolerancePercent: 0,
    appliers: { ...appliers, lockers: feature('lockers', true) },
  });
  expect(log).toEqual(['deal', 'lockers', 'frozen', 'bound', 'evaluate', 'golden', 'booster']);
  expect(plan).toMatchObject({ attempts: 1, reason: 'WITHIN_TOLERANCE', selected: {
    requestedSeed: -1, actualSeed: 7, evaluation: 7, afterShuffle: { failedFlags: 64 },
  } });
});

it('rebuilds the first closest win at the bounded fallback and runs final exactly once', () => {
  const draw = vi.fn();
  const shuffle = vi.fn((seed: number) => ({ seed }));
  const evaluate = vi.fn(({ snapshot }: { snapshot: { seed: number } }) =>
    snapshot.seed === 5 || snapshot.seed === 6 ? { steps: 15, value: snapshot.seed } : undefined);
  const frozen = vi.fn((state: ReturnType<typeof prepareFreshPlan<{ seed: number }>>) => state);
  const golden = vi.fn((state: ReturnType<typeof prepareFreshPlan<{ seed: number }>>) => ({ ...state, appliedFlags: state.appliedFlags | 8 }));
  const plan = preparePriorityPlan({
    requests: Array.from({ length: 101 }, (_, i) => i), drawSeed: draw,
    shuffle, evaluate, digest: JSON.stringify, target: 20, tolerancePercent: 0,
    appliers: { frozen, golden },
  });
  expect(plan).toMatchObject({ attempts: 100, reason: 'CLOSEST_WIN', selected: {
    actualSeed: 5, afterShuffle: { appliedFlags: 0 }, final: { appliedFlags: 8 },
  } });
  expect(shuffle).toHaveBeenCalledTimes(101);
  expect(shuffle).toHaveBeenLastCalledWith(5);
  expect(frozen).toHaveBeenCalledTimes(101);
  expect(evaluate).toHaveBeenCalledTimes(100);
  expect(golden).toHaveBeenCalledTimes(1);
  expect(draw).not.toHaveBeenCalled();
});

it('preserves no-win as an authoring result without running Final', () => {
  const golden = vi.fn();
  const plan = preparePriorityPlan({
    requests: [1, 2, 3], drawSeed: vi.fn(), shuffle: seed => seed, evaluate: () => undefined,
    digest: JSON.stringify, target: 20, tolerancePercent: 0, appliers: { golden },
  });
  expect(plan).toEqual({ attempts: 3, reason: 'NO_WIN' });
  expect(golden).not.toHaveBeenCalled();
});
