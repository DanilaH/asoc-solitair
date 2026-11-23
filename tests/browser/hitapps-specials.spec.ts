import { expect, test } from '@playwright/test';
import { oneKeyDeal, picturedSpecialsDeal } from '../../src/content/campaign-v8-hitapps-specials';
import { freshSave } from '../../src/domain/engine';
import { fixture, move, read, seed } from './wallet-fixture';

test.skip(process.env.VITE_C8_OWNER_PREVIEW !== 'specials', 'Isolated specials build');
test.use({ video: 'on' });

test('one-key lock opens on the first key and Undo closes it after reload', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const deal = oneKeyDeal;
  const save = { ...fixture(17), attempt: freshSave(deal, 'one-key-ui').attempt, contentVersion: 8 };
  save.settings.reducedMotion = true;
  await seed(page, save);
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  const lesson = page.getByRole('dialog', { name: 'Один ключ' });
  await expect(lesson.locator('#lesson-keys img')).toHaveCount(1);
  await expect(lesson).toContainText('Откройте карту с ключом');
  await page.waitForTimeout(600);
  await lesson.getByRole('button', { name: 'Попробовать' }).tap();
  await expect(lesson).toBeHidden();
  await expect.poll(async () => (await read(page)).campaign?.tutorials).toContain('intro:keys:1');
  await expect.poll(async () => (await read(page)).attempt.board.faceUp).not.toContain('spruce');
  await page.waitForTimeout(850);
  await move(page, deal, deal.winningPath[0]);
  expect((await read(page)).attempt.board.keys).toEqual(['single-key']);
  expect((await read(page)).attempt.board.faceUp).toContain('spruce');
  await page.reload();
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('#learn-rule')).toBeHidden();
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(deal.initial);
  await page.waitForTimeout(750);
});

test('pictured halves join, can be separated after reload, and go into a foundation together', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const deal = picturedSpecialsDeal;
  const save = { ...fixture(25), attempt: freshSave(deal, 'pictured-combination').attempt, contentVersion: 8 };
  save.settings.reducedMotion = true;
  await seed(page, save);
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  for (const action of deal.winningPath.slice(0, 6)) await move(page, deal, action);
  expect((await read(page)).attempt.board.waste).toEqual(['shell-top']);
  await page.waitForTimeout(650);
  await move(page, deal, deal.winningPath[6]);
  expect((await read(page)).attempt.board.tableau[4]).toEqual(['shell-bottom', 'shell-top']);
  await page.waitForTimeout(800);
  await page.reload();
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board.waste).toEqual(['shell-top']);
  for (const action of deal.winningPath.slice(6)) await move(page, deal, action);
  await expect(page.locator('#result')).toBeVisible();
  expect((await read(page)).attempt.board).toMatchObject({ phase: 'won', movesLeft: 11 });
});

test('pictured effects support a quick next move and Undo at contact on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const drawErrors: string[] = [];
  page.on('pageerror', error => drawErrors.push(error.message));
  const deal = picturedSpecialsDeal;
  const save = { ...fixture(25), attempt: freshSave(deal, 'pictured-feedback').attempt, contentVersion: 8 };
  await seed(page, save);
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('html')).toHaveAttribute('data-reduced', 'false');
  await page.waitForTimeout(300);

  await move(page, deal, deal.winningPath[0]);
  await page.waitForTimeout(320);
  await move(page, deal, deal.winningPath[1]);
  const afterCut = (await read(page)).attempt.board;
  await move(page, deal, deal.winningPath[2]);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(afterCut);
  await move(page, deal, deal.winningPath[2]);
  for (const action of deal.winningPath.slice(3, 6)) {
    await move(page, deal, action);
    await page.waitForTimeout(360);
  }

  const separate = (await read(page)).attempt.board;
  await move(page, deal, deal.winningPath[6]);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(separate);
  await page.waitForTimeout(350);
  await move(page, deal, deal.winningPath[6]);
  await page.waitForTimeout(540);
  expect((await read(page)).attempt.board.tableau[4]).toEqual(['shell-bottom', 'shell-top']);
  expect(drawErrors).toEqual([]);
});
