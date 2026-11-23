import { selectPriority } from './plain-dealer';

export const SOURCE_SEED_MAX_EXCLUSIVE = 2147483647;

/** A negative shuffle request draws from a separate stream before EmbeddedRandom. */
export function resolveCandidateSeed(requested: number, drawSeed: (maxExclusive: number) => number): number {
  if (!Number.isInteger(requested) || requested < -2147483648 || requested > SOURCE_SEED_MAX_EXCLUSIVE)
    throw Error('Expected Int32 requested seed');
  if (requested >= 0) return requested;
  const seed = drawSeed(SOURCE_SEED_MAX_EXCLUSIVE);
  if (!Number.isInteger(seed) || seed < 0 || seed >= SOURCE_SEED_MAX_EXCLUSIVE)
    throw Error('Candidate seed draw is outside the source range');
  return seed;
}

const phaseOrder = {
  initial: ['paywall', 'ordered'],
  shuffle: ['puzzleDistribution', 'lockers', 'frozen', 'bound'],
  final: ['golden', 'starterBooster'],
} as const;
type Phase = keyof typeof phaseOrder;
type Feature = (typeof phaseOrder)[Phase][number];

interface PhaseState<T> {
  snapshot: T;
  appliedFlags: number;
  failedFlags: number;
  levelShuffled: boolean;
}
type PhaseApplier<T> = (state: Readonly<PhaseState<T>>) => PhaseState<T>;
type FeatureAppliers<T> = Partial<Record<Feature, PhaseApplier<T>>>;

function runPhase<T>(phase: Phase, state: PhaseState<T>, appliers: FeatureAppliers<T>) {
  let next = state;
  for (const id of phaseOrder[phase]) next = appliers[id]?.(next) ?? next;
  return next;
}

function context<T>(snapshot: T, levelShuffled: boolean): PhaseState<T> {
  return { snapshot, levelShuffled, appliedFlags: 0, failedFlags: 0 };
}

export function prepareFreshPlan<T>(snapshot: T, appliers: FeatureAppliers<T>) {
  const initial = runPhase('initial', context(snapshot, false), appliers);
  return runPhase('final', runPhase('shuffle', initial, appliers), appliers);
}
export function prepareSimulatedShuffle<T>(snapshot: T, appliers: FeatureAppliers<T> = {}) {
  return runPhase('shuffle', context(snapshot, true), appliers);
}
export function completeSimulatedPlan<T>(shuffled: PhaseState<T>, appliers: FeatureAppliers<T> = {}) {
  return runPhase('final', structuredClone(shuffled), appliers);
}

export function preparePriorityPlan<T, V>(options: {
  requests: Iterable<number>;
  drawSeed: (maxExclusive: number) => number;
  shuffle: (seed: number) => T;
  evaluate: (state: Readonly<PhaseState<T>>) => { steps: number; value: V } | undefined;
  digest: (state: Readonly<PhaseState<T>>) => string;
  target: number;
  tolerancePercent: number;
  appliers?: FeatureAppliers<T>;
}) {
  const appliers = options.appliers ?? {};
  const prepare = (seed: number) => prepareSimulatedShuffle(options.shuffle(seed), appliers);
  const selection = selectPriority(options.requests, requestedSeed => {
    const seed = resolveCandidateSeed(requestedSeed, options.drawSeed);
    const state = prepare(seed);
    const evaluation = options.evaluate(state);
    if (evaluation) return { seed, steps: evaluation.steps, value: {
      requestedSeed, state, digest: options.digest(state), evaluation: evaluation.value,
    } };
  }, options.target, options.tolerancePercent);
  const best = selection.candidate;
  if (!best) return { attempts: selection.attempts, reason: selection.reason };
  // On the bounded exit the source rebuilds the best seed and reruns Shuffle.
  const restored = selection.reachedCap ? prepare(best.seed) : best.value.state;
  if (options.digest(restored) !== best.value.digest) throw Error('Candidate changed while restoring the selected seed');
  return {
    attempts: selection.attempts, reason: selection.reason,
    selected: {
      requestedSeed: best.value.requestedSeed, actualSeed: best.seed, steps: best.steps,
      evaluation: best.value.evaluation, afterShuffle: restored, final: completeSimulatedPlan(restored, appliers),
    },
  };
}

/** Use for eligible Shuffle-phase appliers. An invalid pattern may fail after reseeding. */
export function applyShufflePattern<T>(state: PhaseState<T>, options: {
  enabled: boolean; level: number; minLevel: number; pattern: number; featureSeed: number;
  shuffle: (snapshot: T, seed: number) => T;
  apply: (snapshot: T, pattern: number) => T | undefined;
  appliedFlag: number; failedFlag: number;
}): PhaseState<T> {
  const { enabled, level, minLevel, pattern, featureSeed } = options;
  if (!enabled || level < minLevel || !Number.isInteger(pattern) || pattern < 0 ||
    !Number.isInteger(featureSeed) || featureSeed <= 0 || featureSeed > SOURCE_SEED_MAX_EXCLUSIVE) return state;
  const snapshot = state.levelShuffled ? state.snapshot : options.shuffle(state.snapshot, featureSeed);
  const applied = options.apply(snapshot, pattern);
  return applied === undefined
    ? { ...state, snapshot, levelShuffled: true, failedFlags: state.failedFlags | options.failedFlag }
    : { ...state, snapshot: applied, levelShuffled: true, appliedFlags: state.appliedFlags | options.appliedFlag };
}
