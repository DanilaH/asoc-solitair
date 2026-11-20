import { expect, it, vi } from 'vitest';
import { dealAzur, shuffleAzurCards } from '../../tools/content/azur-dealer';

it.each([0, 1, 2, 100])('draws exactly N-1 times with a shrinking Unity range for %s cards', count => {
  const cards = Array.from({ length: count }, (_, i) => i);
  const range = vi.fn((_min: number, max: number) => max - 1);
  expect(shuffleAzurCards(cards, range)).toEqual(cards);
  expect(range.mock.calls).toEqual(Array.from({ length: Math.max(0, count - 1) }, (_, i) => [0, count - i]));
});

it('places consecutive ascending-size columns and opens only the last card of each', () => {
  const cards = Array.from({ length: 10 }, (_, i) => i);
  expect(dealAzur(cards, 3, 2, () => 0)).toEqual({
    tableau: [[1, 2], [3, 4, 5], [6, 7, 8, 9]], faceUp: [2, 5, 9], deckInput: [0],
  });
  expect(cards).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

it('checks sufficient cards before drawing and rejects invalid RNG output', () => {
  const range = vi.fn(() => 0);
  expect(() => dealAzur([1, 2, 3, 4], 2, 2, range)).toThrow('Insufficient');
  expect(range).not.toHaveBeenCalled();
  expect(() => shuffleAzurCards([1, 2], (_min, max) => max)).toThrow('outside');
  expect(() => shuffleAzurCards([1, 2], () => -1)).toThrow('outside');
});
