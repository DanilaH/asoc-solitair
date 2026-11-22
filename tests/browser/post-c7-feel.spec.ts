import { expect, test } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, sourceCards } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import { fixture, move, read, seed } from './wallet-fixture';

if (process.env.ASOC_CAPTURE_COMPARISON === '1') test.use({ video: 'on' });

test('a drag away from a tapped target cancels the pending transfer', async ({ page }) => {
  const deal = campaignDeals[3];
  const save = fixture(3);
  const command = deal.winningPath[0];
  if (command.type !== 'transfer') throw Error('Expected a C7 transfer');
  await seed(page, save);

  const before = await read(page);
  const root = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(root.width, root.height, before.settings.deckPosition, deal);
  const board = layout(before.attempt.board, deal, frame, before.settings.deckSide, before.settings.deckPosition);
  const point = ({ x, y }: { x: number; y: number }) => ({ x: root.x + frame.offsetX + x * frame.unit, y: root.y + y * frame.unit });
  const source = point(board.poses.find(p => p.id === sourceCards(before.attempt.board, command.from, deal).at(-1))!);
  const target = point(board.targets.find(t => t.location.kind === command.to.kind && t.location.index === command.to.index)!);

  await page.touchscreen.tap(source.x, source.y);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [target] });
    for (const fraction of [.25, .5, .75, 1]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
        x: target.x, y: target.y + fraction * (root.y + root.height - 15 - target.y),
      }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await cdp.detach(); }

  await page.waitForTimeout(400);
  expect(await read(page), 'Lifting the finger away from a selected target preserves the save').toEqual(before);
  await move(page, deal, command);
  expect((await read(page)).attempt.board).toEqual(dispatch(before, command, deal).next.attempt.board);
});

test('reduced motion shows the result without the normal-motion wait', async ({ page }) => {
  const deal = campaignDeals[0];
  const save = fixture(0, true);
  save.settings.reducedMotion = true;
  await page.addInitScript(() => {
    const trace: { committed?: number; opened?: number } = {};
    Object.defineProperty(window, '__reducedVictoryTrace', { value: trace });
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      setItem.call(this, key, value);
      if (key === 'asoc-solitaire.save.v1' && JSON.parse(value).attempt.board.phase === 'won') trace.committed ??= performance.now();
    };
    const showModal = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      if (this.id === 'result') trace.opened ??= performance.now();
      return showModal.call(this);
    };
  });
  await seed(page, save);

  const before = await read(page);
  const cmd = deal.winningPath.at(-1)!;
  await move(page, deal, cmd);
  await expect(page.locator('#result')).toBeVisible();
  const trace = await page.evaluate(() => (window as unknown as { __reducedVictoryTrace: { committed: number; opened: number } }).__reducedVictoryTrace);
  expect(trace.opened - trace.committed, 'Time from durable victory to the result panel').toBeLessThan(650);
  const paid = await read(page);
  expect(paid.attempt.board).toEqual(dispatch(before, cmd, deal).next.attempt.board);
  await page.locator('#next-level').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', campaignDeals[1].id);
  expect((await read(page)).profile).toEqual(paid.profile);
});
