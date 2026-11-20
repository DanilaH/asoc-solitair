import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect, type Page } from '@playwright/test';
import { preview } from 'vite';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import { applyBoard, freshSave, sourceCards } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';

const root = '.recording/followup19', port = 4311;
const server = await preview({ build: { outDir: root + '/dist' }, preview: { host: '127.0.0.1', port, strictPort: true } });
await mkdir(root + '/proof', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: `http://127.0.0.1:${port}`, viewport: { width: 320, height: 480 }, deviceScaleFactor: 1,
  isMobile: true, hasTouch: true, reducedMotion: 'reduce', recordVideo: { dir: root + '/proof', size: { width: 320, height: 480 } },
});
await context.addInitScript(() => {
  const durations: number[] = [];
  Object.assign(window, { cueDurationsPlayed: durations });
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function(when?: number, offset?: number, duration?: number) {
    start.call(this, when, offset, duration);
    if (this.buffer) durations.push(this.buffer.duration);
  };
});
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
const started = (page: Page) => page.locator('#app[data-ready=true]').waitFor();
const cueCount = (page: Page, length: number) => page.evaluate(length =>
  (window as unknown as { cueDurationsPlayed: number[] }).cueDurationsPlayed.filter(value => Math.abs(value - length) < .001).length, length);

async function input(page: Page, deal: Deal, command: BoardCommand) {
  const save = await read(page), root = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(root.width, root.height, save.settings.deckPosition, deal);
  const geometry = layout(save.attempt.board, deal, frame.height, save.settings.deckSide, save.settings.deckPosition);
  const tap = ({ x, y }: { x: number; y: number }) => page.touchscreen.tap(root.x + frame.offsetX + x * frame.unit, root.y + y * frame.unit);
  if (command.type !== 'transfer') return tap(geometry.stock);
  const id = sourceCards(save.attempt.board, command.from, deal).at(-1);
  await tap(geometry.poses.find(pose => pose.id === id)!);
  await page.waitForTimeout(45);
  await tap(geometry.targets.find(t => t.location.kind === command.to.kind && t.location.index === command.to.index)!);
}

try {
  const page = await context.newPage();
  await page.goto('/');
  await started(page);
  const first = content8Dealer[0], before = await read(page), note = page.locator('#lesson-note');
  await expect(note).toBeVisible();
  await expect(note.locator('button')).toHaveCount(0);
  assert.equal(await note.locator('p').evaluate(e => getComputedStyle(e).fontSize), '16px');
  await expect(page.locator('#game-root')).toHaveAttribute('data-stock-count', '5');
  await input(page, first, { type: 'draw' });
  await page.waitForTimeout(550);
  assert.deepEqual((await read(page)).attempt.board, before.attempt.board);
  await expect(note).toBeVisible();
  await expect.poll(() => cueCount(page, .37)).toBe(1);
  await page.screenshot({ path: root + '/proof/opening-320.png' });
  for (const command of first.winningPath) {
    const previous = (await read(page)).attempt.board;
    const expected = applyBoard(previous, command, first);
    assert(typeof expected !== 'string');
    await input(page, first, command);
    await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected.board);
  }
  await page.locator('#result[open]').waitFor();
  await expect.poll(() => cueCount(page, .63)).toBeGreaterThan(0);
  await page.locator('#next-level').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', content8Dealer[1].id);
  await expect.poll(() => cueCount(page, .37)).toBe(2);
  await page.locator('#menu').tap();
  await page.locator('#settings-done').tap();
  assert.equal(await cueCount(page, .37), 2);

  const hintDeal = content8Dealer[2], older = freshSave(hintDeal, 'followup-hint');
  older.contentVersion = 8; older.settings.reducedMotion = true; older.settings.sfx = false;
  older.profile.hints = 0;
  older.campaign = { version: 1, tutorials: ['hint-demo'] };
  older.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: [campaignId(1), campaignId(2)] };
  await page.evaluate(save => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(save)), older);
  await page.reload(); await started(page); await page.locator('#home-play').tap();
  await input(page, hintDeal, { type: 'draw' });
  assert.deepEqual((await read(page)).attempt.board, older.attempt.board);
  await page.locator('#hint').tap();
  const shown = hintDeal.winningPath[0];
  await expect.poll(async () => (await read(page)).attempt.lessonHint).toEqual(shown);
  await expect(note).toContainText('Сделайте показанный перенос');
  await page.reload(); await started(page); await page.locator('#home-play').tap();
  await expect(note).toContainText('Сделайте показанный перенос');
  await input(page, hintDeal, shown);
  await expect.poll(async () => (await read(page)).campaign?.tutorials.includes('hint-practiced')).toBe(true);
  await expect(note).toBeHidden();
  assert.equal((await read(page)).profile.hints, 0);
  assert.equal(await cueCount(page, .37), 0);
  assert.equal(await cueCount(page, .63), 0);
  const dense = content8Dealer[5], large = freshSave(dense, 'followup-stock');
  large.contentVersion = 8;
  large.settings = { ...older.settings, deckSide: 'left', deckPosition: 'bottom' };
  await page.evaluate(save => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(save)), large);
  await page.reload(); await started(page); await page.locator('#home-play').tap();
  await expect(page.locator('#game-root')).toHaveAttribute('data-stock-count', '56');
  await page.screenshot({ path: root + '/proof/stock-56-320.png' });
  await input(page, dense, { type: 'draw' });
  await expect(page.locator('#game-root')).toHaveAttribute('data-stock-count', '55');

  const video = page.video();
  await page.close();
  await video?.saveAs(root + '/proof/touch.webm');
  console.log('PASS 320×480: mandatory action, reload, stock label, new-deal and coin samples, mute');
} finally {
  await context.close(); await browser.close(); server.httpServer.close();
}
