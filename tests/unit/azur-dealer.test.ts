import { expect, it, vi } from 'vitest';
import { dealAzur, generateAzurCards, shuffleAzurCards, traceAzurDeal } from '../../tools/content/azur-dealer';

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

it('creates a leader per theme and models zero, fallback, reduction and cyclic loaded-art counts separately', () => {
  const themes = [0, 3, 4, 3].map((wordCount, themeId) => ({ themeId, wordCount }));
  const loaded = new Map([[0, 8], [1, 0], [2, 2], [3, 5]]);
  const cards = generateAzurCards(themes, loaded);
  expect(cards.filter(card => card.kind === 'category').map(card => card.themeId)).toEqual([0, 1, 2, 3]);
  const members = cards.filter(card => card.kind === 'word');
  expect(members.map(({ themeId, memberOrdinal, wordIndex }) => [themeId, memberOrdinal, wordIndex])).toEqual([
    [1, 0, 0], [1, 1, 1], [1, 2, 2],
    [2, 0, 0], [2, 1, 1],
    [3, 0, 0], [3, 1, 1], [3, 2, 2], [3, 3, 0], [3, 4, 1],
  ]);
});

it('records exact injected draws and holds manager order separate from the shuffled clone for 3–5 columns', () => {
  const cards = Object.freeze(generateAzurCards([0, 1, 2].map(themeId => ({ themeId, wordCount: 7 }))));
  for (const columns of [3, 4, 5]) {
    const result = traceAzurDeal(cards, columns, 1, () => 0);
    expect(result.managerOrder).toEqual(cards);
    expect(result.shuffledOrder).toEqual([...cards.slice(1), cards[0]]);
    expect(result.tableau.map(column => column.length)).toEqual(Array.from({ length: columns }, (_, i) => i + 1));
    expect(result.faceUp).toEqual(result.tableau.map(column => column.at(-1)));
    expect(result.draws).toEqual(Array.from({ length: cards.length - 1 }, (_, i) => ({
      minInclusive: 0, maxExclusive: cards.length - i, result: 0,
    })));
    expect(shuffleAzurCards(cards, (_min, max) => max - 1)).not.toEqual(result.shuffledOrder);
  }
});
