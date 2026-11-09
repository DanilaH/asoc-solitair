import { describe, expect, it } from 'vitest';
import { introDeal as deal } from '../../src/content/intro';
import { applyBoard, assertBoard, dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import { knownContinuation, solve } from '../../src/domain/solver';
import { decodeSave } from '../../src/platform/runtime';
import type { Board, Save } from '../../src/domain/types';

function replay(count = deal.winningPath.length, source = freshSave(deal, 'attempt-1')): Save {
  let save = source;
  for (const action of deal.winningPath.slice(0, count)) {
    const result = dispatch(save, action, deal);
    expect(result.accepted).toBe(true); save = result.next;
  }
  return save;
}

describe('supplied deal and model boundaries', () => {
  it('replays a complete solution without assistance, preserving every card', () => {
    const save = replay();
    expect(save.attempt.board.phase).toBe('won');
    expect(save.attempt.board.movesLeft).toBe(11);
    expect(save.attempt.board.collected.slice().sort()).toEqual(Object.keys(deal.cards).sort());
    expect(save.profile.hints).toBe(3); expect(save.profile.undos).toBe(5);
    expect(save.profile.coins).toBe(147 + save.attempt.streak.coins);
  });
  it('wins on the final permitted move, before budget exhaustion', () => {
    const start = freshSave(deal, 'exact'); start.attempt.board.movesLeft = deal.winningPath.length;
    expect(replay(deal.winningPath.length, start).attempt.board.phase).toBe('won');
  });
  it('restores a cleared foundation, flip and budget in one Undo without reversing money', () => {
    const before = replay(13), completed = dispatch(before, deal.winningPath[13], deal).next;
    expect(completed.attempt.board.collected.length).toBe(5);
    const restored = dispatch(completed, { type: 'undo' }, deal).next;
    expect(restored.attempt.board).toEqual(before.attempt.board);
    expect(restored.profile.coins).toBe(completed.profile.coins);
    expect(restored.profile.undos).toBe(4);
    expect(restored.attempt.streak).toEqual(completed.attempt.streak);
    const repeated = dispatch(restored, deal.winningPath[13], deal).next;
    expect(repeated.profile.coins).toBe(completed.profile.coins);
    expect(repeated.attempt.streak.progress).toBe(completed.attempt.streak.progress);
  });
  it('recycles remaining waste in the original draw order, with no shuffle', () => {
    let save = freshSave(deal, 'recycle');
    const order = [...save.attempt.board.stock];
    for (let i = 0; i < order.length; i++) save = dispatch(save, { type: 'draw' }, deal).next;
    const before = structuredClone(save.attempt.board);
    save = dispatch(save, { type: 'recycle' }, deal).next;
    expect(save.attempt.board.stock).toEqual(order);
    expect(save.attempt.board.waste).toEqual([]);
    expect(save.attempt.board.movesLeft).toBe(before.movesLeft! - 1);
    expect(dispatch(save, { type: 'undo' }, deal).next.attempt.board).toEqual(before);
  });
  it('invalid drop only resets progress; draw and cancellation do not print rewards', () => {
    const save = replay(2);
    const bad = dispatch(save, { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'foundation', index: 0 } }, deal);
    expect(bad.accepted).toBe(false); expect(bad.next.attempt.streak.progress).toBe(0);
    expect(bad.next.attempt.board).toEqual(save.attempt.board);
    expect(bad.next.attempt.undo).toEqual(save.attempt.undo);
    const draw = dispatch(save, { type: 'draw' }, deal).next;
    expect(draw.attempt.streak).toEqual(save.attempt.streak);
  });
  it('does not farm streak through Undo/repetition or a reversed group move', () => {
    let save = replay(3);
    const after = structuredClone(save.attempt.streak);
    save = dispatch(save, { type: 'undo' }, deal).next;
    save = dispatch(save, deal.winningPath[2], deal).next;
    expect(save.attempt.streak).toEqual(after);
  });
  it('preserves the board for a hint and rejects stale hints for free', () => {
    const save = freshSave(deal, 'hint');
    const hint = dispatch(save, { type: 'hint', revision: 0, action: deal.winningPath[0] }, deal);
    expect(hint.next.attempt.board).toEqual(save.attempt.board); expect(hint.next.profile.hints).toBe(2);
    const stale = dispatch(hint.next, { type: 'hint', revision: 0, action: deal.winningPath[0] }, deal);
    expect(stale.accepted).toBe(false); expect(stale.next.profile.hints).toBe(2);
  });
  it('settles victory once and restarts the same deal with spent resources retained', () => {
    const won = replay(), repeated = dispatch(won, { type: 'draw' }, deal).next;
    expect(repeated.profile).toEqual(won.profile);
    const restarted = dispatch(won, { type: 'restart', attemptId: 'attempt-2' }, deal).next;
    expect(restarted.attempt.board).toEqual(deal.initial); expect(restarted.profile).toEqual(won.profile);
  });
  it('maintains independent card invariants across a branching reachable-state sample', () => {
    const queue: Board[] = [deal.initial];
    for (let i = 0; i < Math.min(220, queue.length); i++) {
      const board = queue[i], original = JSON.stringify(board);
      for (const cmd of legalCommands(board, deal)) {
        const result = applyBoard(board, cmd, deal);
        if (typeof result === 'string') throw Error(result);
        const ids = [...result.board.tableau.flat(), ...result.board.foundations.flat(), ...result.board.stock, ...result.board.waste, ...result.board.collected];
        expect(ids.length).toBe(15); expect(new Set(ids).size).toBe(15);
        assertBoard(result.board, deal); queue.push(result.board);
      }
      expect(JSON.stringify(board)).toBe(original);
    }
  });
  it('reports resource-limited search as UNKNOWN and known paths as budget-qualified', () => {
    expect(solve(deal.initial, deal, 1).status).toBe('UNKNOWN');
    expect(knownContinuation(deal.initial, deal)).toEqual(deal.winningPath);
    expect(knownContinuation({ ...deal.initial, movesLeft: 1 }, deal)).toBe(null);
  });
  it('validates restores and rejects corrupt cards or incompatible versions', () => {
    const save = replay(6);
    expect(decodeSave(JSON.stringify(save), deal)).toEqual(save);
    save.attempt.board.stock.push('unknown');
    expect(() => decodeSave(JSON.stringify(save), deal)).toThrow();
    expect(() => decodeSave('{"schema":2}', deal)).toThrow();
  });
});
