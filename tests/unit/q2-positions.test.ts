import { afterAll, expect, it, vi } from 'vitest';
import { buildQ2Save, q2Positions } from '../../src/app/q2-positions';
import { findDeal } from '../../src/content/campaign';
import { decodeRoute } from '../../src/content/campaign-v8-dealer';
import { freshSave } from '../../src/domain/engine';
import { completedLevels } from '../../src/domain/progression';
import { decodeSave } from '../../src/platform/storage';
import { advance } from '../../tools/qa/gameplay-oracle';

vi.hoisted(() => vi.stubEnv('VITE_CONTENT8_PREVIEW', '1'));
afterAll(() => vi.unstubAllEnvs());

const alternatives = ['r', 't1>t0', 't1>t3', 't0>t1', 't0>t1'];

it.each(q2Positions.map((position, index) => ({ position, alternate: alternatives[index] })))(
  'builds the independently verified position $position.id as a reloadable save', ({ position, alternate }) => {
    const deal = findDeal(position.dealId)!;
    const settings = { ...freshSave(deal, 'original').settings, deckPosition: 'bottom' as const };
    const save = buildQ2Save(position, deal, 'q2', settings);
    expect(completedLevels(save)).toBe(position.level - 1);
    expect(save.settings).toEqual(settings);
    expect(save.attempt.board.movesLeft).toBe(position.movesLeft);
    let board = deal.initial;
    for (const action of deal.winningPath.slice(0, position.move - 1)) {
      const next = advance(board, action, deal);
      expect(next).toBeTruthy();
      board = next!;
    }
    expect(save.attempt.board).toEqual(board);
    expect(advance(board, decodeRoute(alternate)[0], deal)?.movesLeft).toBe(position.movesLeft - 1);
    const reloaded = decodeSave(JSON.stringify(save), findDeal);
    expect(reloaded.attempt).toEqual(save.attempt);
  },
);

it('rejects a changed deal identity or budget', () => {
  const position = q2Positions[0];
  const deal = findDeal(position.dealId)!;
  const settings = freshSave(deal, 'original').settings;
  expect(() => buildQ2Save(position, { ...deal, id: 'replacement' }, 'q2', settings)).toThrow('версия раздачи');
  const initial = { ...deal.initial, movesLeft: deal.initial.movesLeft! + 1 };
  expect(() => buildQ2Save(position, { ...deal, initial }, 'q2', settings)).toThrow('лимит ходов');
});
