import { describe, expect, it } from 'vitest';
import { modifierDeals } from '../../src/content/modifiers';
import { campaignDeals, findDeal } from '../../src/content/campaign';
import { introDeal } from '../../src/content/intro';
import { applyBoard, assertBoard, boardKey, dispatch, freshSave, isLocked, packet, placeJoker } from '../../src/domain/engine';
import { solve, knownContinuation } from '../../src/domain/solver';
import { decodeSave } from '../../src/platform/storage';
import { applyReceipt, purchaseHelper } from '../../src/domain/services';
import { layout } from '../../src/game/layout';
import type { Board, BoardCommand, Deal, Save } from '../../src/domain/types';
const [joker, , days, months, lock, lockApply] = modifierDeals;
const move = (from: number, to: number, foundation = true): BoardCommand => ({ type: 'transfer', from: { kind: 'tableau', index: from }, to: { kind: foundation ? 'foundation' : 'tableau', index: to } });
function fresh(deal: Deal) {
  const save = freshSave(deal, 'modifiers');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0, completedCampaign: campaignDeals.slice(0, deal.campaignLevel! - 1).map(d => d.id) };
  return save;
}
function step(save: Save, command: Parameters<typeof dispatch>[1], deal: Deal) {
  const result = dispatch(save, command, deal); expect(result.accepted, result.reason).toBe(true);
  expect(decodeSave(JSON.stringify(result.next), findDeal)).toEqual(result.next); return result.next;
}
function boardStep(board: Board, cmd: BoardCommand, deal: Deal): Board {
  const r = applyBoard(board, cmd, deal); if (typeof r === 'string') throw Error(r); return r.board;
}
describe('one packet Joker support', () => {
  it('charges only valid placement, costs no move and cannot be refunded or placed twice after Undo', () => {
    const save = fresh(joker);
    for (const column of [-1, 3, 1.5]) expect(dispatch(save, { type: 'place-joker', column }, joker).next).toEqual(save);
    let next = step(save, { type: 'place-joker', column: 0 }, joker);
    expect(next.attempt.board.movesLeft).toBe(save.attempt.board.movesLeft); expect(next.profile.jokers).toBe(0);
    next = step(next, { type: 'undo' }, joker);
    expect(next.attempt.board).toEqual(save.attempt.board); expect(next.profile.jokers).toBe(0); expect(next.profile.undos).toBe(4);
    next.profile.jokers = 5;
    expect(dispatch(next, { type: 'place-joker', column: 1 }, joker).accepted).toBe(false);
    const restarted = step(next, { type: 'restart', attemptId: 'new-attempt' }, joker);
    expect(restarted.profile.jokers).toBe(5); expect(restarted.attempt.jokerUsed).toBeUndefined();
    expect(dispatch(restarted, { type: 'place-joker', column: 1 }, joker).accepted).toBe(true);
  });
  it('blocks the original group, accepts any one packet, and disappears when that packet leaves', () => {
    let save = step(fresh(joker), joker.tutorialPath![0], joker);
    expect(packet(save.attempt.board, 0, joker)).toEqual([]);
    save = step(save, joker.tutorialPath![1], joker);
    expect(packet(save.attempt.board, 0, joker)).toEqual(['fruit_1']);
    expect(applyBoard(save.attempt.board, move(2, 0, false), joker)).toBe('Джокер держит только одну группу');
    for (const cmd of joker.tutorialPath!.slice(2, 6)) save = step(save, cmd, joker);
    expect(save.attempt.board.joker).toBeUndefined(); expect(packet(save.attempt.board, 0, joker)).toEqual(['fruit']);
    const undone = step(save, { type: 'undo' }, joker);
    expect(undone.attempt.board.joker).toEqual({ column: 0, boundary: 2 });
    expect(packet(undone.attempt.board, 0, joker)).toEqual(['fruit_1']);
  });
  it('has a winning alternate teaching path and bounded geometry in every intermediate state', () => {
    let save = fresh(joker);
    for (const cmd of joker.tutorialPath!) {
      save = step(save, cmd, joker);
      const geo = layout(save.attempt.board, joker, 565);
      expect(geo.poses.every(p => p.y + 83 <= 565.01)).toBe(true);
      if (geo.joker) expect(geo.joker.y + 83).toBeLessThanOrEqual(565.01);
    }
    expect(save.attempt.board.phase).toBe('won'); expect(save.profile.jokers).toBe(0);
  });
  it('finds a helper-free winning continuation with an empty and occupied support', () => {
    let board = placeJoker(joker.initial, 0, joker) as Board;
    for (let i = 0; i < 2; i++) {
      const result = solve(board, joker); expect(result.status).toBe('SOLVED');
      let solved = board;
      if (result.status === 'SOLVED') for (const cmd of result.path) solved = boardStep(solved, cmd, joker);
      expect(solved.phase).toBe('won');
      if (i === 0) board = boardStep(board, joker.tutorialPath![1] as BoardCommand, joker);
    }
  });
});
describe('ordered rank intervals and prefixes', () => {
  it('rejects skipped ranks without spending a move, and names the missing rank', () => {
    let save = step(fresh(days), move(0, 0), days);
    const before = structuredClone(save);
    const bad = dispatch(save, move(2, 0), days);
    expect(bad.accepted).toBe(false); expect(bad.reason).toContain('№1'); expect(bad.next.attempt.board).toEqual(before.attempt.board);
    save = step(save, move(1, 0), days); // prefix 1; now rank 3 exposed
    const skipped = dispatch(save, move(1, 0), days);
    expect(skipped.accepted).toBe(false); expect(skipped.reason).toContain('№2'); expect(skipped.next.attempt.board.movesLeft).toBe(save.attempt.board.movesLeft);
  });
  it('merges adjacent intervals in either direction and normalizes by rank', () => {
    let board = boardStep(days.initial, move(1, 2, false), days);
    expect(packet(board, 2, days)).toEqual(['days_1', 'days_2']);
    expect(applyBoard(board, move(2, 0), days)).toBe('Сначала нужна карта категории');
    board = boardStep(board, move(0, 0), days);
    board = boardStep(board, move(2, 0), days);
    expect(board.foundations[0]).toEqual(['days_1', 'days_2', 'days']);
    expect(applyBoard(board, move(2, 0), days)).toContain('№3'); // exposed rank 4
    board = boardStep(board, move(1, 0), days);
    expect(board.foundations[0]).toEqual(['days_1', 'days_2', 'days_3', 'days']);
  });
  it('does not merge non-adjacent intervals or swallow a non-prefix behind its leader', () => {
    const board = boardStep(days.initial, move(0, 0), days);
    expect(applyBoard(board, move(1, 0, false), days)).toContain('№2');
    const exposed = structuredClone(days.initial);
    exposed.tableau = [['days_7', 'days_1', 'days_3', 'days'], ['days_5'], ['days_6', 'days_4', 'days_2']];
    exposed.faceUp = ['days_1', 'days_3', 'days', 'days_5', 'days_2'];
    expect(packet(exposed, 0, days)).toEqual(['days']);
  });
  it('keeps rank semantics through draw, recycle and Undo', () => {
    const deal = structuredClone(days); deal.id = 'ordered-stock'; delete deal.campaignLevel;
    deal.initial.tableau = [['days'], [], []]; deal.initial.stock = ['days_2', 'days_1', ...[3,4,5,6,7].map(n => `days_${n}`)]; deal.initial.faceUp = ['days'];
    let save = freshSave(deal, 'stock');
    save = dispatch(save, move(0, 0), deal).next; save = dispatch(save, { type: 'draw' }, deal).next;
    const invalid = dispatch(save, { type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: 'foundation', index: 0 } }, deal);
    expect(invalid.accepted).toBe(false); expect(invalid.reason).toContain('№1');
    for (let i = 0; i < 6; i++) save = dispatch(save, { type: 'draw' }, deal).next;
    const recycled = dispatch(save, { type: 'recycle' }, deal).next;
    expect(recycled.attempt.board.stock).toEqual(deal.initial.stock);
    expect(dispatch(recycled, { type: 'undo' }, deal).next.attempt.board).toEqual(save.attempt.board);
  });
});
describe('three keys in one atomic board transaction', () => {
  it('refuses the locked column as either source or destination and refuses a Joker there', () => {
    expect(packet(lock.initial, 3, lock)).toEqual([]);
    expect(typeof applyBoard(lock.initial, move(3, 0), lock)).toBe('string');
    expect(applyBoard(lock.initial, move(0, 3, false), lock)).toBe('Нужны все три ключа');
    expect(typeof placeJoker(lock.initial, 3, lock)).toBe('string');
  });
  it('collects the third key, unlocks and flips the front card together, rolls all three back and never duplicates a key', () => {
    let save = fresh(lock);
    for (const cmd of lock.winningPath.slice(0, 2)) save = step(save, cmd, lock);
    expect(save.attempt.board.keys).toHaveLength(2); expect(isLocked(save.attempt.board, 3, lock)).toBe(true);
    const before = structuredClone(save);
    const third = dispatch(save, lock.winningPath[2], lock);
    expect(third.events.map(e => e.type)).toEqual(['transfer', 'flip', 'key', 'unlock', 'flip']);
    save = third.next; expect(save.attempt.board.keys).toHaveLength(3); expect(save.attempt.board.faceUp).toContain('dishes_3');
    expect(isLocked(save.attempt.board, 3, lock)).toBe(false);
    save = step(save, { type: 'undo' }, lock); expect(save.attempt.board).toEqual(before.attempt.board);
    expect(isLocked(save.attempt.board, 3, lock)).toBe(true); expect(save.attempt.board.faceUp).not.toContain('dishes_3');
    save = step(save, lock.winningPath[2], lock); expect(save.attempt.board.keys).toHaveLength(3);
    expect(new Set(save.attempt.board.keys).size).toBe(3);
    expect(decodeSave(JSON.stringify(save), findDeal).attempt.board).toEqual(save.attempt.board);
  });
  it('supports deeper key reveals, valid hints and solver identity including lock state', () => {
    let board = structuredClone(lockApply.initial);
    for (const cmd of lockApply.winningPath.slice(0, 5)) board = boardStep(board, cmd, lockApply);
    expect(board.keys).toHaveLength(3); expect(knownContinuation(board, lockApply)?.length).toBe(6);
    expect(boardKey({ ...board, keys: [] })).not.toBe(boardKey(board));
    expect(() => assertBoard({ ...board, keys: ['key-a', 'key-a'] }, lockApply)).toThrow();
  });
});
describe('compatible saves and resource ownership', () => {
  it('migrates real rules-v1 control/campaign saves with spent resources and receipts intact, once', () => {
    for (const deal of [introDeal, campaignDeals[17]]) {
      const save = freshSave(deal, 'legacy-modifiers'); save.rulesVersion = 1; save.contentVersion = deal === introDeal ? 1 : 2; save.balanceVersion = 1;
      save.attempt.board.rulesVersion = 2;
      save.profile.hints = 0; save.profile.undos = 2; save.profile.coins = 917;
      applyReceipt(save, { schema: 1, id: 'queued-reward', placement: 'continue', mode: 'campaign', attempt: 'old-attempt', dealId: deal.id });
      const raw = JSON.parse(JSON.stringify(save)); delete raw.profile.jokers;
      const migrated = decodeSave(JSON.stringify(raw), findDeal);
      expect(migrated.profile).toEqual(save.profile); expect(migrated.attempt).toEqual(save.attempt); expect(migrated.platform).toEqual(save.platform);
      migrated.profile.jokers = 0;
      expect(decodeSave(JSON.stringify(migrated), findDeal).profile.jokers).toBe(0);
    }
  });
  it('buys a Joker for 250 coins without rewarded-video issuance', () => {
    const save = fresh(joker); expect(purchaseHelper(save, 'joker')).toBe(false);
    save.profile.coins = 300; expect(purchaseHelper(save, 'joker')).toBe(true);
    expect(save.profile.coins).toBe(50); expect(save.profile.jokers).toBe(2);
  });
});
