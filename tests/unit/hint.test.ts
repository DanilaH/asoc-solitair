import { expect, it } from 'vitest';
import { resolveHint } from '../../src/domain/hint';
import { cardReader } from '../../src/game/card-reader';
import { content6CampaignDeals as campaignDeals, legacyCampaignDeals } from '../../src/content/campaign';
import { dailyPool } from '../../src/content/daily';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { knownContinuation, solve } from '../../src/domain/solver';
import blocked from '../fixtures/hint-blocked.json' with { type: 'json' };
import type { Board } from '../../src/domain/types';

it('does not return an arbitrary move when the audited level-19 remainder is unsolvable', () => {
  expect(resolveHint(blocked as Board, campaignDeals[18])).toEqual({ status: 'UNSOLVABLE' });
}, 15000); // Same8000-state proof; allow slower developer CPUs without weakening the assertion.
it('distinguishes an unfinished search from an unsolvable position', () => {
  const d = campaignDeals[20];
  const first = applyBoard(d.initial, d.winningPath[0], d); if (typeof first === 'string') throw Error(first);
  const opened = applyBoard(first.board, d.winningPath[1], d); if (typeof opened === 'string') throw Error(opened);
  const r = applyBoard(opened.board, { type: 'transfer', from: { kind: 'tableau', index: 2 }, to: { kind: 'tableau', index: 1 } }, d);
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
it('remaps every fixed continuation through reversed foundations without searching or changing card state', () => {
  for (const d of [...campaignDeals, ...dailyPool]) {
    let b = structuredClone(d.initial);
    for (let i = 0; i < Math.min(3, d.winningPath.length - 1); i++) {
      const next = applyBoard(b, d.winningPath[i], d); if (typeof next === 'string') throw Error(next); b = next.board;
    }
    b.foundations.reverse(); const before = structuredClone(b);
    const path = knownContinuation(b, d); expect(path, d.id).not.toBeNull();
    expect(b).toEqual(before);
    for (const action of path!) { const n = applyBoard(b, action, d); if (typeof n === 'string') throw Error(d.id + ': ' + n); b = n.board; }
    expect(b.phase, d.id).toBe('won');
  }
});
it('keeps the fast known path, respects budget and gives no hint after a win', () => {
  const d = campaignDeals[0];
  expect(resolveHint(d.initial, d, 0)).toEqual({ status: 'SOLVED', action: d.winningPath[0] });
  expect(resolveHint({ ...d.initial, movesLeft: 1 }, d)).toEqual({ status: 'UNSOLVABLE' });
  expect(resolveHint({ ...d.initial, phase: 'won' }, d)).toEqual({ status: 'UNAVAILABLE' });
});
it('the reader restores full category names and explains the actual utensil/dishes boundary', () => {
  const d = legacyCampaignDeals[5], before = JSON.stringify(d), s = freshSave(d, 'reader');
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

it.each([
  ['campaign-c8-special-017-core-special-r1', 1],
  ['campaign-c8-special-026-core-special-r1', 4],
] as const)('finds a proven hint on the audited deviation in %s', async (id, to) => {
  const { findDeal } = await import('../../src/content/campaign');
  const { findReferenceRoute } = await import('../../src/domain/ordinary-search');
  const deal = findDeal(id)!;
  const deviation = applyBoard(deal.initial,
    { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'tableau', index: to } }, deal);
  if (typeof deviation === 'string') throw Error(deviation);
  const hint = resolveHint(deviation.board, deal);
  const certificate = findReferenceRoute(deal, deviation.board, 4000, true, Infinity, 'full-board');
  if (certificate.status !== 'FOUND') throw Error('Expected a full winning route');
  expect(hint).toEqual({ status: 'SOLVED', action: certificate.path[0] });
  let board = deviation.board;
  for (const action of certificate.path) {
    const next = applyBoard(board, action, deal);
    if (typeof next === 'string') throw Error(next);
    board = next.board;
  }
  expect(board.phase).toBe('won');
}, 15_000);
