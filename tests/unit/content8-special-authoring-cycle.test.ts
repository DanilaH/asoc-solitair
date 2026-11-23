import { expect, it } from 'vitest';
import { applyBoard, assertBoard, legalCommands } from '../../src/domain/engine';
import { isBoundCard } from '../../src/domain/bound-cards';
import { frozenLayers } from '../../src/domain/frozen-cards';
import { advance, search } from '../../tools/qa/gameplay-oracle';
import { decodeRoute } from '../../src/content/campaign-v8-dealer';
import type { Board, Card, Deal } from '../../src/domain/types';

/**
 * Research QA for PRODUCT_ADAPTED P10 Frozen + P11 Bound/Scissors.
 * Does not imply Hitapps source has these exact rules or these patterns.
 * Demonstrates a genuine source-informed AUTHORING risk where individually
 * legal features create a provably impossible combined puzzle.
 */
const cards: Record<string, Card> = {
  a: { id: 'a', category: 'a', leader: true, text: 'A', explanation: '' },
  a1: { id: 'a1', category: 'a', text: 'A member', explanation: '' },
  b: { id: 'b', category: 'b', leader: true, text: 'B', explanation: '' },
  b1: { id: 'b1', category: 'b', text: 'B member', explanation: '' },
};
const initial: Board = {
  rulesVersion: 3, tableau: [['a'], ['a1'], ['b'], ['b1']],
  foundations: [[], []], stock: [], waste: [],
  faceUp: ['a', 'a1', 'b', 'b1'], collected: [],
  movesLeft: 12, phase: 'playing',
};
const base: Deal = {
  id: 'special-cycle-bad-v1', version: 1, campaignLevel: 25,
  title: 'Research dependency-cycle counterexample',
  editorialStatus: 'research-only',
  cards, initial,
  frozen: { version: 1, layers: { a1: 1 } },
  bound: { version: 1, scissorsByCard: { b1: 'a1' } },
  winningPath: [],
};
const fixed: Deal = {
  ...base, id: 'special-cycle-fixed-v1',
  bound: { version: 1, scissorsByCard: { b1: 'a' } },
  winningPath: decodeRoute('t0>f0 t2>f1 t3>f1 t1>f0'),
};

it('counterexample: a frozen scissors card and a bound completion form a real no-win cycle', () => {
  assertBoard(base.initial, base); // schema-valid does NOT prove solvability
  const before = JSON.stringify(base.initial);
  expect(frozenLayers(base.initial, base, 'a1')).toBe(1);
  expect(isBoundCard(base.initial, base, 'b1')).toBe(true);
  const actions = legalCommands(base.initial, base);
  expect(actions.some(action => action.type === 'transfer' && action.from.kind === 'tableau' &&
    action.from.index === 1)).toBe(false);
  expect(actions.some(action => action.type === 'transfer' && action.from.kind === 'tableau' &&
    action.from.index === 3)).toBe(false);
  const r = search(base.initial, base, 2500);
  expect(r.status).toBe('UNSOLVABLE'); // not bounded UNKNOWN
  expect(r.visited).toBeLessThan(2500);
  expect(JSON.stringify(base.initial)).toBe(before);
});

it('repairing ONLY the scissors dependency gives a full win within unchanged geometry/budget', () => {
  assertBoard(fixed.initial, fixed);
  const r = search(fixed.initial, fixed, 2500);
  expect(r.status).toBe('SOLVED');
  let board = structuredClone(fixed.initial);
  for (const command of fixed.winningPath) {
    const result = applyBoard(board, command, fixed);
    expect(typeof result, JSON.stringify(command)).not.toBe('string');
    if (typeof result === 'string') throw Error(result);
    expect(advance(board, command, fixed)).toEqual(result.board);
    board = result.board;
  }
  expect(board.phase).toBe('won');
  expect(board.movesLeft).toBe(8);
  expect(frozenLayers(board, fixed, 'a1')).toBe(0);
  expect(isBoundCard(board, fixed, 'b1')).toBe(false);
});

it('rejected frozen/scissors transfers do not silently spend the finite budget', () => {
  for (const index of [1, 3]) {
    const command = { type: 'transfer' as const, from: { kind: 'tableau' as const, index },
      to: { kind: 'foundation' as const, index: 0 } };
    expect(typeof applyBoard(base.initial, command, base)).toBe('string');
  }
  expect(base.initial.movesLeft).toBe(12);
});
