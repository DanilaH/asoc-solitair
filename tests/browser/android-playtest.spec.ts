import { expect, test } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, legalCommands, packet } from '../../src/domain/engine';
import { boardFrame, cardMetrics, layout } from '../../src/game/layout';
import { fixture, move, read, seed } from './wallet-fixture';

const level = campaignDeals[3];
test('L4 shows the category in front before and after a transfer, and explains a rejected match', async ({ page }) => {
  let save = fixture(3);
  const route = level.winningPath.slice();
  let column = -1;
  for (const action of route) {
    column = save.attempt.board.tableau.findIndex((_, i) => {
      const ids = packet(save.attempt.board, i, level);
      return ids[0] === 'flowers' && ids.at(-1) === 'flowers_2';
    });
    if (column >= 0) break;
    save = dispatch(save, action, level).next;
  }
  expect(column).toBeGreaterThanOrEqual(0);
  await seed(page, save);
  const box = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(box.width, box.height, save.settings.deckPosition, level);
  const poses = layout(save.attempt.board, level, frame).poses;
  const tulip = poses.find(p => p.id === 'flowers_2')!, category = poses.find(p => p.id === 'flowers')!;
  expect(category.depth).toBeGreaterThan(tulip.depth);
  await page.screenshot({ path: test.info().outputPath('flowers-before.png') });
  const rose = save.attempt.board.tableau.findIndex(ids => ids.at(-1) === 'flowers_1');
  expect(rose).toBeGreaterThanOrEqual(0);
  const invalid = { type: 'transfer', from: { kind: 'tableau', index: rose }, to: { kind: 'tableau', index: column } } as const;
  const fresh = await read(page);
  await move(page, level, invalid);
  await expect(page.locator('#message')).toContainText('Сначала перенесите тему');
  await expect(page.locator('#streak i.filled')).toHaveCount(0);
  expect((await read(page)).attempt.board).toEqual(fresh.attempt.board);
  const valid = legalCommands(fresh.attempt.board, level).find(cmd => cmd.type === 'transfer' && cmd.from.index === column && cmd.from.kind === 'tableau')!;
  await move(page, level, valid);
  expect((await read(page)).attempt.board).toEqual(dispatch(fresh, valid, level).next.attempt.board);
});

test('dragging an inactive card only previews it and leaves the save untouched', async ({ page, context }) => {
  const save = fixture(3);
  await seed(page, save);
  const box = (await page.locator('#game-root').boundingBox())!;
  const f = boardFrame(box.width, box.height, save.settings.deckPosition, level);
  const pose = layout(save.attempt.board, level, f).poses.find(p => p.id === 'flowers')!;
  const point = { x: box.x + pose.x * f.unit, y: box.y + (pose.y - cardMetrics(level).height / 2 + 19) * f.unit };
  const reader = (await page.locator('#inspect').boundingBox())!;
  const end = { x: reader.x + reader.width / 2, y: reader.y + reader.height / 2 };
  const before = await read(page), c = await context.newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  for (let i = 1; i <= 9; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
    { x: point.x + (end.x - point.x) * i / 9, y: point.y + (end.y - point.y) * i / 9 },
  ] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
  await expect(page.locator('#peek-status')).toBeVisible();
  await expect(page.locator('#peek-title')).toHaveText('Цветы');
  expect(await read(page)).toEqual(before);
});

test('lifting a playable card exposes the full face below it until the card returns', async ({ page, context }) => {
  const save = fixture(3);
  await seed(page, save);
  const box = (await page.locator('#game-root').boundingBox())!;
  const f = boardFrame(box.width, box.height, save.settings.deckPosition, level);
  const rose = layout(save.attempt.board, level, f).poses.find(p => p.id === 'flowers_1')!;
  const from = { x: box.x + rose.x * f.unit, y: box.y + rose.y * f.unit };
  const before = await read(page), c = await context.newCDPSession(page);
  await page.screenshot({ path: test.info().outputPath('lift-resting.png') });
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= 9; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
    { x: from.x + 105 * i / 9, y: from.y - 30 * i / 9 },
  ] });
  await page.waitForTimeout(140);
  await page.screenshot({ path: test.info().outputPath('lift-under-card.png') });
  expect(await read(page)).toEqual(before);
  await c.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await c.detach();
  await page.waitForTimeout(300);
  await page.screenshot({ path: test.info().outputPath('lift-returned.png') });
  expect(await read(page)).toEqual(before);
});

test('low moves react to the decrement and loss is visible on the board before the result', async ({ page }) => {
  const save = fixture(3); save.attempt.board.movesLeft = 2;
  await seed(page, save);
  await page.evaluate(() => {
    const w = window as typeof window & { lossWasVisible?: boolean };
    const show = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      if (this.id === 'result') w.lossWasVisible = getComputedStyle(document.querySelector('#game-root')!).filter !== 'none';
      return show.call(this);
    };
  });
  await expect(page.locator('.moves')).toHaveAttribute('data-urgency', 'critical');
  for (const action of level.winningPath.slice(0, 2)) await move(page, level, action);
  await expect(page.locator('.moves')).toHaveAttribute('data-urgency', 'lost');
  await expect(page.locator('#result-title')).toHaveText('Ходы закончились');
  expect(await page.evaluate(() => (window as typeof window & { lossWasVisible?: boolean }).lossWasVisible)).toBe(true);
  await expect(page.locator('#result-undo')).toBeVisible();
});
