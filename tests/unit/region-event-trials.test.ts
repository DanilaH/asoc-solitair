import { expect, it, vi } from 'vitest';
import { buildRegion, cascadeSchedule, claimDig, claimWheel, excavate, findTreasure,
  recordRegionWin, spinWheel, wheelOdds } from '../../tools/content/region-event-trials';

it('requires a level-unlock, earned stars and a building prerequisite', () => {
  const area = { id: 'north', level: 16, buildings: [{ id: 'road', stars: 2 }, { id: 'house', stars: 3, after: 'road' }] };
  const start = { level: 16, stars: 0, built: [], creditedWins: [], completed: [] };
  const win = { firstWin: true, id: 'win', stars: 5 };
  const withStars = recordRegionWin(start, win);
  expect(recordRegionWin(withStars, win)).toBe(withStars);
  expect(buildRegion(withStars, area, 'house')).toBe(withStars);
  const road = buildRegion(withStars, area, 'road');
  expect(buildRegion(road, area, 'house')).toMatchObject({ stars: 0, completed: ['north'] });
});

it('schedules distinct slots by priority while retaining older claims', () => {
  const base = { start: 10, end: 50, priority: 1, slot: 'main' };
  const state = { now: 30, completed: ['opening'], active: [], pendingClaims: ['prior'] };
  const { next, pendingClaims } = cascadeSchedule([{ ...base, id: 'old', end: 30 }, { ...base, id: 'prior' },
    { ...base, id: 'late', priority: 2 }, { ...base, id: 'locked', after: 'unfinished' },
    { ...base, id: 'picked', after: 'opening' }, { ...base, id: 'side', slot: 'side' }], state);
  expect(next.map(item => item.id)).toEqual(['picked', 'side']);
  expect(pendingClaims).toEqual(['prior']);
});

it('digs and claims on separate stages without repeat spends', () => {
  const board = { id: 'stage', cells: [{ cost: 1 }, { cost: 1, find: 'shard' }], required: ['shard'] };
  const state = { version: 1 as const, stage: 'stage', tokens: 2, opened: [], finds: [], claimed: false };
  const open = excavate(state, board, 0);
  expect(excavate(open, board, 0)).toBe(open);
  expect(claimDig(open, board)).toBe(open);
  const found = excavate(open, board, 1);
  expect(claimDig(found, board)).toMatchObject({ tokens: 0, claimed: true, finds: ['shard'] });
});

it('publishes exact wheel weights and requires one paid-in-tokens selection and one claim', () => {
  const wedges = [{ id: 'small', weight: 3, coins: 5 }, { id: 'large', weight: 1, coins: 15 }];
  expect(wheelOdds(wedges)).toEqual([{ id: 'small', numerator: 3, denominator: 4 }, { id: 'large', numerator: 1, denominator: 4 }]);
  const start = { tokens: 2, coins: 0, offers: [] };
  const rng = vi.fn(() => 3);
  const spin = spinWheel(start, wedges, 'new', rng);
  expect(rng).toHaveBeenCalledExactlyOnceWith(4);
  expect(spinWheel(spin, wedges, 'new', rng)).toBe(spin);
  expect(claimWheel(spin, 'new')).toMatchObject({ tokens: 1, coins: 15 });
});

it('uses a fixed traversal and fresh step keys for treasure chapters', () => {
  const chapters = [[{ cost: 1, coins: 3 }, { cost: 2, coins: 8 }], [{ cost: 2, coins: 7 }]];
  const start = { version: 1 as const, chapter: 0, step: 0, coins: 0, tokens: 3, keys: [] };
  const step = findTreasure(start, chapters, 'one');
  expect(findTreasure(step, chapters, 'one')).toBe(step);
  const next = findTreasure(step, chapters, 'two');
  expect(next).toMatchObject({ chapter: 1, step: 0, tokens: 0, coins: 11 });
  expect(findTreasure(next, chapters, 'three')).toBe(next);
});
