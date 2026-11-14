import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { campaignDeals } from '../../src/content/campaign';
import { freshSave, packet } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import type { Save } from '../../src/domain/types';
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function paint(page: Page) {
  const png = await page.locator('#game-root').screenshot({ scale: 'css' });
  return sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}
// Compare the actual light glove against the same board with teaching hidden.
// A neutral-light contrast mask excludes gold guide rings; it does not depend
// on an exact palette value from the retired SVG or a runtime debug flag.
async function handPixels(page: Page, reference: Awaited<ReturnType<typeof paint>>) {
  const { data, info } = await paint(page), rect = (await page.locator('#game-root').boundingBox())!;
  expect([info.width, info.height]).toEqual([reference.info.width, reference.info.height]);
  const controls = await page.locator('.deck-tools, #inspect').evaluateAll(es => es.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
  let count = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const x = i / info.channels % info.width + rect.x, y = Math.floor(i / info.channels / info.width) + rect.y;
    if (controls.some(c => x >= c.x - 2 && x <= c.x + c.width + 2 && y >= c.y - 2 && y <= c.y + c.height + 2)) continue;
    if (data[i] > 185 && data[i + 1] > 170 && data[i + 2] > 170 && Math.abs(data[i] - reference.data[i]) + Math.abs(data[i + 1] - reference.data[i + 1]) + Math.abs(data[i + 2] - reference.data[i + 2]) > 50) count++;
  }
  if (!count) {
    await sharp(data, { raw: info }).png().toFile(test.info().outputPath('mask-current.png'));
    await sharp(reference.data, { raw: reference.info }).png().toFile(test.info().outputPath('mask-reference.png'));
  }
  return count;
}
async function handReference(page: Page) {
  await page.locator('#inspect').tap(); await page.clock.runFor(300);
  const reference = await paint(page); await page.locator('#inspect').tap(); return reference;
}
async function open(page: Page, reduced = false) {
  await page.clock.install();
  // Optional negative control removes the real image at the network boundary,
  // so the visual assertions must fail without any scene/debug signal.
  if (process.env.ASOC_QA_HIDE_HAND === '1') await page.route('**/art/ui/tutorial-hand.webp', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48"/>' }));
  await page.goto('/'); await page.locator('#app[data-ready=true]').waitFor();
  if (reduced) {
    const save = freshSave(campaignDeals[0], 'static-teaching'); save.settings.reducedMotion = true;
    await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
    await page.reload(); await page.locator('#app[data-ready=true]').waitFor();
  }
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await page.waitForTimeout(350);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
}
async function visibleHand(page: Page, reference: Awaited<ReturnType<typeof paint>>) {
  // Advance the real Phaser/timer lifecycle into its visible gesture phase.
  // Wall-clock screenshot polling can repeatedly sample its fully faded rest.
  await page.clock.runFor(950);
  expect(await handPixels(page, reference)).toBeGreaterThan(12);
}
test('painted tutorial follows accepted moves, yields to reading and returns after pause without spending resources', async ({ page }) => {
  await open(page); const before = await read(page), deal = campaignDeals[0], reference = await handReference(page);
  await expect(page.locator('#message')).toBeEmpty(); await expect(page.locator('#home-status')).toHaveCount(0);
  await visibleHand(page, reference);
  expect((await read(page)).attempt.board).toEqual(before.attempt.board); expect((await read(page)).profile).toEqual(before.profile);
  await page.locator('#inspect').tap(); await page.clock.runFor(200); expect(await handPixels(page, reference)).toBeLessThanOrEqual(12);
  await page.locator('#inspect').tap(); await visibleHand(page, reference);
  await page.locator('#menu').tap(); await page.locator('#settings-done').tap();
  await visibleHand(page, reference);
  const rect = (await page.locator('#game-root').boundingBox())!, f = boardFrame(rect.width, rect.height, before.settings.deckPosition, deal);
  const g = layout(before.attempt.board, deal, f.height, before.settings.deckSide, before.settings.deckPosition);
  const cmd = deal.winningPath[0]; if (cmd.type !== 'transfer') throw Error('First teaching action changed');
  const id = cmd.from.kind === 'waste' ? before.attempt.board.waste.at(-1) : packet(before.attempt.board, cmd.from.index, deal).at(-1);
  const from = g.poses.find(p => p.id === id)!, to = g.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!;
  await page.touchscreen.tap(rect.x + f.offsetX + from.x * f.unit, rect.y + from.y * f.unit);
  await page.touchscreen.tap(rect.x + f.offsetX + to.x * f.unit, rect.y + to.y * f.unit);
  await expect.poll(async () => (await read(page)).revision).toBeGreaterThan(before.revision);
  expect((await read(page)).campaign!.tutorials).toContain('learn:category');
  expect((await read(page)).profile).toEqual(before.profile);
});
test('reduced motion keeps a painted static teaching cue', async ({ page }) => {
  await open(page, true);
  const reference = await handReference(page);
  await visibleHand(page, reference);
  const first = await page.locator('#game-root').screenshot({ scale: 'css' });
  await page.clock.runFor(400);
  expect((await page.locator('#game-root').screenshot({ scale: 'css' })).equals(first)).toBe(true);
  await expect(page.locator('#message')).toBeEmpty();
});
