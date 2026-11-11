import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { campaignDeals } from '../../src/content/campaign';
import { freshSave, packet } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import type { Save } from '../../src/domain/types';
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
// A positive control from actual painted pixels, rather than a runtime debug flag.
async function handPixels(page: Page) {
  const png = await page.locator('canvas').screenshot({ scale: 'css' });
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let i = 0; i < data.length; i += info.channels) if (Math.abs(data[i] - 167) + Math.abs(data[i + 1] - 161) + Math.abs(data[i + 2] - 212) < 4) count++;
  return count;
}
async function open(page: Page, reduced = false) {
  await page.goto('/'); await page.locator('#app[data-ready=true]').waitFor();
  if (reduced) {
    const save = freshSave(campaignDeals[0], 'static-teaching'); save.settings.reducedMotion = true;
    await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
    await page.reload(); await page.locator('#app[data-ready=true]').waitFor();
  }
  await page.locator('#home-play').tap();
}
test('painted tutorial follows accepted moves, yields to reading and returns after pause without spending resources', async ({ page }) => {
  await open(page); const before = await read(page), deal = campaignDeals[0];
  await expect(page.locator('#message')).toBeEmpty(); await expect(page.locator('#home-status')).toHaveCount(0);
  await expect.poll(() => handPixels(page), { timeout: 7000 }).toBeGreaterThan(12);
  expect((await read(page)).attempt.board).toEqual(before.attempt.board); expect((await read(page)).profile).toEqual(before.profile);
  const rect = (await page.locator('canvas').boundingBox())!, f = boardFrame(rect.width, rect.height, before.settings.deckPosition, deal);
  const g = layout(before.attempt.board, deal, f.height, before.settings.deckSide, before.settings.deckPosition);
  const cmd = deal.winningPath[0]; if (cmd.type !== 'transfer') throw Error('First teaching action changed');
  const id = cmd.from.kind === 'waste' ? before.attempt.board.waste.at(-1) : packet(before.attempt.board, cmd.from.index, deal).at(-1);
  const from = g.poses.find(p => p.id === id)!, to = g.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!;
  await page.touchscreen.tap(rect.x + f.offsetX + from.x * f.unit, rect.y + from.y * f.unit);
  await page.touchscreen.tap(rect.x + f.offsetX + to.x * f.unit, rect.y + to.y * f.unit);
  await expect.poll(async () => (await read(page)).revision).toBeGreaterThan(before.revision);
  await expect.poll(() => handPixels(page)).toBeGreaterThan(12);
  await page.locator('#inspect').tap(); await expect.poll(() => handPixels(page)).toBeLessThanOrEqual(12);
  await page.locator('#inspect').tap(); await expect.poll(() => handPixels(page)).toBeGreaterThan(12);
  await page.locator('#menu').tap(); await page.locator('#settings-done').tap();
  await expect.poll(() => handPixels(page)).toBeGreaterThan(12);
  expect((await read(page)).profile).toEqual(before.profile);
});
test('reduced motion keeps a painted static teaching cue', async ({ page }) => {
  await open(page, true);
  await expect.poll(() => handPixels(page), { timeout: 7000 }).toBeGreaterThan(12);
  const first = await page.locator('canvas').screenshot({ scale: 'css' });
  await page.waitForTimeout(400);
  expect((await page.locator('canvas').screenshot({ scale: 'css' })).equals(first)).toBe(true);
  await expect(page.locator('#message')).toBeEmpty();
});
