import { expect, test } from '@playwright/test';
import { openIntro, resume } from './fixtures';
import type { Page } from '@playwright/test';
import { introDeal as deal } from '../../src/content/intro';
import { dispatch, packet } from '../../src/domain/engine';
import { recordLearning } from '../../src/app/tutorial';
import { boardFrame, layout } from '../../src/game/layout';
import type { BoardCommand, Save } from '../../src/domain/types';

const readSave = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function action(page: Page, cmd: BoardCommand, settle = true) {
  const save = await readSave(page);
  const rect = await page.locator('#game-root').boundingBox(); if (!rect) throw Error('No canvas');
  const frame = boardFrame(rect.width, rect.height, save.settings.deckPosition, deal);
  const metrics = layout(save.attempt.board, deal, frame.height, save.settings.deckSide, save.settings.deckPosition);
  const tap = async (point: { x: number; y: number }) => page.touchscreen.tap(rect.x + frame.offsetX + point.x * frame.unit, rect.y + point.y * frame.unit);
  if (cmd.type === 'transfer') {
    const id = cmd.from.kind === 'waste' ? save.attempt.board.waste.at(-1) : packet(save.attempt.board, cmd.from.index, deal).at(-1);
    const from = metrics.poses.find(p => p.id === id)!;
    const to = metrics.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!;
    await tap(from); await tap(to);
  } else await tap(metrics.stock);
  await expect.poll(async () => (await readSave(page)).revision).toBeGreaterThan(save.revision);
  if (settle) await page.waitForTimeout(250);
}

test.beforeEach(async ({ page }) => {
  await openIntro(page); await page.waitForTimeout(700);
});

test('real touch play wins, reload keeps the result and wallet, replay keeps the deal', async ({ page }) => {
  // A 21-move journey plus reload/replay has many real browser round trips.
  // Keep per-step polling assertions strict; the total is not an FPS budget.
  test.setTimeout(60000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.screenshot({ path: `test-results/${test.info().project.name}-opening.png` });
  for (const cmd of deal.winningPath) await action(page, cmd);
  await expect(page.locator('#result')).toBeVisible(); await expect(page.locator('#result-title')).toHaveText('Всё сошлось!');
  const won = await readSave(page); expect(won.attempt.board.phase).toBe('won'); expect(won.attempt.board.movesLeft).toBe(11);
  await page.screenshot({ path: `test-results/${test.info().project.name}-result.png` });
  await resume(page); await expect(page.locator('#result')).toBeVisible();
  expect((await readSave(page)).profile.coins).toBe(won.profile.coins);
  await page.locator('#replay').tap();
  expect((await readSave(page)).attempt.board).toEqual(deal.initial);
  expect((await readSave(page)).profile.coins).toBe(won.profile.coins);
  expect(errors).toEqual([]);
});

test('hint is a demonstration, only charged once; Undo survives reload', async ({ page }) => {
  const before = await readSave(page);
  await page.locator('#hint').tap(); await expect(page.locator('#hint-count')).toHaveText('2');
  expect((await readSave(page)).attempt.board).toEqual(before.attempt.board);
  await page.waitForTimeout(1900); expect((await readSave(page)).profile.hints).toBe(2);
  await page.locator('#hint').tap(); expect((await readSave(page)).profile.hints).toBe(2);
  await action(page, deal.winningPath[0]); await page.locator('#undo').tap();
  expect((await readSave(page)).attempt.board).toEqual(before.attempt.board);
  await resume(page);
  expect((await readSave(page)).profile.undos).toBe(4); expect((await readSave(page)).profile.hints).toBe(2);
});

test('next move works while coins fly, invalid drop resets progress without spending a move', async ({ page }) => {
  for (const cmd of deal.winningPath.slice(0, 3)) await action(page, cmd);
  await action(page, deal.winningPath[3], false);
  await action(page, deal.winningPath[4], false);
  const save = await readSave(page); expect(save.attempt.streak.tier).toBe(1); expect(save.profile.coins).toBe(102);
  await resume(page); await page.waitForTimeout(300);
  await action(page, { type: 'transfer', from: { kind: 'tableau', index: 2 }, to: { kind: 'foundation', index: 0 } });
  const after = await readSave(page); expect(after.attempt.board.movesLeft).toBe(save.attempt.board.movesLeft);
  expect(after.attempt.streak.progress).toBe(0); await expect(page.locator('#message')).toHaveClass('error');
});

test('pointer cancellation restores the card without a command or charge', async ({ page }) => {
  const before = await readSave(page), rect = await page.locator('#game-root').boundingBox(); if (!rect) throw Error('No canvas');
  const x = rect.x + 95 * rect.width / 540, y = rect.y + 495 * rect.width / 540;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y - 80, { steps: 5 });
  await page.locator('canvas').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true }); await page.mouse.up();
  expect((await readSave(page)).attempt.board).toEqual(before.attempt.board); expect((await readSave(page)).attempt.streak).toEqual(before.attempt.streak);
  expect((await page.locator('#dock').boundingBox())!.y).toBeGreaterThan(rect.y + rect.height);
});

test('dragging a whole packet performs one move and Undo restores its members', async ({ page }) => {
  // Set up the legal mid-deal position without spending this focused test's
  // deadline replaying fourteen unrelated UI commands. The full touch journey
  // above separately covers that prefix; the packet drag and Undo remain real.
  let prepared = await readSave(page);
  for (const cmd of deal.winningPath.slice(0, 14)) {
    const result = dispatch(prepared, cmd, deal); expect(result.accepted).toBe(true);
    recordLearning(result.next, prepared.attempt.board, cmd, deal); prepared = result.next;
  }
  await page.evaluate(save => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(save)), prepared);
  await resume(page); await page.waitForTimeout(300);
  const before = await readSave(page), rect = await page.locator('#game-root').boundingBox(); if (!rect) throw Error('No canvas');
  expect(before.attempt.board).toEqual(prepared.attempt.board);
  expect(packet(before.attempt.board, 2, deal)).toEqual(['tool2', 'tool1', 'tool']);
  const metrics = layout(before.attempt.board, deal, rect.height * 540 / rect.width);
  const from = metrics.poses.find(p => p.id === packet(before.attempt.board, 2, deal).at(-1))!;
  const to = metrics.targets.find(t => t.location.kind === 'foundation' && t.location.index === 0)!;
  const x = (v: number) => rect.x + v * rect.width / 540, y = (v: number) => rect.y + v * rect.width / 540;
  await page.mouse.move(x(from.x), y(from.y)); await page.mouse.down();
  await page.mouse.move(x(to.x), y(to.y), { steps: 12 }); await page.mouse.up();
  await expect.poll(async () => (await readSave(page)).revision).toBeGreaterThan(before.revision);
  const after = await readSave(page);
  expect(after.attempt.board.foundations[0]).toHaveLength(3);
  expect(after.attempt.board.movesLeft).toBe(before.attempt.board.movesLeft! - 1);
  await page.locator('#undo').tap(); expect((await readSave(page)).attempt.board).toEqual(before.attempt.board);
});

test('the last hint remains replayable at zero charges', async ({ page }) => {
  // Fault/boundary fixture is injected by the test; there is no release debug bridge.
  await page.evaluate(() => {
    const key = 'asoc-solitaire.save.v1'; const save = JSON.parse(localStorage.getItem(key)!);
    save.profile.hints = 1; localStorage.setItem(key, JSON.stringify(save));
  });
  await resume(page);
  await page.locator('#hint').tap(); await expect(page.locator('#hint-count')).toHaveText('0');
  await expect(page.locator('#hint')).toBeEnabled(); await page.locator('#hint').tap();
  expect((await readSave(page)).profile.hints).toBe(0);
});
