import { expect, it } from 'vitest';
import { campaignDeals } from '../../src/content/campaign';
import { canReachTransfer, legalCommands } from '../../src/domain/engine';
import type { Board } from '../../src/domain/types';

it('only reports a stock loop when even the recycled waste cannot expose a transfer', () => {
  const source = campaignDeals[14];
  const board: Board = {
    ...source.initial,
    tableau: [['forest', 'hats', 'forest_1'], ['drinks', 'hats_1', 'drinks_1'],
      ['games', 'forest_2', 'forest_3', 'drinks_2', 'drinks_3', 'games_2', 'games_1']],
    stock: ['hats_2'], waste: ['hats_3', 'games_3'], movesLeft: 1,
  };
  board.faceUp = [...board.tableau.flat(), ...board.waste];
  const deal = { ...source, initial: board };
  expect(legalCommands(board, deal).map(action => action.type)).toEqual(['transfer', 'draw']);
  // With a mismatching card on top of the waste, the transfer only returns after recycle.
  board.waste.reverse();
  expect(legalCommands(board, deal).map(action => action.type)).toEqual(['draw']);
  expect(canReachTransfer(board, deal)).toBe(true);
  const blocked = { ...board, tableau: board.tableau.map(col => col.slice()), waste: ['hats_3'] };
  blocked.tableau[2].splice(1, 0, 'games_3');
  expect(canReachTransfer(blocked, deal)).toBe(false);
});
