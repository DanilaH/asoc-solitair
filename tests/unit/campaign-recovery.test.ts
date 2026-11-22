import { expect, it } from 'vitest';
import { recoveryDeal } from '../../src/content/campaign';
import { beginUnlimited, expireUnlimited, restoreCampaignStock } from '../../src/domain/campaign-recovery';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { buyContinue } from '../../src/domain/services';
import { advance } from '../../tools/qa/gameplay-oracle';

it('independently replays finite stock, settles an authorized restoration once and never charges a stale quote', () => {
  const deal = recoveryDeal, save = freshSave(deal, 'finite-stock');
  let board = deal.initial;
  for (const move of deal.winningPath) {
    const result = applyBoard(board, move, deal);
    if (typeof result === 'string') throw Error(result);
    expect(result.board).toEqual(advance(board, move, deal));
    board = result.board;
  }
  expect(board.phase).toBe('won');
  const first = save.attempt.board;
  first.waste = [...first.stock]; first.faceUp.push(...first.stock); first.stock = [];
  first.recyclesLeft = 0;
  const recycle = { type: 'recycle' } as const;
  expect(typeof applyBoard(first, recycle, deal)).toBe('string');
  expect(advance(first, recycle, deal)).toBeNull();
  const quote = { attemptId: save.attempt.id, revision: save.revision, cost: 0 };
  expect(restoreCampaignStock(save, deal, quote)).toBe(true);
  expect(restoreCampaignStock(save, deal, quote)).toBe(false);
  expect(save.attempt.stockRestores).toBe(1);
  expect(save.attempt.undo[0]).toEqual(first);
});

it('uses a separate verified revive and restores timed Unlimited budgets for parked saves', () => {
  const deal = recoveryDeal, save = freshSave(deal, 'revive');
  save.profile.coins = 200;
  const tail = deal.winningPath.slice(-4);
  for (const move of deal.winningPath.slice(0, -4)) {
    const result = applyBoard(save.attempt.board, move, deal);
    if (typeof result === 'string') throw Error(result);
    save.attempt.board = result.board;
  }
  save.attempt.board = { ...save.attempt.board, phase: 'exhausted', movesLeft: 0 };
  expect(buyContinue(save, { attemptId: save.attempt.id, deal, path: tail })).toBe(true);
  expect(buyContinue(save, { attemptId: save.attempt.id, deal, path: tail })).toBe(false);
  expect(save.attempt.revive).toMatchObject({ channel: 'coins', moves: 10, price: 120 });
  expect(beginUnlimited(save, deal, { id: 'time-limited-right', attemptId: save.attempt.id, until: 10 }, 1)).toBe(true);
  expect(save.attempt.board.movesLeft).toBeNull();
  const result = applyBoard(save.attempt.board, tail[0], deal);
  if (typeof result === 'string') throw Error(result);
  save.attempt.board = result.board;
  expect(save.attempt.board.retainedMoves).toBe(9);
  const parked = save.attempt;
  save.parked = { campaign: parked };
  save.attempt = freshSave(deal, 'other').attempt;
  expect(expireUnlimited(save, 0)).toBe(false);
  expect(expireUnlimited(save, 10)).toBe(true);
  expect(parked.board.movesLeft).toBe(9);
  expect(parked.unlimited?.expired).toBe(true);
  expect(expireUnlimited(save, 11)).toBe(false);
});
