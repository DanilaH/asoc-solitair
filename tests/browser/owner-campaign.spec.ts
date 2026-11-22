import { expect, test } from '@playwright/test';
import { content8Dealer, content8Wave } from '../../src/content/campaign-v8-dealer';
import { dispatch, freshSave } from '../../src/domain/engine';
import { fixture, move, read, seed } from './wallet-fixture';

const preview = process.env.VITE_C8_OWNER_PREVIEW;
if (process.env.ASOC_OWNER_GIF === '1') test.use({ video: 'on' });

test('wins level 15 and starts the certified tighter level 16 with its saved budget', async ({ page }) => {
  test.skip(preview !== 'director', 'Requires the gated P06 gameplay build.');
  await page.setViewportSize({ width: 320, height: 568 });
  const previous = content8Dealer[14], base = content8Wave[0];
  let save = { ...fixture(14), attempt: freshSave(previous, 'owner-director').attempt, contentVersion: 8 };
  for (const cmd of previous.winningPath.slice(0, -1)) save = dispatch(save, cmd, previous).next;
  save.settings.reducedMotion = true;
  save.difficultyHistory = Array.from({ length: 9 }, () => ({ outcome: 'Clean', restarts: 0 }));
  await seed(page, save);
  await move(page, previous, previous.winningPath.at(-1)!);
  await page.locator('#next-level').tap();
  if (await page.locator('#difficulty-play').isVisible()) await page.locator('#difficulty-play').tap();
  const id = base.id + '-tight-r2';
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', id);
  const started = (await read(page)).attempt;
  expect(started.dealId).toBe(id);
  expect(started.board.movesLeft).toBeLessThan(base.initial.movesLeft!);
  await page.waitForTimeout(650);
  await page.reload();
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', id);
  expect((await read(page)).attempt.board).toEqual(started.board);
});

test('starts the recorded Equality layout through Next and resumes its unchanged save', async ({ page }) => {
  test.skip(preview !== 'equality', 'Requires the gated P08 gameplay build.');
  await page.setViewportSize({ width: 320, height: 568 });
  const previous = content8Dealer[14];
  const { equalityPreviewDeal } = await import('../../src/content/campaign-v8-equality');
  let save = { ...fixture(14), attempt: freshSave(previous, 'owner-equality').attempt, contentVersion: 8 };
  save.settings.reducedMotion = true;
  for (const cmd of previous.winningPath.slice(0, -1)) save = dispatch(save, cmd, previous).next;
  await seed(page, save);
  await move(page, previous, previous.winningPath.at(-1)!);
  await page.locator('#next-level').tap();
  if (await page.locator('#difficulty-play').isVisible()) await page.locator('#difficulty-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', equalityPreviewDeal.id);
  const started = await read(page);
  expect(started.equality?.last).toMatchObject({ dealId: equalityPreviewDeal.id, segment: 'NonPayer', cohortEvidence: 'controlled-fixture' });
  expect(started.attempt.board).toEqual(equalityPreviewDeal.initial);
  await page.waitForTimeout(650);
  await page.reload();
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', equalityPreviewDeal.id);
  expect((await read(page)).attempt.board).toEqual(started.attempt.board);
});

test('warns before the separate random Joker and clears Undo only after confirm', async ({ page }) => {
  test.skip(preview !== 'random-joker', 'Requires the gated P15 gameplay build.');
  await page.setViewportSize({ width: 320, height: 568 });
  const { randomJokerFixture } = await import('../fixtures/owner-random-joker');
  const { save, column } = randomJokerFixture();
  await page.addInitScript(i => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = array => {
      if (array instanceof Uint32Array && array.length === 1) { array[0] = i; return array; }
      return original(array);
    };
  }, column);
  await seed(page, save);
  const open = async () => { await page.locator('#wallet-open').tap(); await page.locator('#random-joker-open').tap(); };
  await open();
  await expect(page.locator('#random-joker-warning')).toContainText('история отмены очистится');
  await page.locator('#random-joker-warning [data-close]').tap();
  expect((await read(page)).attempt).toMatchObject({ board: save.attempt.board, undo: save.attempt.undo });
  await open();
  await page.locator('#random-joker-confirm').tap();
  await expect.poll(async () => (await read(page)).attempt.randomJokerUsed).toBe(true);
  expect((await read(page)).attempt.undo).toEqual([]);
  await page.waitForTimeout(650);
  await page.reload();
  await page.locator('#home-play').tap();
  await expect.poll(async () => (await read(page)).attempt.board.joker?.card?.nativeType).toBe(2);
});

test('restores a finite stock and applies a separate timed Unlimited grant through the game', async ({ page }) => {
  test.skip(preview !== 'recovery', 'Requires the gated P19 gameplay build.');
  await page.setViewportSize({ width: 320, height: 568 });
  const { recoveryDeal } = await import('../../src/content/campaign');
  const save = { ...fixture(15), attempt: freshSave(recoveryDeal, 'recovery-controls').attempt, contentVersion: 8 };
  const board = save.attempt.board;
  board.waste = [...board.stock];
  board.faceUp.push(...board.stock);
  board.stock = [];
  board.recyclesLeft = 0;
  save.settings.reducedMotion = true;
  await seed(page, save);
  await page.locator('#wallet-open').tap();
  await expect(page.locator('#restore-stock')).toContainText('бесплатно');
  await page.locator('#restore-stock').tap();
  await expect.poll(async () => (await read(page)).attempt.stockRestores).toBe(1);
  const restored = await read(page);
  expect(restored.attempt.board.stock).toEqual(board.waste);
  expect(restored.profile.coins).toBe(save.profile.coins);
  await page.locator('#wallet-open').tap();
  await page.locator('#unlimited-preview').tap();
  await expect(page.locator('#moves')).toHaveText('∞');
  await page.waitForTimeout(650);
  await page.reload();
  await page.locator('#home-play').tap();
  await expect(page.locator('#moves')).toHaveText('∞');
});
