import { pauseOptions } from '../../tools/qa/navigation';
import { expect, test } from '@playwright/test';
import { openIntro, resume } from './fixtures';
const read = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!));

test('helper exchange persists charges and wallet; unavailable video never grants a reward', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await openIntro(page);
  const before = await read(page);
  await page.locator('#menu').tap(); await pauseOptions(page); await page.locator('#helpers-open').tap();
  await expect(page.locator('#helpers')).toBeVisible(); await expect(page.locator('#video-hint')).toBeDisabled();
  await page.locator('#buy-hint').tap(); await expect(page.locator('#coins')).toHaveText('0');
  await expect(page.locator('#hint-stock')).toHaveText('4'); await expect(page.locator('#buy-hint')).toBeDisabled();
  expect((await read(page)).attempt.board).toEqual(before.attempt.board);
  expect((await read(page)).profile.hints).toBe(4);
  await page.screenshot({ path: `test-results/${test.info().project.name}-helpers.png` });
  await resume(page);
  expect((await read(page)).profile.hints).toBe(4); expect((await read(page)).profile.coins).toBe(0);
  expect(errors).toEqual([]);
});

test('sound and haptic settings persist independently and dialogs fit compact viewport', async ({ page }) => {
  await openIntro(page);
  await page.locator('#menu').tap(); await pauseOptions(page); await page.locator('#haptics').uncheck();
  await expect.poll(async () => (await read(page)).settings.haptics).toBe(false);
  expect((await read(page)).settings.sfx).toBe(true);
  const rect = await page.locator('#settings').boundingBox(); expect(rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 16);
  await resume(page);
  await page.locator('#menu').tap(); await expect(page.locator('#haptics')).not.toBeChecked(); await expect(page.locator('#sfx')).toBeChecked();
  await pauseOptions(page); await page.locator('#helpers-open').tap();
  expect(await page.locator('#helpers').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.locator('#banner-slot').isVisible()).toBe(false);
});

test('a failed purchase preserves funds and a retry commits exactly once', async ({ page }) => {
  await openIntro(page);
  await page.locator('#menu').tap(); await pauseOptions(page); await page.locator('#helpers-open').tap();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'asoc-solitaire.save.v1' && fail) { fail = false; throw new DOMException('quota', 'QuotaExceededError'); }
      return original.call(this, key, value);
    };
  });
  await page.locator('#buy-undo').tap();
  await expect(page.locator('#coins')).toHaveText('100'); expect((await read(page)).profile.undos).toBe(5);
  await page.locator('#buy-undo').tap(); await expect(page.locator('#coins')).toHaveText('40');
  expect((await read(page)).profile.undos).toBe(6);
});
