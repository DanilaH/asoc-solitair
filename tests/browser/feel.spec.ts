import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, freshSave, packet } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import type { BoardCommand, Save } from '../../src/domain/types';
const deal = campaignDeals[0];
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function enter(page: Page, reduced: boolean) {
  await page.goto('/'); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const save = freshSave(deal, 'feel-top-layer'); save.settings.reducedMotion = reduced;
  await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true'); await page.locator('#home-play').tap(); await page.waitForTimeout(350);
}
async function move(page: Page, cmd: BoardCommand) {
  const save = await read(page), rect = (await page.locator('#game-root').boundingBox())!, frame = boardFrame(rect.width, rect.height, save.settings.deckPosition, deal);
  const g = layout(save.attempt.board, deal, frame.height, save.settings.deckSide, save.settings.deckPosition);
  const tap = (p: { x: number; y: number }) => page.touchscreen.tap(rect.x + frame.offsetX + p.x * frame.unit, rect.y + p.y * frame.unit);
  if (cmd.type === 'transfer') {
    const id = cmd.from.kind === 'waste' ? save.attempt.board.waste.at(-1) : packet(save.attempt.board, cmd.from.index, deal).at(-1);
    await tap(g.poses.find(p => p.id === id)!); await tap(g.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!);
  } else await tap(g.stock);
  await expect.poll(async () => (await read(page)).revision).toBeGreaterThan(save.revision);
  await page.waitForTimeout(240);
}
test('result reward coins remain visible in the dialog top layer, Next restores the layer without another award', async ({ page }) => {
  await enter(page, false);
  for (const cmd of deal.winningPath) await move(page, cmd);
  await expect(page.locator('#result')).toBeVisible();
  await expect.poll(() => page.locator('#result #coin-layer .flying-coin:visible').count()).toBeGreaterThan(0);
  const won = await read(page);
  expect(won.attempt.board.phase).toBe('won');
  await page.locator('#next-level').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', campaignDeals[1].id);
  await expect(page.locator('body > #coin-layer')).toHaveCount(1);
  expect((await read(page)).profile.coins).toBe(won.profile.coins);
});
test('reduced motion reaches the same result without coin flights or menu animation', async ({ page }) => {
  await enter(page, true);
  await expect(page.locator('html')).toHaveAttribute('data-reduced', 'true');
  await page.locator('#menu').tap();
  expect(await page.locator('#settings').evaluate(e => getComputedStyle(e).animationName)).toBe('none');
  await page.locator('#settings-done').tap();
  for (const cmd of deal.winningPath) await move(page, cmd);
  await expect(page.locator('#result')).toBeVisible(); await page.waitForTimeout(300);
  expect(await page.locator('.flying-coin:visible').count()).toBe(0);
  expect((await read(page)).attempt.board.phase).toBe('won');
});

test('touch drag survives entry and unchanged backing-size notifications', async ({ page }) => {
  await enter(page, false);
  await page.screenshot({ path: test.info().outputPath('before-drag.png') });
  const cdp = await page.context().newCDPSession(page);
  for (const [index, cmd] of deal.winningPath.slice(0, 2).entries()) {
    if (cmd.type !== 'transfer') throw Error('Expected teaching transfers');
    const before = await read(page), rect = (await page.locator('#game-root').boundingBox())!, f = boardFrame(rect.width, rect.height, before.settings.deckPosition, deal);
    const g = layout(before.attempt.board, deal, f.height, before.settings.deckSide, before.settings.deckPosition);
    const source = g.poses.find(p => p.id === packet(before.attempt.board, cmd.from.index, deal).at(-1))!, target = g.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!;
    const point = (p: { x: number; y: number }) => ({ x: rect.x + f.offsetX + p.x * f.unit, y: rect.y + p.y * f.unit });
    const a = point(source), b = point(target);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    for (let step = 1; step <= 10; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * step / 10, y: a.y + (b.y - a.y) * step / 10 }] });
      if (index === 1 && step === 5) await page.locator('#game-root').evaluate(e => { e.style.paddingTop = '.01px'; });
      await page.waitForTimeout(25);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await read(page)).attempt.board.foundations[index].length).toBe(1);
    await page.waitForTimeout(250);
  }
  await cdp.detach();
});

test('category praise has a reserved row outside cards and helpers and clears under pause', async ({ page }) => {
  await enter(page, false);
  // Capture inside the browser when praise appears: a slow host must not read
  // zero bounds after the 900ms animation has already hidden the element.
  await page.evaluate(() => {
    const praise = document.querySelector<HTMLElement>('#praise')!, row = document.querySelector<HTMLElement>('#feedback-row')!;
    const observer = new MutationObserver(() => {
      if (praise.hidden) return;
      const animation = praise.getAnimations()[0];
      if (!animation) throw Error('Praise must have its production animation');
      animation.pause();
      const b = (s: string) => { const r = document.querySelector(s)!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
      const frames = [0, 100, 450, 850].map(time => {
        animation.currentTime = time;
        return { time, cards: b('#game-root'), praise: b('#praise'), helpers: b('#dock'), guidance: getComputedStyle(document.querySelector('#message')!).visibility };
      });
      animation.currentTime = 450;
      row.dataset.qaPraise = JSON.stringify(frames);
      observer.disconnect();
    });
    observer.observe(praise, { attributes: true, attributeFilter: ['hidden'] });
  });
  for (const cmd of deal.winningPath) {
    const completing = dispatch(await read(page), cmd, deal).events.some(event => event.type === 'complete');
    await move(page, cmd);
    if (completing) break;
  }
  await expect(page.locator('#praise')).toBeVisible();
  await expect(page.locator('#feedback-row')).toHaveAttribute('data-qa-praise', /./);
  const frames = await page.locator('#feedback-row').evaluate(e => JSON.parse((e as HTMLElement).dataset.qaPraise!) as Array<{
    time: number; cards: { bottom: number }; praise: { top: number; bottom: number }; helpers: { top: number }; guidance: string;
  }>);
  expect(frames.map(frame => frame.time)).toEqual([0, 100, 450, 850]);
  for (const rects of frames) {
    expect(rects.praise.top).toBeGreaterThanOrEqual(rects.cards.bottom - 1);
    expect(rects.praise.bottom).toBeLessThanOrEqual(rects.helpers.top + 1);
    expect(rects.guidance).toBe('hidden');
  }
  const before = await read(page); await page.locator('#menu').tap();
  await expect(page.locator('#praise')).toBeHidden(); await page.locator('#settings-done').tap();
  expect((await read(page)).attempt.board).toEqual(before.attempt.board);
  expect(await page.locator('#message').evaluate(e => getComputedStyle(e).visibility)).toBe('hidden');
});

test('home appearance button stays under a held finger and opens reliably', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/'); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const returning = freshSave(campaignDeals[1], 'returning-home'); returning.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: [campaignDeals[0].id] };
  await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), returning); await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const before = (await page.locator('#looks-open').boundingBox())!;
  const cdp = await page.context().newCDPSession(page), point = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(160);
  const pressed = (await page.locator('#looks-open').boundingBox())!;
  expect(Math.abs(pressed.y - before.y)).toBeLessThan(4);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach(); await expect(page.locator('#appearance')).toBeVisible();
});
