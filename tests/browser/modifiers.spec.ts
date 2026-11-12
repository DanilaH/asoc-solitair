import { dismissTeaching } from '../../tools/qa/navigation';
import { expect, test, type Page } from '@playwright/test';
import { modifierDeals } from '../../src/content/modifiers';
import { campaignDeals } from '../../src/content/campaign';
import { freshSave, packet } from '../../src/domain/engine';
import { layout, boardFrame } from '../../src/game/layout';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function open(page: Page, deal: Deal) {
  await page.goto('/'); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const save = freshSave(deal, 'modifier-browser'); save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0, completedCampaign: campaignDeals.slice(0, deal.campaignLevel! - 1).map(d => d.id) };
  await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
  await resume(page);
}
async function resume(page: Page) {
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap(); await expect(page.locator('#play-screen')).toBeVisible(); await dismissTeaching(page);
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => r())));
}
async function geometry(page: Page, deal: Deal) {
  const save = await read(page), rect = (await page.locator('#game-root').boundingBox())!, frame = boardFrame(rect.width, rect.height);
  const geo = layout(save.attempt.board, deal, frame.height);
  const tap = (p: { x: number; y: number }) => page.touchscreen.tap(rect.x + frame.offsetX + p.x * frame.unit, rect.y + p.y * frame.unit);
  return { save, geo, tap };
}
async function move(page: Page, deal: Deal, command: BoardCommand, valid = true) {
  const { save, geo, tap } = await geometry(page, deal);
  if (command.type === 'transfer') {
    const id = command.from.kind === 'waste' ? save.attempt.board.waste.at(-1) : packet(save.attempt.board, command.from.index, deal).at(-1);
    await tap(geo.poses.find(p => p.id === id)!);
    await tap(geo.targets.find(t => t.location.kind === command.to.kind && t.location.index === command.to.index)!);
  } else await tap(geo.stock);
  if (valid) await expect.poll(async () => (await read(page)).revision).toBeGreaterThan(save.revision);
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => r())));
}

test('all six modifier deals win through actual touch input without spending helpers', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (const deal of modifierDeals) {
    await open(page, deal);
    for (const command of deal.winningPath) await move(page, deal, command);
    await expect(page.locator('#result')).toBeVisible();
    const save = await read(page); expect(save.attempt.board.phase).toBe('won'); expect(save.profile.jokers).toBe(1);
    expect(save.profile.hints).toBe(3); expect(save.profile.undos).toBe(5);
  }
  expect(errors).toEqual([]);
});

test('Joker selection cancels freely, holds one group, survives reload and Undo spends only Undo', async ({ page }) => {
  const deal = modifierDeals[0]; await open(page, deal);
  const before = await read(page);
  await page.locator('#joker').tap(); await expect(page.locator('#joker')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#joker').tap(); expect((await read(page)).profile).toEqual(before.profile);
  await page.locator('#joker').tap(); const { geo, tap } = await geometry(page, deal);
  await tap(geo.targets.find(t => t.location.kind === 'tableau' && t.location.index === 0)!);
  await expect(page.locator('#joker-count')).toHaveText('0');
  expect((await read(page)).attempt.board.movesLeft).toBe(before.attempt.board.movesLeft);
  await move(page, deal, deal.tutorialPath![1] as BoardCommand);
  const held = await read(page); expect(held.attempt.board.joker).toEqual({ column: 0, boundary: 2 });
  await page.screenshot({ path: `test-results/${test.info().project.name}-joker-held.png` });
  await resume(page); expect((await read(page)).attempt.board).toEqual(held.attempt.board);
  await page.locator('#hint').tap(); await expect(page.locator('#hint')).toBeEnabled(); await expect(page.locator('#message')).toBeEmpty();
  for (const cmd of deal.tutorialPath!.slice(2, 6)) await move(page, deal, cmd as BoardCommand);
  expect((await read(page)).attempt.board.joker).toBeUndefined();
  await page.locator('#undo').tap(); await expect.poll(async () => (await read(page)).attempt.board.joker).toEqual({ column: 0, boundary: 2 });
  expect((await read(page)).profile.jokers).toBe(0); await expect(page.locator('#joker')).toBeDisabled();
});

test('ordered rejection names the missing rank and keeps the budget, then resumes after Undo', async ({ page }) => {
  const deal = modifierDeals[2]; await open(page, deal);
  await move(page, deal, deal.winningPath[0]); const before = await read(page);
  await move(page, deal, { type: 'transfer', from: { kind: 'tableau', index: 2 }, to: { kind: 'foundation', index: 0 } }, false);
  await expect(page.locator('#message')).toContainText('№1'); expect((await read(page)).attempt.board).toEqual(before.attempt.board);
  await move(page, deal, deal.winningPath[1]); const moved = await read(page);
  await page.screenshot({ path: `test-results/${test.info().project.name}-ordered.png` });
  await page.locator('#undo').tap(); await expect.poll(async () => (await read(page)).attempt.board).toEqual(before.attempt.board);
  await resume(page); await move(page, deal, deal.winningPath[1]); expect((await read(page)).attempt.board).toEqual(moved.attempt.board);
});

test('the third key opens the lock atomically; Undo and reload restore exactly two keys', async ({ page }) => {
  const deal = modifierDeals[4]; await open(page, deal);
  const first = await read(page), { geo, tap } = await geometry(page, deal);
  await tap(geo.poses.find(p => p.id === 'dishes')!); await tap(geo.targets.find(t => t.location.kind === 'tableau' && t.location.index === 3)!);
  await expect(page.locator('#message')).toContainText('три ключа'); expect((await read(page)).attempt.board).toEqual(first.attempt.board);
  for (const cmd of deal.winningPath.slice(0, 2)) await move(page, deal, cmd);
  const before = await read(page); expect(before.attempt.board.keys).toHaveLength(2);
  await page.screenshot({ path: `test-results/${test.info().project.name}-two-keys.png` });
  await move(page, deal, deal.winningPath[2]); expect((await read(page)).attempt.board.keys).toHaveLength(3);
  expect((await read(page)).attempt.board.faceUp).toContain('dishes_3');
  await page.locator('#undo').tap(); await expect.poll(async () => (await read(page)).attempt.board).toEqual(before.attempt.board);
  await resume(page); expect((await read(page)).attempt.board).toEqual(before.attempt.board);
  await move(page, deal, deal.winningPath[2]); expect((await read(page)).attempt.board.keys).toHaveLength(3);
});
