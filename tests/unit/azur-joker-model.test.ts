import { expect, it, vi } from 'vitest';
import { modelAzurRandomJoker, type AzurJokerBoard } from '../../tools/content/azur-joker-model';

const board: AzurJokerBoard<string> = {
  version: 1, cardIds: ['a', 'b', 'c', 'stock'], tableau: [['a'], ['b'], ['c']], faceUp: ['a', 'b', 'c'], undo: ['prior'],
};

it('consumes one bounded draw, places a new face-up card and clears history on success', () => {
  const range = vi.fn(() => 1);
  const result = modelAzurRandomJoker(board, 4, range, () => 'new-joker');
  expect(range).toHaveBeenCalledExactlyOnceWith(0, 3);
  expect(result).toEqual({
    status: 'INSERTED',
    state: { ...board, cardIds: ['a', 'b', 'c', 'stock', 'new-joker'],
      tableau: [['a'], ['b', 'new-joker'], ['c']], faceUp: ['a', 'b', 'c', 'new-joker'], undo: [] },
    card: { id: 'new-joker', nativeType: 2, column: 1, faceUp: true }, event: 'JOKER_USED',
  });
  expect(board.undo).toEqual(['prior']);
  expect(board.tableau[1]).toEqual(['b']);
  const noController = { ...board, undo: undefined };
  expect(modelAzurRandomJoker(noController, 1, () => 0, () => 'other-joker').state.undo).toBeUndefined();
});

it('does not clear Undo or emit success for invalid configuration, target or allocation', () => {
  const range = vi.fn(() => 0), allocate = vi.fn(() => 'stock');
  for (const bound of [0, -1, 1.5, NaN]) {
    expect(modelAzurRandomJoker(board, bound, range, allocate)).toEqual({ status: 'INVALID_CONFIG', state: board });
  }
  const empty = { ...board, tableau: [] };
  expect(modelAzurRandomJoker(empty, 2, range, allocate)).toEqual({ status: 'NO_COLUMN', state: empty });
  expect(range).not.toHaveBeenCalled();
  expect(modelAzurRandomJoker(board, 1, () => 1, allocate)).toEqual({ status: 'INVALID_TARGET', state: board });
  expect(allocate).not.toHaveBeenCalled();
  expect(modelAzurRandomJoker(board, 1, range, allocate)).toEqual({ status: 'INVALID_CARD', state: board });
  expect(modelAzurRandomJoker(board, 1, range, () => undefined)).toEqual({ status: 'INVALID_CARD', state: board });
  expect(board.undo).toEqual(['prior']);
});
