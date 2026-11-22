import { expect, it } from 'vitest';
import { applyBoard, assertBoard, dispatch, freshSave, legalCommands, placeJoker } from '../../src/domain/engine';
import { frozenLayers } from '../../src/domain/frozen-cards';
import { isBoundCard } from '../../src/domain/bound-cards';
import { packet } from '../../src/domain/engine';
import { decodeRoute } from '../../src/content/campaign-v8-dealer';
import { advance } from '../../tools/qa/gameplay-oracle';
import { decodeSave } from '../../src/platform/storage';
import { platformState } from '../../src/domain/services';
import { campaignId } from '../../src/domain/progression';
import type { Board, BoardCommand, Card, Deal } from '../../src/domain/types';

/**
 * RESEARCH QA ONLY: exercises all 3 currently PRODUCT_ADAPTED P10/P11/P12
 * semantics together. This is not an original Hitapps runtime witness.
 */
const cards: Record<string, Card> = {
  a: { id: 'a', category: 'a', leader: true, text: 'A', explanation: '' },
  a1: { id: 'a1', category: 'a', text: 'A member', explanation: '' },
  b: { id: 'b', category: 'b', leader: true, text: 'B', explanation: '' },
  'b-bottom': { id: 'b-bottom', category: 'b', text: 'Picture lower', explanation: '' },
  'b-top': { id: 'b-top', category: 'b', text: 'Picture upper', explanation: '' },
  c: { id: 'c', category: 'c', leader: true, text: 'C', explanation: '' },
  c1: { id: 'c1', category: 'c', text: 'C member', explanation: '' },
  d: { id: 'd', category: 'd', leader: true, text: 'D', explanation: '' },
  d1: { id: 'd1', category: 'd', text: 'D member', explanation: '' },
};

const path = decodeRoute(
  't0>f0 t1>f0 t2>f1 d w0>f1 d w0>t5 d w0>f2 t5>f2 t3>f3 t4>f3'
);
const deal: Deal = {
  id: 'specials-triplet-cross-system-fixture',
  version: 1,
  campaignLevel: 26,
  title: 'QA: ice, scissors, picture halves',
  editorialStatus: 'research-only-product-adapted',
  cards,
  frozen: { version: 1, layers: { 'b-bottom': 2 } },
  bound: { version: 1, scissorsByCard: { d1: 'c1' } },
  puzzle: { version: 1, pairs: [{ top: 'b-top', bottom: 'b-bottom' }] },
  initial: {
    rulesVersion: 3, tableau: [['a'], ['a1'], ['c'], ['d'], ['d1'], ['b-bottom']],
    foundations: [[], [], [], []], stock: ['c1', 'b-top', 'b'], waste: [],
    faceUp: ['a', 'a1', 'c', 'd', 'd1', 'b-bottom'], collected: [],
    movesLeft: 24, phase: 'playing',
  },
  winningPath: path,
};

function move(board: Board, action: BoardCommand): Board {
  const result = applyBoard(board, action, deal);
  if (typeof result === 'string') throw Error(result);
  expect(advance(board, action, deal), JSON.stringify(action)).toEqual(result.board);
  assertBoard(result.board, deal);
  return result.board;
}

it('P10+P11+P12: source-like geometry, own rules, independent complete replay', () => {
  assertBoard(deal.initial, deal);
  expect(frozenLayers(deal.initial, deal, 'b-bottom')).toBe(2);
  expect(isBoundCard(deal.initial, deal, 'd1')).toBe(true);
  const blocked = { type: 'transfer', from: { kind: 'tableau', index: 4 }, to: { kind: 'foundation', index: 3 } } as const;
  expect(typeof applyBoard(deal.initial, blocked, deal)).toBe('string');
  expect(legalCommands(deal.initial, deal)).not.toContainEqual(blocked);
  expect(placeJoker(deal.initial, 5, deal)).toContain('лёд');
  expect(placeJoker(deal.initial, 4, deal)).toContain('ножницами');

  const first = path.slice(0, 2).reduce(move, structuredClone(deal.initial));
  expect(frozenLayers(first, deal, 'b-bottom')).toBe(1);
  expect(isBoundCard(first, deal, 'd1')).toBe(true);

  const afterScissorsDraw = path.slice(0, 4).reduce(move, structuredClone(deal.initial));
  expect(isBoundCard(afterScissorsDraw, deal, 'd1')).toBe(true);
  expect(frozenLayers(afterScissorsDraw, deal, 'b-bottom')).toBe(1);
  const afterScissorsPlacement = move(afterScissorsDraw, path[4]);
  expect(isBoundCard(afterScissorsPlacement, deal, 'd1')).toBe(false);
  expect(frozenLayers(afterScissorsPlacement, deal, 'b-bottom')).toBe(0);

  const afterPictureTop = path.slice(0, 7).reduce(move, structuredClone(deal.initial));
  expect(packet(afterPictureTop, 5, deal)).toEqual(['b-bottom', 'b-top']);
  expect(path.reduce(move, structuredClone(deal.initial)).phase).toBe('won');
});

it('P10+P11+P12: invalid gesture, Undo and reload do not create phantom thaw/unbind', () => {
  let save = freshSave(deal, 'triplet-start');
  // The fixture opens at campaign level 26; normal helper entitlement must
  // reflect completed earlier lessons, as in the existing P10/P11 unit tests.
  platformState(save).completedCampaign = Array.from({ length: 25 }, (_, i) => campaignId(i + 1));
  const invalid = { type: 'transfer', from: { kind: 'tableau', index: 4 }, to: { kind: 'foundation', index: 0 } } as const;
  const before = structuredClone(save);
  const refused = dispatch(save, invalid, deal);
  expect(refused.accepted).toBe(false);
  expect(refused.next).toEqual(before);
  for (const action of path.slice(0, 5)) {
    const result = dispatch(save, action, deal);
    expect(result.accepted, JSON.stringify(action) + ' ' + result.reason).toBe(true);
    save = result.next;
  }
  expect(isBoundCard(save.attempt.board, deal, 'd1')).toBe(false);
  expect(frozenLayers(save.attempt.board, deal, 'b-bottom')).toBe(0);
  const recovered = decodeSave(JSON.stringify(save), id => id === deal.id ? deal : undefined);
  expect(recovered.attempt.board).toEqual(save.attempt.board);
  const undo = dispatch(recovered, { type: 'undo' }, deal);
  expect(undo.accepted).toBe(true);
  expect(isBoundCard(undo.next.attempt.board, deal, 'd1')).toBe(true);
  expect(frozenLayers(undo.next.attempt.board, deal, 'b-bottom')).toBe(1);
  expect(undo.next.attempt.board.waste).toEqual(['c1']);
  const resumed = dispatch(undo.next, path[4], deal);
  expect(resumed.accepted).toBe(true);
  expect(isBoundCard(resumed.next.attempt.board, deal, 'd1')).toBe(false);
});

it('P12+Ordered source co-occurrence: independent categories keep valid Rules3 ordering', () => {
  // The original 226 local LevelBundles include four with PuzzleCards, two
  // of which also contain Ordered words. This product test deliberately uses
  // a DISTINCT ordered category; original per-card pairing remains UNKNOWN.
  const ordered: Deal = {
    ...deal,
    cards: {
      ...deal.cards,
      c: { ...deal.cards.c, ordered: true },
      c1: { ...deal.cards.c1, rank: 1 },
    },
  };
  assertBoard(ordered.initial, ordered);
  let board = structuredClone(ordered.initial);
  for (const action of ordered.winningPath) {
    const next = applyBoard(board, action, ordered);
    if (typeof next === 'string') throw Error('Ordered+Puzzle: ' + next);
    expect(advance(board, action, ordered)).toEqual(next.board);
    board = next.board;
  }
  expect(board.phase).toBe('won');
});
