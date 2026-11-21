import { expect, it } from 'vitest';
import { content8FrozenDeal as deal } from '../../src/content/campaign-v8-frozen';
import { applyBoard, assertBoard, dispatch, freshSave, legalCommands, placeJoker } from '../../src/domain/engine';
import { frozenLayers } from '../../src/domain/frozen-cards';
import { campaignId } from '../../src/domain/progression';
import { platformState } from '../../src/domain/services';
import type { Board, BoardCommand } from '../../src/domain/types';
import { advance } from '../../tools/qa/gameplay-oracle';

const step = (board: Board, action: BoardCommand, variant = deal) => {
  const result = applyBoard(board, action, variant);
  if (typeof result === 'string') throw Error(result);
  expect(advance(board, action, variant)).toEqual(result.board);
  return result.board;
};

it('certifies two paths with no helpers and thaws by completed group', () => {
  for (const path of [deal.winningPath, ...deal.recoveryPaths!]) {
    expect(path.reduce((board, action) => step(board, action), deal.initial).phase).toBe('won');
  }
  const firstGroup = deal.winningPath.slice(0, 2).reduce((board, action) => step(board, action), deal.initial);
  expect(frozenLayers(firstGroup, deal, 'space-word')).toBe(0);
  expect(frozenLayers(firstGroup, deal, 'bread-word')).toBe(1);
  const secondGroup = deal.winningPath.slice(0, 5).reduce((board, action) => step(board, action), deal.initial);
  expect(frozenLayers(secondGroup, deal, 'bread-word')).toBe(0);
  expect(frozenLayers(secondGroup, { ...deal, frozen: { version: 1, layers: { 'bread-word': 3 } } }, 'bread-word')).toBe(1);
});

it('rejects covered frozen cards, leaves the stock cycle neutral and derives ice again after Undo', () => {
  const iceToFoundation = { type: 'transfer', from: { kind: 'tableau', index: 2 }, to: { kind: 'foundation', index: 0 } } as const;
  expect(applyBoard(deal.initial, iceToFoundation, deal)).toContain('слой льда');
  expect(legalCommands(deal.initial, deal)).not.toContainEqual(iceToFoundation);
  expect(placeJoker(deal.initial, 2, deal)).toContain('лёд');
  expect(() => assertBoard(deal.initial, { ...deal, frozen: { version: 1, layers: { 'space-word': -1 } } })).toThrow('лёд');
  let save = freshSave(deal, 'ice-undo');
  platformState(save).completedCampaign = Array.from({ length: 22 }, (_, i) => campaignId(i + 1));
  const draw: BoardCommand = { type: 'draw' };
  const cycled = [draw, draw, { type: 'recycle' } as const].reduce((board, action) => step(board, action), deal.initial);
  expect(cycled.stock).toEqual(deal.initial.stock);
  expect(frozenLayers(cycled, deal, 'bread-word')).toBe(2);
  for (const action of deal.winningPath.slice(0, 2)) save = dispatch(save, action, deal).next;
  expect(frozenLayers(save.attempt.board, deal, 'space-word')).toBe(0);
  const undo = dispatch(save, { type: 'undo' }, deal);
  expect(undo.accepted).toBe(true);
  expect(frozenLayers(undo.next.attempt.board, deal, 'space-word')).toBe(1);
  expect(frozenLayers(undo.next.attempt.board, deal, 'bread-word')).toBe(2);
});
