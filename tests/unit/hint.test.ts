import { expect, it } from 'vitest';
import { resolveHint } from '../../src/domain/hint';
import { cardReader } from '../../src/game/card-reader';
import { campaignDeals } from '../../src/content/campaign';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { knownContinuation, solve } from '../../src/domain/solver';
import blocked from '../fixtures/hint-blocked.json' with { type: 'json' };
import type { Board } from '../../src/domain/types';

it('does not return an arbitrary move when the audited level-19 remainder is unsolvable', () => {
  expect(resolveHint(blocked as Board, campaignDeals[18])).toEqual({ status: 'UNSOLVABLE' });
});
it('distinguishes an unfinished search from an unsolvable position', () => {
  const d = campaignDeals[20];
  const r = applyBoard(d.initial, { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'foundation', index: 1 } }, d);
  if (typeof r === 'string') throw Error(r);
  expect(knownContinuation(r.board, d)).toBeNull();
  expect(resolveHint(r.board, d, 0)).toEqual({ status: 'UNKNOWN' });
  const hint = resolveHint(r.board, d);
  expect(hint.status).toBe('SOLVED');
  if (hint.status !== 'SOLVED') throw Error('missing continuation');
  const next = applyBoard(r.board, hint.action, d);
  if (typeof next === 'string') throw Error(next);
  expect(solve(next.board, d).status).toBe('SOLVED');
});
it('keeps the fast known path, respects budget and gives no hint after a win', () => {
  const d = campaignDeals[0];
  expect(resolveHint(d.initial, d, 0)).toEqual({ status: 'SOLVED', action: d.winningPath[0] });
  expect(resolveHint({ ...d.initial, movesLeft: 1 }, d)).toEqual({ status: 'UNSOLVABLE' });
  expect(resolveHint({ ...d.initial, phase: 'won' }, d)).toEqual({ status: 'UNAVAILABLE' });
});
it('the reader restores full category names and explains the actual utensil/dishes boundary', () => {
  const d = campaignDeals[5], before = JSON.stringify(d), s = freshSave(d, 'reader');
  expect(cardReader(d.cards.kitchen, d)).toEqual({ title: 'Кухонная утварь', description: expect.stringContaining('готовят еду') });
  expect(cardReader(d.cards.dishes, d)).toEqual({ title: 'Посуда', description: expect.stringContaining('кухонной утвари') });
  expect(cardReader(d.cards.kitchen_2, d).description).toBe(d.cards.kitchen_2.explanation);
  expect(JSON.stringify(d)).toBe(before); expect(s.profile.hints).toBe(3);
});
it('picture inspection stays a picture and ordered leaders keep their rank instruction', () => {
  const image = Object.values(campaignDeals[10].cards).find(c => c.image)!;
  expect(cardReader(image, campaignDeals[10])).toEqual({ title: image.text });
  const d = campaignDeals[22], leader = Object.values(d.cards).find(c => c.leader)!;
  expect(cardReader(leader, d)).toEqual({ title: leader.text, description: leader.explanation });
});
