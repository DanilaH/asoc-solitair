import { describe, expect, test } from 'vitest';
import { applyBoard, assertBoard, boardKey, dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import { claimLegacyLiveOpsReward, legacyLiveOpsRewards, recordSourceGoldRush } from '../../src/domain/events/campaign-liveops';
import { Kind, sourceCard, type SourceKind } from '../../src/domain/hitapps-rules';
import type { BoardCommand, Deal } from '../../src/domain/types';
import { decodeSave } from '../../src/platform/storage';
import { campaignId } from '../../src/domain/progression';
import { advanceRules4 } from '../../tools/qa/hitapps-rules4-oracle';
import { certifySourceRoute } from '../../tools/content/hitapps-source-pipeline';
import { emptyFeatures, prepareSourceInput, sourceCardOrder } from '../../tools/content/hitapps-source-authoring';
import { chooseSourceMove, runSourceBot } from '../../tools/content/hitapps-source-bot';

const move = (from: number, to: number, home = false): BoardCommand => ({ type: 'transfer',
  from: { kind: from < 0 ? 'waste' : 'tableau', index: Math.max(0, from) }, to: { kind: home ? 'foundation' : 'tableau', index: to } });

function boardFor(tableau: string[][], stock: string[] = [], extras: Record<string, SourceKind> = {}) {
  const ids = [...new Set(tableau.flat().concat(stock, Object.keys(extras)))];
  const deal: Deal = { id: 'r4-interactions', version: 4, title: 'Проверка', campaignLevel: 16, editorialStatus: 'test',
    winningPath: [], cards: Object.fromEntries(ids.map(id => [id, { id, category: id[0], text: id, explanation: id, ...(id.endsWith('0') && { leader: true }) }])),
    initial: { rulesVersion: 4, tableau, foundations: [[], [], []], stock, waste: [], faceUp: tableau.map(pile => pile.at(-1)!).filter(Boolean),
      collected: [], phase: 'playing', movesLeft: 55, hitapps: { move: 0, spent: [], generatedGold: 0,
        cards: Object.fromEntries(ids.map(id => [id, sourceCard(extras[id] ?? (id.endsWith('0') ? Kind.category : Kind.word))])) } },
    hitapps: { policy: 'hitapps-rules4-v1', assemblies: [] },
  };
  return { deal, states: deal.initial.hitapps!.cards };
}

function both(deal: Deal, before: Deal['initial'], command: BoardCommand) {
  const result = applyBoard(before, command, deal);
  if (typeof result === 'string') throw Error(result);
  expect(result.board).toEqual(advanceRules4(before, command, deal));
  expect(result.consumedMoves).toBe(1);
  return result;
}

describe('source Rules4 gameplay in the consumer', () => {
  test('locks match numeric key type and amount; a just-unlocked frozen card skips this tick', () => {
    const { deal, states } = boardFor([['a0'], ['a1'], ['b0', 'b1'], ['b2']]);
    states.b1.lock = { type: 7, required: 2, collected: 0 };
    states.b1.ice = 2;
    states.b2.key = { type: 7, amount: 2, used: false };
    states.a1.key = { type: 5, amount: 1, used: false };
    const first = both(deal, deal.initial, move(0, 0, true));
    expect(first.board.hitapps!.cards.b1).toMatchObject({ ice: 2, lock: { collected: 2 } });
    expect(first.board.hitapps!.cards.a1.key?.used).toBe(false);
    expect(first.events.map(event => event.type)).toContain('unlock');
    const second = both(deal, first.board, move(1, 0, true));
    expect(second.board.hitapps!.cards.b1.ice).toBe(1);
    expect(deal.initial.hitapps!.cards.b1.ice).toBe(2);
  });

  test('cut, discard and unbind have separate state and survive SaveStore serialization and Undo', () => {
    const { deal, states } = boardFor([['a0'], ['b1','a1'], ['b0'], ['b2']]);
    deal.initial.faceUp.push('b1');
    states.a1.bound = 2;
    states.b0.scissors = true;
    states.b2.scissors = true;
    const cut = { ...move(2, 1), scissors: 'cut' } as BoardCommand;
    const discarded = { ...move(3, 3), scissors: 'discard' } as BoardCommand;
    const unbind = { ...move(1, 1), scissors: 'unbind' } as BoardCommand;
    expect(both(deal, deal.initial, cut).events.map(event => event.type)).toContain('cut');
    const start = freshSave(deal, 'rules4-cut');
    start.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
      completedCampaign: Array.from({ length: 15 }, (_, index) => campaignId(index + 1)) };
    const first = dispatch(start, cut, deal).next;
    expect(first.attempt.board.hitapps!.cards.a1.bound).toBe(1);
    expect(legalCommands(first.attempt.board, deal)).toContainEqual(unbind);
    const saved = dispatch(dispatch(first, discarded, deal).next, unbind, deal).next;
    const decoded = decodeSave(JSON.stringify(saved), deal);
    const restored = dispatch(decoded, { type: 'undo' }, deal);
    expect(restored.accepted).toBe(true);
    const undone = restored.next;
    expect(undone.attempt.board.hitapps!.cards.a1.bound).toBe(1);
    expect(undone.attempt.board.hitapps!.cards.b2.scissors).toBe(false);
    expect(first.attempt.board.rulesVersion).toBe(4);
    expect(boardKey(first.attempt.board)).not.toBe(boardKey(undone.attempt.board));
  });

  test('two physical halves become an ordinary semantic card with no duplicate goal', () => {
    const { deal, states } = boardFor([['a0'], ['a1'], ['a2']], [], { a3: Kind.word });
    states.a1.kind = Kind.puzzleTop; states.a1.puzzle = 3;
    states.a2.kind = Kind.puzzleBottom; states.a2.puzzle = 3;
    deal.hitapps!.assemblies = [{ tag: 3, halves: ['a1','a2'], card: 'a3' }];
    const combined = both(deal, deal.initial, move(1, 2));
    expect(combined.board.tableau[2]).toEqual(['a3']);
    expect(combined.board.hitapps!.spent).toEqual(['a2','a1']);
    expect(combined.board.hitapps!.cards.a3).toMatchObject({ kind: Kind.word, puzzle: 0, changedAt: 1, changed: 2 });
    const proof = certifySourceRoute(deal, [move(1, 2), move(0, 0, true), move(2, 0, true)]);
    expect(proof).toMatchObject({ cost: 3, reserve: 52 });
  });

  test('starter target applies explicit direct ice and key effects and rejects a Hammer on Home', () => {
    const { deal, states } = boardFor([['a0'], ['a1'], ['b0'], ['b1']], ['m', 'h'], { m: Kind.magnet, h: Kind.hammer });
    states.a1.lock = { type: 1, required: 2, collected: 0 };
    states.b1.key = { type: 1, amount: 2, used: false };
    // Move the only key to hidden stock, where Magnet has a direct search path.
    deal.initial.tableau[3] = [];
    deal.initial.stock = ['m', 'h', 'b1'];
    deal.initial.faceUp = deal.initial.faceUp.filter(id => id !== 'b1');
    let board = both(deal, deal.initial, { type: 'draw' }).board;
    board = both(deal, board, move(-1, 1)).board;
    expect(board.hitapps!.cards.a1.lock?.collected).toBe(2);
    board = both(deal, board, move(0, 0, true)).board;
    board = both(deal, board, { type: 'draw' }).board;
    expect(typeof applyBoard(board, move(-1, 0, true), deal)).toBe('string');
    const struck = both(deal, board, move(-1, 2));
    expect(struck.board.waste).toEqual(['b0']);
    expect(struck.board.hitapps!.spent).toEqual(['m','h']);
  });

  test('gold health skips appearance, decrements, activates separately and remains reversible', () => {
    const { deal, states } = boardFor([['a0'], ['a1'], ['b0'], ['b1']], ['b2','b3']);
    deal.hitapps!.gold = { first: 1, total: 1, coinsPerActivation: 1 };
    deal.initial.hitapps!.generatedGold = 1;
    states.a1.gold = { health: 4, appeared: 0, activated: false };
    const reveal = both(deal, deal.initial, { type: 'draw' });
    expect(reveal.board.hitapps!.cards.a1.gold).toMatchObject({ health: 4, appeared: 1 });
    const tick = both(deal, reveal.board, move(0, 0, true));
    expect(tick.board.hitapps!.cards.a1.gold!.health).toBe(3);
    const activation = both(deal, tick.board, move(1, 0, true));
    expect(activation.board.hitapps!.cards.a1.gold).toMatchObject({ health: 0, activated: true });
    expect(activation.events).toContainEqual({ type: 'gold', cards: ['a1'], amount: 0, reason: 'activated' });
    expect(states.a1.gold).toEqual({ health: 4, appeared: 0, activated: false });
  });

  test('a settled Rules4 win with an activation grants one redeemable Gold Rush prize after reload', () => {
    const { deal, states } = boardFor([['a0'], ['a1']]);
    deal.hitapps!.gold = { first: 1, total: 1, coinsPerActivation: 1, eventKey: 'gold-r4-weekly-v1' };
    deal.initial.hitapps!.generatedGold = 1;
    states.a1.gold = { health: 4, appeared: 0, activated: false };
    const now = Date.UTC(2026, 10, 26);
    const start = freshSave(deal, 'rules4-gold-rush');
    const before = dispatch(start, move(0, 0, true), deal).next;
    recordSourceGoldRush(start, before, deal, now);
    expect(legacyLiveOpsRewards(before)).toEqual([]);
    const won = dispatch(before, move(1, 0, true), deal).next;
    expect(won.attempt.payout?.some(reward => reward.reason === 'golden_cards' && reward.coins === 1)).toBe(true);
    recordSourceGoldRush(before, won, deal, now);
    recordSourceGoldRush(before, won, deal, now);
    const restored = decodeSave(JSON.stringify(won), deal);
    expect(legacyLiveOpsRewards(restored)).toEqual([expect.objectContaining({ id: 'gold-win', progress: 1, reward: { coins: 15 } })]);
    const [prize] = legacyLiveOpsRewards(restored);
    const coins = restored.profile.coins;
    expect(claimLegacyLiveOpsReward(restored, prize.eventKey, prize.id)).toBe(true);
    expect(claimLegacyLiveOpsReward(restored, prize.eventKey, prize.id)).toBe(false);
    expect(restored.profile.coins).toBe(coins + 15);
  });

  test('failed pattern keeps its one reseed; source priority tie and hard simulation bound are independent', () => {
    const { deal } = boardFor([['a0','a1'], ['b0','b1'], ['c0','c1']], ['a2', 'b2', 'c2']);
    const cardOrder = sourceCardOrder(deal);
    const input = prepareSourceInput(deal, { version: 'hitapps-input-v2', layout: 'random', stable: true, levelPenalty: 0,
      cardOrder, features: { ...emptyFeatures, frozen: { enabled: true, seed: 7, index: 0, data: [{ column: 9, position: 0, layers: 1 }] },
        bound: { enabled: true, seed: 13, index: 0, data: { pairs: [], scissors: [] } } } }, 55);
    const prepared = input.prepare(-1, 'None', () => 3);
    const result = prepared.finish();
    expect(result.receipt.streams.map(row => row.seed)).toEqual([3,7]);
    expect(result.receipt.failedMask).toBe(64 | 256);
    expect(result.receipt.streams[0].draws).toHaveLength(80);
    assertBoard(result.deal.initial, result.deal);
    const moves = [
      { command: move(0, 0, true), position: 0, type: 1 as const, card: 'a0', targetCount: 2 },
      { command: move(1, 2), position: 0, type: 0 as const, card: 'b0', targetCount: 2 },
    ];
    expect(chooseSourceMove(moves, 'Priority')).toEqual(moves[0].command);
    expect(runSourceBot(result.deal, 'Priority', 1).status).toBe('UNKNOWN');
  });
});
