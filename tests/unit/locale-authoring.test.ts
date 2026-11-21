import { expect, it, vi } from 'vitest';
import { beyond80Deals } from '../../src/content/campaign-v8-beyond';
import { englishBeyondDeal, localizedBudget, LOCALE_ART_DIGEST } from '../../src/content/campaign-v8-locale';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { advance } from '../../tools/qa/gameplay-oracle';
import { authorLocaleThemes } from '../../tools/content/locale-art-authoring';
import { cardReader } from '../../src/game/card-reader';
import { findDeal } from '../../src/content/campaign';

it('verifies the original positive budget formula and distinguishes guarded and negative branches', () => {
  for (const [base, en, ru, expected] of [[70, 16, 17, 75], [70, 16, 15, 70], [117, 50, 60, 145], [117, 60, 50, 100],
    [2_147_483_647, 1, 2_147_483_647, 2_147_483_647]]) {
    expect(localizedBudget(base, en, ru, true)).toEqual({ moves: expected, origin: 'positive-model' });
  }
  expect(localizedBudget(-1, 10, 10, true)).toEqual({ moves: 0, origin: 'zero-base' });
  expect(localizedBudget(53, 0, 10, true)).toEqual({ moves: 53, origin: 'product-fallback' });
  expect(localizedBudget(53, 10, -1, true)).toEqual({ moves: 53, origin: 'product-fallback' });
  expect(localizedBudget(53, 10, 10, false)).toEqual({ moves: 53, origin: 'unadjusted' });
});

it('applies only strictly positive available art, handles failures and leaves the preset unchanged', async () => {
  const single = (id: string, words: string[], packaged: string[]) => ({ id, words, packaged });
  const plans = [single('a', ['one', 'two'], ['a', 'b', 'c']), single('zero', ['zero'], ['0']),
    single('bad', ['fallback'], ['bad']), single('empty', [], ['empty'])];
  const load = vi.fn(async (refs: readonly string[]) => {
    if (refs[0] === 'bad') throw Error('missing file');
    return refs[0] === '0' ? 0 : refs.length;
  });
  const model = await authorLocaleThemes(plans, { preloadMs: 1000, preset: false }, load);
  expect(model.map(theme => [theme.status, theme.effectiveCount])).toEqual([['loaded', 3], ['zero', 1], ['missing', 1], ['loaded', 0]]);
  expect(model[0].members.map(member => member.wordIndex)).toEqual([0, 1, 0]);
  expect(new Set(model[0].members.map(member => member.id)).size).toBe(3);
  load.mockClear();
  const preset = await authorLocaleThemes(plans, { preloadMs: 1000, preset: true }, load);
  expect(preset.map(theme => theme.effectiveCount)).toEqual([2, 1, 1, 0]);
  expect(load).not.toHaveBeenCalled();
  await expect(authorLocaleThemes([single('x', ['broken'], ['same', 'same'])], { preloadMs: 1000, preset: false }, load)).rejects.toThrow();
});

it('freezes the authoring fallback before a late count returns', async () => {
  vi.useFakeTimers();
  try {
    let finish: (value: number) => void = () => { throw Error('loader not started'); };
    const result = authorLocaleThemes([{ id: 'late', words: ['one'], packaged: ['two', 'three'] }], { preloadMs: 10, preset: false },
      () => new Promise(resolve => { finish = resolve; }));
    await vi.advanceTimersByTimeAsync(10);
    const frozen = await result;
    expect(frozen[0]).toMatchObject({ status: 'timeout', effectiveCount: 1 });
    finish(2);
    await Promise.resolve();
    expect(frozen[0].effectiveCount).toBe(1);
  } finally { vi.useRealTimers(); }
});

it('keeps both content IDs addressable and cross-checks the English board and definitions', () => {
  const original = beyond80Deals[0];
  expect(findDeal(original.id)).toBe(original);
  expect(findDeal(englishBeyondDeal.id)).toBe(englishBeyondDeal);
  expect(englishBeyondDeal.initial.movesLeft).toBe(55);
  expect(original.initial.movesLeft).toBe(53);
  expect(freshSave(original, 'old').settings.contentLanguage).toBeUndefined();
  expect(cardReader(englishBeyondDeal.cards['ru81-2_1'], englishBeyondDeal).title).toBe('Candle');
  expect(createHash('sha256').update(readFileSync('public/art/generated/candle.webp')).digest('hex')).toBe(LOCALE_ART_DIGEST);
  for (const path of [englishBeyondDeal.winningPath, ...englishBeyondDeal.recoveryPaths!]) {
    let board = englishBeyondDeal.initial;
    for (const action of path) {
      const out = applyBoard(board, action, englishBeyondDeal);
      if (typeof out === 'string') throw Error(out);
      expect(out.board).toEqual(advance(board, action, englishBeyondDeal));
      board = out.board;
    }
    expect(board.phase).toBe('won');
  }
});
