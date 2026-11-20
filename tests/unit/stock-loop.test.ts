import { expect, it } from 'vitest';
import { campaignDeals } from '../../src/content/campaign';
import { canReachTransfer, dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import { advance } from '../../tools/qa/gameplay-oracle';

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
  expect(canReachTransfer({ ...board, movesLeft: 0, phase: 'exhausted' }, deal)).toBe(true);
  const draw = { type: 'draw' } as const;
  const playing = freshSave(deal, 'playing');
  playing.attempt.board.movesLeft = 2;
  const continues = dispatch(playing, draw, deal);
  expect(continues.accepted).toBe(true);
  expect(continues.next.attempt.board).toMatchObject({ phase: 'playing', movesLeft: 1 });
  const exhausted = dispatch(freshSave(deal, 'one-move'), draw, deal);
  expect(exhausted.accepted).toBe(true);
  expect(exhausted.next.attempt.board).toEqual(advance(board, draw, deal));
  expect(exhausted.next.attempt.board).toMatchObject({ phase: 'exhausted', movesLeft: 0 });
  expect(legalCommands(exhausted.next.attempt.board, deal)).toEqual([]);
  const blocked = { ...board, tableau: board.tableau.map(col => col.slice()), waste: ['hats_3'] };
  blocked.tableau[2].splice(1, 0, 'games_3');
  expect(canReachTransfer(blocked, deal)).toBe(false);
});

it('matches the source deck order across a reset, including a removed waste card', () => {
  const cards = Object.fromEntries(['theme', 'first', 'second'].map(id => [id, {
    id, category: 'theme', text: id, explanation: '', leader: id === 'theme',
  }]));
  const initial: Board = {
    tableau: [[]], foundations: [[]], stock: ['theme', 'first', 'second'], waste: [],
    faceUp: [], collected: [], movesLeft: 10, phase: 'playing',
  };
  const deal: Deal = { id: 'stock-cycle-fixture', version: 1, title: 'Stock cycle', cards, initial, winningPath: [], editorialStatus: 'fixture' };
  // AZUR uses the opposite array orientation. Track only the observed top and
  // reveal order. The one-move cost is the game's Rules v3 contract.
  let sourceStock = ['second', 'first', 'theme'];
  const sourceWaste: string[] = [];
  let save = freshSave(deal, 'stock-cycle');
  function step(action: BoardCommand) {
    const before = save.attempt.board;
    const expected = advance(before, action, deal);
    const result = dispatch(save, action, deal);
    expect(result.accepted, result.reason).toBe(true);
    save = result.next;
    expect(save.attempt.board).toEqual(expected);
    expect(save.attempt.board.movesLeft).toBe(before.movesLeft! - 1);
    expect(save.attempt.undo.at(-1)).toEqual(before);
  }
  const draw = () => {
    const id = sourceStock.pop()!;
    sourceWaste.push(id);
    step({ type: 'draw' });
    expect(save.attempt.board.waste.at(-1)).toBe(id);
    expect(save.attempt.board.faceUp).toContain(id);
  };
  const transfer = (from: 'waste' | 'tableau', to: 'tableau' | 'foundation') => step({
    type: 'transfer', from: { kind: from, index: 0 }, to: { kind: to, index: 0 },
  });
  expect(legalCommands(initial, deal)).toEqual([{ type: 'draw' }]);
  expect(advance(initial, { type: 'recycle' }, deal)).toBeNull();
  draw(); draw(); draw();
  expect(legalCommands(save.attempt.board, deal)).toContainEqual({ type: 'recycle' });
  expect(advance(save.attempt.board, { type: 'draw' }, deal)).toBeNull();
  sourceWaste.pop();
  transfer('waste', 'tableau');
  sourceStock = sourceWaste.splice(0).reverse();
  step({ type: 'recycle' });
  expect(save.attempt.board.waste).toEqual([]);
  expect(save.attempt.board.faceUp).toEqual(['second']);
  draw();
  sourceWaste.pop();
  transfer('waste', 'foundation');
  draw();
  transfer('waste', 'foundation');
  transfer('tableau', 'foundation');
  expect(save.attempt.board).toMatchObject({ movesLeft: 0, phase: 'won', foundations: [[]] });
  expect(canReachTransfer(save.attempt.board, deal)).toBe(false);
});
