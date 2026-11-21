import { expect, test, type Page } from '@playwright/test';
import { buildQ2Save, q2Positions } from '../../src/app/q2-positions';
import { findDeal } from '../../src/content/campaign';
import { decodeRoute } from '../../src/content/campaign-v8-dealer';
import { applyBoard, sourceCards } from '../../src/domain/engine';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';

const normalKey = 'asoc-solitaire.save.v1';
const q2Key = 'q2:' + normalKey;
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as Save, q2Key);
const enabled = process.env.VITE_CONTENT8_Q2 === '1' && process.env.VITE_CONTENT8_PREVIEW === '1';

async function touch(page: Page, deal: Deal, state: Save, action: BoardCommand) {
  const { board } = state.attempt;
  const root = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(root.width, root.height, state.settings.deckPosition, deal);
  const geometry = layout(board, deal, frame.height, state.settings.deckSide, state.settings.deckPosition);
  const tap = (point: { x: number; y: number }) =>
    page.touchscreen.tap(root.x + frame.offsetX + point.x * frame.unit, root.y + point.y * frame.unit);
  if (action.type !== 'transfer') return tap(geometry.stock);
  const cardId = sourceCards(board, action.from, deal).at(-1);
  await tap(geometry.poses.find(pose => pose.id === cardId)!);
  await tap(geometry.targets.find(target => target.location.kind === action.to.kind && target.location.index === action.to.index)!);
}

test('regular builds hide the control positions', async ({ page }) => {
  test.skip(enabled, 'This case runs on the regular preview.');
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#q2-open')).toBeHidden();
  expect(await page.evaluate(key => localStorage.getItem(key), q2Key)).toBeNull();
});

test('loads all five control positions with real touches and keeps the regular profile separate', async ({ page }) => {
  test.skip(!enabled, 'Requires the isolated Q2 build.');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(key => localStorage.setItem(key, 'regular-profile-sentinel'), normalKey);
  await page.goto('/');
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-ready', 'true');
  let lastAttempt = '';
  const alternatives = ['r', 't1>t0', 't1>t3', 't0>t1', 't0>t1'];
  for (const [index, position] of q2Positions.entries()) {
    await page.locator('#q2-open').tap();
    const option = page.locator(`#q2-positions [data-position="${position.id}"]`);
    await expect(option).toBeInViewport();
    await option.tap();
    await expect(app).toHaveAttribute('data-ready', 'true');
    await expect(app).toHaveAttribute('data-presented-deal', position.dealId);
    const before = await read(page);
    const deal = findDeal(position.dealId)!;
    expect(before.contentVersion).toBe(8);
    expect(before.attempt.id).not.toBe(lastAttempt);
    expect(before.attempt.board.movesLeft).toBe(position.movesLeft);
    expect(before.attempt).toEqual(buildQ2Save(position, deal, before.attempt.id, before.settings).attempt);
    lastAttempt = before.attempt.id;
    const intro = page.locator('#learn-rule[open]');
    if (await intro.isVisible()) await intro.locator('[data-lesson-close]').first().tap();
    const alternative = decodeRoute(alternatives[index])[0];
    const expected = applyBoard(before.attempt.board, alternative, deal);
    if (typeof expected === 'string') throw Error(expected);
    await touch(page, deal, before, alternative);
    await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected.board);
    if (index + 1 < q2Positions.length) {
      await page.locator('#menu').tap();
      await page.locator('#levels-open').tap();
    }
  }
  const live = (await read(page)).attempt;
  await page.reload();
  await expect(app).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await expect(app).toHaveAttribute('data-presented-deal', live.dealId);
  expect((await read(page)).attempt).toEqual(live);
  expect(await page.evaluate(key => localStorage.getItem(key), normalKey)).toBe('regular-profile-sentinel');
});
