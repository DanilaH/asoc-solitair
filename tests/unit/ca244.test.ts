import { createHash } from 'node:crypto';
import { describe, expect, it, vi, afterEach } from 'vitest';
import corpus from '../fixtures/ca244-continue.json' with { type: 'json' };
import { findContinue, verifiesContinue } from '../../src/domain/continuation';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { buyContinue, applyReceipt, platformState, useVideoContinue } from '../../src/domain/services';
import { advance } from '../../tools/qa/gameplay-oracle';
import { ContinueCheck } from '../../src/app/continue-check';
import { BALANCE } from '../../src/domain/balance';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';

const deals = corpus.deals as unknown as Record<string, Deal>;
const rows = corpus.positions as unknown as { shape: string; seed: number; margin: string; policy: string; dealId: string;
  boardHash: string; board: Board; baseline: string; candidate: string; candidateCost: number | null;
  candidatePath?: BoardCommand[]; baselinePath?: BoardCommand[]; exactPilot5: boolean }[];
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('CA-06 exact pilot6 losses, same 3000 nodes / 1400ms / +10', () => {
  it('freezes all 28 distinct states, eight prior cases, five retained and six added proofs', () => {
    expect(rows).toHaveLength(28);
    expect(new Set(rows.map(row => row.boardHash)).size).toBe(28);
    expect(rows.filter(row => row.exactPilot5)).toHaveLength(8);
    expect(rows.filter(row => row.baseline === 'PROVEN_RECOVERABLE')).toHaveLength(5);
    expect(rows.filter(row => row.candidate === 'PROVEN_RECOVERABLE')).toHaveLength(11);
    expect(rows.filter(row => row.candidateCost !== null && row.baseline !== 'PROVEN_RECOVERABLE')
      .map(row => row.candidateCost).sort((a,b) => a!-b!)).toEqual([3,3,5,8,9,9]);
  });
  it.each(rows)('$shape/$seed/$margin/$policy', row => {
    const deal = deals[row.dealId], save = freshSave(deal, 'ca244');
    save.attempt.board = structuredClone(row.board);
    const layoutHash = hash([deal.initial.tableau, deal.initial.stock, deal.initial.foundations, deal.initial.faceUp, deal.initial.hitapps]);
    expect(hash([layoutHash, row.board])).toBe(row.boardHash);
    const started = performance.now();
    const result = findContinue(save.attempt, deal, 3000, started + 1400);
    // Timing is measured, not asserted against a shared runner's scheduling jitter.
    expect(performance.now() - started).toBeLessThan(2400);
    if (row.candidate === 'PROVEN_RECOVERABLE') expect(result.status).toBe('PROVEN_RECOVERABLE');
    if (result.status !== 'PROVEN_RECOVERABLE') {
      const leaders = Object.values(deal.cards).filter(card => card.leader && !row.board.collected.includes(card.id)).length;
      expect(result.status).toBe(leaders > 10 ? 'UNSOLVABLE' : 'UNKNOWN');
      return;
    }
    const proof = { attemptId: save.attempt.id, deal, path: result.path };
    expect(verifiesContinue(save.attempt, proof)).toBe(true);
    let board: Board = { ...structuredClone(row.board), phase: 'playing', movesLeft: 10 };
    for (const action of result.path) {
      const actual = applyBoard(board, action, deal);
      expect(typeof actual).not.toBe('string');
      if (typeof actual === 'string') throw Error(actual);
      expect(actual.board).toEqual(advance(board, action, deal));
      board = actual.board;
    }
    expect(board.phase).toBe('won');
    if (row.candidateCost !== null) expect(10 - board.movesLeft!).toBe(row.candidateCost);
    save.profile.coins = BALANCE.continueCoinPrice - 1;
    expect(buyContinue(save, proof)).toBe(false);
    save.profile.coins = BALANCE.continueCoinPrice;
    expect(buyContinue(save, proof)).toBe(true);
    expect(save.profile.coins).toBe(0);
    expect(save.attempt.board.movesLeft).toBe(10);
    expect(buyContinue(save, proof)).toBe(false);
  }, 6000);
  it('keeps caps, late video rights, finite replay and refused purchase unchanged', () => {
    const row = rows.find(row => row.candidateCost === 9 && row.baseline !== 'PROVEN_RECOVERABLE')!;
    const deal = deals[row.dealId], save = freshSave(deal, 'ca244');
    save.attempt.board = structuredClone(row.board); save.profile.coins = 900;
    const proof = { attemptId: save.attempt.id, deal, path: row.candidatePath! };
    expect(findContinue(save.attempt, deal, 0)).toEqual({ status: 'UNKNOWN' });
    expect(findContinue(save.attempt, deal, 3000, performance.now()-1)).toEqual({ status: 'UNKNOWN' });
    expect(buyContinue(save, { ...proof, path: proof.path.slice(0,-1) })).toBe(false);
    save.attempt.lostLife = true;
    expect(verifiesContinue(save.attempt, proof)).toBe(false);
    expect(findContinue(save.attempt, deal)).toEqual({ status: 'UNKNOWN' });
    expect(buyContinue(save, proof)).toBe(false);
    delete save.attempt.lostLife;
    platformState(save);
    const receipt = { schema: 1 as const, id: 'late-ca244', attempt: 'abandoned', dealId: deal.id,
      mode: 'campaign' as const, placement: 'continue' as const };
    expect(applyReceipt(save, receipt)).toBe('applied');
    expect(applyReceipt(save, receipt)).toBe('already-applied');
    expect(useVideoContinue(save, deal)).toBe(true); // earned video has no route gate
    expect(save.profile.coins).toBe(900);
    expect(save.attempt.continued).toBe(true);
    expect(useVideoContinue(save, deal)).toBe(false);
  });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('ignores closed, changed, timed out and lost-life worker responses without losing wallet or rights', () => {
  vi.useFakeTimers();
  class WorkerDouble {
    static instances: WorkerDouble[] = [];
    onmessage?: (event: { data: unknown }) => void;
    onerror?: () => void;
    terminated = false;
    constructor() { WorkerDouble.instances.push(this); }
    postMessage() {}
    terminate() { this.terminated = true; }
  }
  vi.stubGlobal('Worker', WorkerDouble);
  const row = rows.find(row => row.shape === 'current' && row.candidatePath)!;
  const deal = deals[row.dealId], save = freshSave(deal, 'worker');
  save.attempt.board = structuredClone(row.board);
  const changed = vi.fn(), check = new ContinueCheck(changed);
  const reply = { status: 'PROVEN_RECOVERABLE', path: row.candidatePath };
  check.update(save.attempt, deal, true);
  const old = WorkerDouble.instances.at(-1)!;
  check.update(save.attempt, deal, false);
  old.onmessage!({ data: reply });
  expect(check.proof).toBeUndefined();
  check.update(save.attempt, deal, true);
  const next = WorkerDouble.instances.at(-1)!;
  check.update({ ...save.attempt, id: 'changed' }, deal, true);
  next.onmessage!({ data: reply });
  expect(check.proof).toBeUndefined();
  vi.advanceTimersByTime(2400);
  expect(check.status).toBe('UNKNOWN');
  WorkerDouble.instances.at(-1)!.onmessage!({ data: reply });
  expect(check.proof).toBeUndefined();
  check.update({ ...save.attempt, lostLife: true }, deal, true);
  expect(check.status).toBeUndefined();
  check.update(save.attempt, deal, true);
  WorkerDouble.instances.at(-1)!.onmessage!({ data: reply });
  expect(check.proof?.attemptId).toBe('worker');
  expect(changed).toHaveBeenCalledTimes(2);
  check.clear();
});
