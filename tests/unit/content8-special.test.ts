import { afterEach, expect, it, vi } from 'vitest';
import { content8Special } from '../../src/content/campaign-v8-special';
import { applyBoard, assertBoard, isLocked, legalCommands } from '../../src/domain/engine';
import { resolveHint } from '../../src/domain/hint';
import type { Board, BoardCommand } from '../../src/domain/types';
import { advance } from '../../tools/qa/gameplay-oracle';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each(content8Special)('wins and checks legal hints under the special rules of $id', deal => {
  expect(deal.recoveryPaths?.length).toBeGreaterThan(0);
  const paths = [deal.winningPath, ...(deal.recoveryPaths ?? [])];
  for (const path of paths) {
    let board = deal.initial;
    assertBoard(board, deal);
    const hint = resolveHint(board, deal);
    expect(hint).toEqual({ status: 'SOLVED', action: deal.winningPath[0] });
    for (const [index, move] of path.entries()) {
      const applied = applyBoard(board, move, deal);
      if (typeof applied === 'string') throw Error(`${deal.id} move ${index}: ${applied}`);
      expect(applied.board).toEqual(advance(board, move, deal));
      board = applied.board;
    }
    expect(board.phase).toBe('won');
    expect(board.movesLeft).toBeGreaterThanOrEqual(0);
  }
});

it('rejects the second ordered member until the first is placed', () => {
  const deal = content8Special[0];
  const board: Board = {
    ...deal.initial,
    tableau: [['workdays_2'], [], []],
    stock: Object.keys(deal.cards).filter(id => !['workdays', 'workdays_2'].includes(id)),
    foundations: [['workdays'], [], []],
    faceUp: ['workdays', 'workdays_2'],
  };
  assertBoard(board, deal);
  const premature: BoardCommand = { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'foundation', index: 0 } };
  expect(applyBoard(board, premature, deal)).toBe('Сначала нужен элемент №1');
  expect(legalCommands(board, deal)).not.toContainEqual(premature);
  expect(board.movesLeft).toBe(deal.initial.movesLeft);
});

it('selects special definitions for fresh starts and restores the old C8 board and Undo by ID', async () => {
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  const { campaignDeals, findDeal } = await import('../../src/content/campaign');
  const { freshSave, dispatch } = await import('../../src/domain/engine');
  const { decodeSave } = await import('../../src/platform/storage');
  for (const deal of content8Special) {
    const level = deal.campaignLevel!;
    const archived = findDeal('campaign-c8-wave-' + String(level).padStart(3, '0'))!;
    expect(campaignDeals[level - 1].id).toBe(deal.id);
    expect(archived.initial.tableau.map(col => col.length)).toEqual(deal.initial.tableau.map(col => col.length));
    expect(archived.initial.movesLeft).toBe(deal.initial.movesLeft);
    const old = dispatch(freshSave(archived, 'old-' + level), archived.winningPath[0], archived).next;
    expect(decodeSave(JSON.stringify(old), findDeal).attempt).toEqual(old.attempt);
  }
});

it('keeps the lock closed at two keys through save, Undo, and restart', async () => {
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  const { freshSave, dispatch } = await import('../../src/domain/engine');
  const { decodeSave } = await import('../../src/platform/storage');
  const { campaignId } = await import('../../src/domain/progression');
  const deal = content8Special[1], column = deal.lock!.column;
  let save = freshSave(deal, 'test-three-keys');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 17 }, (_, i) => campaignId(i + 1)) };
  const move = deal.winningPath[0];
  if (move.type !== 'transfer') throw Error('No introductory transfer');
  const lockedDestination: BoardCommand = { ...move, to: { kind: 'tableau', index: column } };
  expect(applyBoard(save.attempt.board, lockedDestination, deal)).toBe('Нужны все три ключа');
  expect(applyBoard(save.attempt.board, { ...move, from: { kind: 'tableau', index: column } }, deal)).toBe('Эти карты пока недоступны');
  for (const action of deal.winningPath.slice(0, 2)) {
    const next = dispatch(save, action, deal);
    expect(next.accepted).toBe(true);
    save = next.next;
  }
  save = decodeSave(JSON.stringify(save), deal);
  const two = structuredClone(save.attempt.board);
  expect(two.keys).toHaveLength(2);
  expect(isLocked(two, column, deal)).toBe(true);
  const opened = dispatch(save, deal.winningPath[2], deal);
  expect(opened.next.attempt.board.keys).toHaveLength(3);
  expect(isLocked(opened.next.attempt.board, column, deal)).toBe(false);
  expect(opened.events.filter(event => event.type === 'unlock')).toHaveLength(1);
  const undone = dispatch(opened.next, { type: 'undo' }, deal);
  expect(undone.accepted).toBe(true);
  expect(undone.next.attempt.board).toEqual(two);
  const restarted = dispatch(undone.next, { type: 'restart', attemptId: 'test-keys-restart' }, deal);
  expect(restarted.next.attempt.board).toEqual(deal.initial);
});
