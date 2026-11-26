/** Static, ordinary-path model. Only the offline authoring tools import it. */
const modulus = 2147483647;

export class EmbeddedRandom {
  private readonly state = new Int32Array(56);
  private at = 0;
  private other = 21;

  constructor(seed: number, private readonly observe?: (bound: number, value: number) => void) {
    if (!Number.isInteger(seed) || seed < -2147483648 || seed > modulus) throw new Error('Expected Int32 seed');
    let a = 161803398 - Math.min(modulus, Math.abs(seed)), b = 1;
    this.state[55] = a;
    for (let i = 1; i < 55; i++) {
      const slot = 21 * i % 55;
      this.state[slot] = b;
      b = (a - b) | 0;
      if (b < 0) b += modulus;
      a = this.state[slot];
    }
    for (let pass = 0; pass < 4; pass++) for (let i = 1; i < 56; i++) {
      const value = (this.state[i] - this.state[1 + (i + 30) % 55]) | 0;
      this.state[i] = value < 0 ? value + modulus : value;
    }
  }

  next(max = modulus): number {
    if (!Number.isInteger(max) || max < 0 || max > modulus) throw new Error('Invalid upper bound');
    this.at = this.at % 55 + 1;
    this.other = this.other % 55 + 1;
    let value = this.state[this.at] - this.state[this.other];
    if (value === modulus) value--;
    if (value < 0) value += modulus;
    this.state[this.at] = value;
    const draw = Math.floor(value / modulus * max);
    this.observe?.(max, draw);
    return draw;
  }
}

/** Call count is exactly 10 × max(0, N−1). The draw bound stays N throughout. */
export function swapDestinations(destinations: number[], next: (bound: number) => number): void {
  for (let pass = 0; pass < 10; pass++) for (let i = destinations.length - 1; i > 0; i--) {
    const j = next(destinations.length);
    [destinations[i], destinations[j]] = [destinations[j], destinations[i]];
  }
}

export function dealOrdinary<T>(cards: readonly T[], stockSize: number, columnSizes: readonly number[], seed: number | EmbeddedRandom) {
  if (!Number.isInteger(stockSize) || stockSize < 0 || stockSize > 256 || columnSizes.length > 256 ||
    columnSizes.some(n => !Number.isInteger(n) || n < 0) || stockSize + columnSizes.reduce((n, size) => n + size, 0) !== cards.length) {
    throw new Error('Invalid card and destination dimensions');
  }
  const labels = Array.from({ length: stockSize }, (_, i) => i << 8);
  columnSizes.forEach((size, i) => { for (let n = 0; n < size; n++) labels.push((i << 8) | 2); });
  const rng = typeof seed === 'number' ? new EmbeddedRandom(seed) : seed;
  swapDestinations(labels, bound => rng.next(bound));
  const stock = Array<T>(stockSize), tableau = columnSizes.map(() => [] as T[]);
  labels.forEach((label, i) => {
    const at = label >> 8;
    if ((label & 255) === 0) stock[at] = cards[i];
    else tableau[at].push(cards[i]);
  });
  return { stock, tableau };
}

export interface WinCandidate<T> { seed: number; steps: number; value: T }
const candidateCap = 100;

/** Hitapps SimulationHelper: float32 arithmetic, then round away from zero. */
export function sourceWithinTolerance(target: number, steps: number, stable: boolean, accuracy: number) {
  if (!stable || accuracy <= 0) return true;
  const tolerance = Math.round(Math.fround(Math.fround(Math.fround(target) * Math.fround(accuracy)) / 100));
  return Math.abs(target - steps) <= tolerance;
}

/** Ordinary Priority ranking, using our engine's proven wins as input. */
export function selectPriority<T>(seeds: Iterable<number>, simulateWin: (seed: number) => WinCandidate<T> | undefined,
  target: number, tolerancePercent: number, source?: { stable: boolean }) {
  if (!Number.isInteger(target) || target < 0 || !Number.isFinite(tolerancePercent) || tolerancePercent < 0 || tolerancePercent > 100)
    throw Error('Invalid Priority target or tolerance');
  let closest: WinCandidate<T> | undefined;
  let attempts = 0;
  for (const seed of seeds) {
    attempts++;
    const candidate = simulateWin(seed);
    if (candidate) {
      const gap = Math.abs(candidate.steps - target);
      if (!closest || gap < Math.abs(closest.steps - target)) closest = candidate;
      if (source ? sourceWithinTolerance(target, candidate.steps, source.stable, tolerancePercent) : gap * 100 <= target * tolerancePercent)
        return { candidate, attempts, reason: 'WITHIN_TOLERANCE' as const, reachedCap: false };
    }
    if (attempts === candidateCap) break;
  }
  return { candidate: closest, attempts, reason: closest ? 'CLOSEST_WIN' as const : 'NO_WIN' as const, reachedCap: attempts === candidateCap };
}
