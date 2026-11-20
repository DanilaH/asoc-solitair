import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { dealOrdinary, EmbeddedRandom, selectPriority, swapDestinations } from '../../tools/content/plain-dealer';

it('matches published EmbeddedRandom vectors and full-length swap bounds', () => {
  const vectors = [[0,1559595546,1755192844,1649316166,1198642031,442452829],
    [1,534011718,237820880,1002897798,1657007234,1412011072],
    [42,1434747710,302596119,269548474,1122627734,361709742]];
  for (const [seed, ...expected] of vectors) {
    const rng = new EmbeddedRandom(seed);
    expect(expected.map(() => rng.next())).toEqual(expected);
  }
  for (const size of [0, 1, 2, 3, 23, 26, 32, 35]) {
    const bounds: number[] = [], rng = new EmbeddedRandom(42);
    const positions = Array.from({ length: size }, (_, i) => i);
    swapDestinations(positions, n => { bounds.push(n); return rng.next(n); });
    expect(bounds).toEqual(Array(10 * Math.max(0, size - 1)).fill(size));
    expect(positions.slice().sort((a, b) => a - b)).toEqual(Array.from({ length: size }, (_, i) => i));
  }
});

it('reproduces all four published EN2/EN7 conditional hashes without card content', () => {
  for (const [stockSize, seed, sha] of [
    [23, 42, '019673b1e1f6f7fd54eb52d769ea0a8def0fa4c4613e9d8b218ccff5578d0566'],
    [23, 43, '296aa926fd1526bed9bc8327db50148a013d7e3b8c04e1d576abafb859ff7d87'],
    [26, 42, '3bdab594e4a0e281b66a460d2ab99d4bc96269bf1d0e35c619fbc8344952a79f'],
    [26, 43, '5333d12fa3aa7c83f7068067ff4a4d345ca037ee0595f8e811e17e458f2f09f0'],
  ] as const) {
    const { stock, tableau } = dealOrdinary(Array.from({ length: stockSize + 9 }, (_, i) => i), stockSize, [2, 3, 4], seed);
    expect(createHash('sha256').update(JSON.stringify({ stock_ids: stock, tableau_ids: tableau })).digest('hex')).toBe(sha);
  }
});

it('keeps closest proven win, retains ties and stops within tolerance', () => {
  const run = (seed: number) => seed ? { seed, steps: 10 + seed, value: seed } : undefined;
  expect(selectPriority([0, 3, 1, 4], run, 12, 0)?.seed).toBe(3);
  expect(selectPriority([0, 1, 2], run, 12, 10)?.seed).toBe(1);
  expect(selectPriority(Array.from({ length: 101 }, (_, i) => i), n => n === 100 ? run(n) : undefined, 12, 0)).toBeUndefined();
});
