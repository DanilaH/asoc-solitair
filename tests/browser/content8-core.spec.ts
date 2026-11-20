import { expect, test, type Page } from '@playwright/test';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import { applyBoard, freshSave, sourceCards } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';

test.skip(process.env.VITE_CONTENT8_PREVIEW !== '1', 'Requires the Content 8 preview build.');

const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);

async function openGame(page: Page, deal: Deal) {
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  // Reserve the same 60 CSS pixels as the native banner without injecting ads.
  await page.locator('#app').evaluate(e => { e.style.height = 'calc(100dvh - 60px)'; });
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
}

async function touch(page: Page, deal: Deal, action: BoardCommand) {
  const { attempt: { board }, settings } = await read(page);
  const rect = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(rect.width, rect.height, settings.deckPosition, deal);
  const geometry = layout(board, deal, frame.height, settings.deckSide, settings.deckPosition);
  const tap = (point: { x: number; y: number }) =>
    page.touchscreen.tap(rect.x + frame.offsetX + point.x * frame.unit, rect.y + point.y * frame.unit);
  if (action.type !== 'transfer') return tap(geometry.stock);
  const id = sourceCards(board, action.from, deal).at(-1);
  await tap(geometry.poses.find(p => p.id === id)!);
  await tap(geometry.targets.find(t => t.location.kind === action.to.kind && t.location.index === action.to.index)!);
}

async function expectLegibleLesson(page: Page) {
  const copy = page.locator('#lesson-copy');
  await expect(copy).toBeVisible();
  await expect(copy).toHaveCSS('font-size', '18px');
  expect(await copy.evaluate(e => {
    const text = e.getBoundingClientRect(), panel = e.parentElement!.getBoundingClientRect();
    return text.top >= panel.top && text.bottom <= panel.bottom && panel.bottom <= innerHeight;
  })).toBe(true);
}

test('the first lesson gates real touches at 320px and resumes after reload', async ({ page }) => {
  const deal = content8Dealer[0];
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await openGame(page, deal);
  await expectLegibleLesson(page);
  const before = await read(page);
  expect(before.contentVersion).toBe(8);
  expect(typeof applyBoard(before.attempt.board, { type: 'draw' }, deal)).toBe('object');

  await page.locator('#inspect').tap();
  await expectLegibleLesson(page);
  await page.locator('#inspect').tap();
  await touch(page, deal, { type: 'draw' });
  expect((await read(page)).attempt.board).toEqual(before.attempt.board);
  expect((await read(page)).attempt.undo).toEqual([]);

  const first = deal.winningPath[0], expected = applyBoard(before.attempt.board, first, deal);
  if (typeof expected === 'string') throw Error(expected);
  await touch(page, deal, first);
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected.board);
  await expect(page.locator('#lesson-copy')).toContainText('одной темы');
  const accepted = await read(page);

  await page.reload();
  await openGame(page, deal);
  await expectLegibleLesson(page);
  await expect(page.locator('#lesson-copy')).toContainText('одной темы');
  const restored = await read(page);
  expect(restored.attempt.board).toEqual(accepted.attempt.board);
  expect(restored.attempt.undo).toEqual(accepted.attempt.undo);
  expect(restored.profile).toEqual(accepted.profile);
});

test('the free Hint lesson survives relaunch until the demonstrated play is made', async ({ page }) => {
  const deal = content8Dealer[2];
  const save = freshSave(deal, 'core0-hint-lesson');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.platform = {
    receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: [campaignId(1), campaignId(2)],
  };
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: 'asoc-solitaire.save.v1', value: JSON.stringify(save) });
  await page.goto('/');
  await openGame(page, deal);
  await expect(page.locator('#lesson-copy')).toContainText('Первый раз бесплатно');
  await page.locator('#hint').tap();
  await expect.poll(async () => Boolean((await read(page)).attempt.lessonHint)).toBe(true);
  const revealed = await read(page);
  expect(revealed.profile.hints).toBe(save.profile.hints);

  await page.reload();
  await openGame(page, deal);
  await expectLegibleLesson(page);
  expect((await read(page)).attempt.lessonHint).toEqual(revealed.attempt.lessonHint);
  await touch(page, deal, revealed.attempt.lessonHint!);
  await expect.poll(async () => (await read(page)).campaign?.tutorials).toContain('hint-practiced');
  const practiced = await read(page);
  expect(practiced.attempt.lessonHint).toBeUndefined();
  expect(practiced.profile.hints).toBe(save.profile.hints);
  await expect(page.locator('#lesson-note')).toBeHidden();
});
