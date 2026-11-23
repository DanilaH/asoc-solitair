import { expect, it, vi } from 'vitest';
import { decodeRoute } from '../../src/content/campaign-v8-dealer';
import { oneKeyDeal, picturedSpecialsDeal } from '../../src/content/campaign-v8-hitapps-specials';
import { applyBoard, assertBoard, dispatch, freshSave, isLocked } from '../../src/domain/engine';
import { frozenLayers } from '../../src/domain/frozen-cards';
import { campaignId } from '../../src/domain/progression';
import { advance } from '../../tools/qa/gameplay-oracle';
import { hitappsInputHash, replayAuthoredRoute } from '../../tools/content/hitapps-authoring';
import { authorHitappsCandidate } from '../../tools/content/hitapps-pipeline';
import { distributeAuthoredPuzzleCards } from '../../tools/content/hitapps-puzzle-distribution';
import { matchesPuzzleTags, recordPuzzleAssembly, replayFrozenTransition, replayScissorsTransition, revealedScissorsDispatch } from '../../tools/content/hitapps-special-transitions';
import type { BoardCommand } from '../../src/domain/types';

it('validates an immutable Rules3 one-key deal and restores the lock and its key on Undo', async () => {
  const d = oneKeyDeal;
  expect(() => assertBoard(d.initial, { ...d, lock: { column: 2, requiredKeys: ['single-key'] } })).toThrow('замок');
  const bad = { type: 'transfer', from: { kind: 'tableau', index: 2 }, to: { kind: 'tableau', index: 1 } } as const;
  expect(typeof applyBoard(d.initial, bad, d)).toBe('string');
  expect(advance(d.initial, bad, d)).toBeNull();
  let save = freshSave(d, 'one-key');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0,
    completedCampaign: Array.from({ length: 17 }, (_, i) => campaignId(i + 1)) };
  save = dispatch(save, d.winningPath[0], d).next;
  expect(save.attempt.board.keys).toEqual(['single-key']);
  expect(isLocked(save.attempt.board, 2, d)).toBe(false);
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  vi.resetModules();
  try {
    const { decodeSave } = await import('../../src/platform/storage');
    const recovered = decodeSave(JSON.stringify({ ...save, contentVersion: 8 }), id => id === d.id ? d : undefined);
    expect(recovered.attempt).toEqual(save.attempt);
    expect(dispatch(recovered, { type: 'undo' }, d).next.attempt.board).toEqual(d.initial);
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
  expect(replayAuthoredRoute(d, d.winningPath).phase).toBe('won');
});

it('replays the illustrated pair, Ordered, ice and scissors on real Rules3 including rejected sides and recycle', () => {
  const d = picturedSpecialsDeal;
  const lower = replayAuthoredRoute(d, d.winningPath.slice(0, 6));
  const command: BoardCommand = { type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: 'foundation', index: 2 } };
  expect(applyBoard(lower, command, d)).toEqual(expect.any(String));
  expect(advance(lower, command, d)).toBeNull();
  const piled = replayAuthoredRoute(d, d.winningPath.slice(0, 7));
  expect(piled.tableau[4]).toEqual(['shell-bottom', 'shell-top']);
  const stock = replayAuthoredRoute(d, [...d.winningPath.slice(0, 6), { type: 'draw' }, { type: 'draw' }, { type: 'recycle' }]);
  expect(stock.stock).toEqual(['shell-top', 'turtle', 'forest']);
  expect(stock.tableau[4]).toEqual(['shell-bottom']);
  expect(replayAuthoredRoute(d, d.winningPath)).toMatchObject({ phase: 'won', movesLeft: 11 });
  for (const layers of [1, 2, 3]) {
    const alternate = { ...d, frozen: { version: 1 as const, layers: { 'shell-bottom': layers } } };
    const firstFive = replayAuthoredRoute(alternate, alternate.winningPath.slice(0, 5));
    expect(frozenLayers(firstFive, alternate, 'shell-bottom')).toBe(Math.max(0, layers - 2));
    const route = layers === 3 ? decodeRoute('t0>f0 t1>f0 t2>f1 d w0>f1 d d d w0>f3 t3>f3 r d w0>t4 d w0>f2 t4>f2') : d.winningPath;
    expect(replayAuthoredRoute(alternate, route).phase).toBe('won');
  }
});

it('includes separate PuzzleCards in the final authoring proof after the stock/tableau phase', () => {
  const d = picturedSpecialsDeal;
  const { ['shell-top']: top, ['shell-bottom']: bottom, ...ordinaryCards } = d.cards;
  const { frozen, bound, puzzle, ...plain } = d;
  const base = { ...plain, cards: ordinaryCards, winningPath: [],
    initial: { ...plain.initial, tableau: plain.initial.tableau.map(col => col.filter(id => id !== bottom.id)),
      stock: plain.initial.stock.filter(id => id !== top.id), faceUp: plain.initial.faceUp.filter(id => id !== bottom.id) } };
  const input = { schema: 'hitapps-authoring-v1', provenance: 'PRODUCT_ADAPTED', layout: 'fixed',
    cardOrder: Object.keys(ordinaryCards), stableMoves: true, levelPenalty: 0 } as const;
  const result = authorHitappsCandidate(base, {
    structure: { ...input, levelInputHash: hitappsInputHash(base, input) },
    features: { revision: 'pictured-specials-v1', enabled: ['puzzleDistribution', 'frozen', 'bound'], appliers: {
      puzzleDistribution: state => ({ ...state, snapshot: distributeAuthoredPuzzleCards(state.snapshot, puzzle!, [top, bottom], board => ({
        ...board, tableau: d.initial.tableau, stock: d.initial.stock, faceUp: d.initial.faceUp,
      })) }),
      frozen: state => ({ ...state, snapshot: { ...state.snapshot, frozen } }),
      bound: state => ({ ...state, snapshot: { ...state.snapshot, bound } }),
    } },
    difficulty: { historyPenalty: 0, previousLosses: 0, special: true }, easy: { enabled: false, minLevel: 16, byDifficulty: {} },
    strategy: { kind: 'None', seed: 0 }, seeds: [], drawSeed: () => 0, findWitness: () => d.winningPath,
  });
  expect(result.evidence.originalFinalBoard).toBe('UNOBSERVED');
  expect(result.deal?.cards).toEqual(d.cards);
  expect(result.deal?.frozen).toEqual(d.frozen);
  expect(replayAuthoredRoute(result.deal!, result.deal!.winningPath).phase).toBe('won');
  expect(() => distributeAuthoredPuzzleCards(base, puzzle!, [top, top], board => board)).toThrow('separate');
});

it('preserves distinct source Frozen evidence, revealed-scissors branches and assembled identity', () => {
  for (const layers of [0, 1, 2, 5]) {
    const sw = { version: 1, cardID: 'ice', currentMove: 12, layers, actor: 'joker', boosterSpendsMove: 'UNKNOWN',
      placeOnJokerPositive: 'UNKNOWN', positiveMove: 'UNKNOWN', canChangeThisMove: 'UNKNOWN', meltableNow: 'UNKNOWN',
      boosterHit: false } as const;
    expect(replayFrozenTransition(sw)).toMatchObject({ state: 'UNRESOLVED', layers });
    if (layers) {
      expect(replayFrozenTransition({ ...sw, observed: 'MeltOneLayer' }).layers).toBe(layers - 1);
      expect(replayFrozenTransition({ ...sw, actor: 'starter-booster', boosterHit: true, observed: 'Shatter' }).layers).toBe(0);
    }
  }
  expect([0, 1, 2, 3].map(status => revealedScissorsDispatch(true, status))).toEqual(['DISCARD', 'CUT', 'STOP', 'RETRY_LOOKUP']);
  const scissors = { version: 1 as const, revealed: ['s1', 's2'], bindings: [
    { upperCardID: 'a', lowerCardID: 'b' }, { upperCardID: 'c', lowerCardID: 'd' },
  ] };
  expect(replayScissorsTransition(scissors, { kind: 'dispatch', scissorsCardID: 's1', status: 1, upperCardID: 'c' }))
    .toMatchObject({ fact: 'BoundCut', state: scissors, selected: scissors.bindings[1] });
  expect(replayScissorsTransition(scissors, { kind: 'dispatch', scissorsCardID: 's1', status: 1 }).fact).toBe('UNKNOWN_TARGET');
  expect(replayScissorsTransition(scissors, { kind: 'dispatch', scissorsCardID: 's1', status: 0 }).state.revealed).toEqual(['s2']);
  expect(replayScissorsTransition(scissors, { kind: 'unbound', ...scissors.bindings[1] }).state.bindings).toEqual([scissors.bindings[0]]);
  expect([matchesPuzzleTags(0, 0), matchesPuzzleTags(8, 9), matchesPuzzleTags(8, 8)]).toEqual([false, false, true]);
  const parts = [{ id: 'a', tag: 8, cardType: 3 }, { id: 'b', tag: 8, cardType: 4 }] as const;
  const outcome = { version: 1, movedCardID: 'a', targetContainerID: 'pile-1', part1ID: 'a', part2ID: 'b',
    assembledCardID: 'assembled-7', assembledCardOrder: 2 } as const;
  expect(recordPuzzleAssembly(parts, outcome).status).toBe('UNKNOWN_CALLER_RULE');
  expect(recordPuzzleAssembly(parts, { ...outcome, callerAccepted: true })).toMatchObject({
    status: 'ASSEMBLED', physicalPartCount: 2, semanticOutcomeCount: 1,
    assembly: { assembledCardID: 'assembled-7', assembledCardOrder: 2 },
  });
});
