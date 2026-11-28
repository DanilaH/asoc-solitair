import { expect, test, type Page } from '@playwright/test';
import { findDeal, layoutFingerprint } from '../../src/content/campaign';
import { LIVES_RULES } from '../../src/domain/campaign-lives';
import { applyBoard, freshSave, sourceCards } from '../../src/domain/engine';
import type { BoardCommand, Deal } from '../../src/domain/types';
import { boardFrame, cardMetrics, layout } from '../../src/game/layout';
import { read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1' || process.env.VITE_HITAPPS_FIXTURES === '1',
  'Requires the ordinary campaign build');
const record = process.env.ASOC_CORE_RECORD === '1';
if (record) test.use({ video: 'on' });

async function ready(page: Page) {
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
  await page.waitForTimeout(400);
}

async function touch(page: Page, deal: Deal, action: BoardCommand) {
  const save = await read(page), rect = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(rect.width, rect.height, save.settings.deckPosition, deal);
  const { board } = save.attempt;
  const grid = layout(board, deal, frame, save.settings.deckSide, save.settings.deckPosition);
  const tap = (x: number, y: number) => page.touchscreen.tap(rect.x + frame.offsetX + x * frame.unit, rect.y + y * frame.unit);
  if (action.type !== 'transfer') return tap(grid.stock.x, grid.stock.y);
  const cards = sourceCards(board, action.from, deal, action.root);
  const source = grid.poses.find(pose => pose.id === cards[0])!;
  const below = grid.poses.filter(pose => pose.id !== source.id && pose.depth > source.depth && Math.abs(pose.x-source.x)<1 && pose.y>=source.y && pose.y-source.y<cardMetrics(deal).height).sort((a,b)=>a.y-b.y)[0];
  const y = below ? (source.y + below.y) / 2 - cardMetrics(deal).height / 2 : source.y;
  const target = grid.targets.find(target => target.location.kind === action.to.kind && target.location.index === action.to.index)!;
  await tap(source.x, y);
  await tap(target.x, target.y);
}

async function play(page: Page, deal: Deal, actions: readonly BoardCommand[]) {
  for (const action of actions) {
    const current = (await read(page)).attempt.board;
    const expected = applyBoard(current, action, deal);
    if (typeof expected === 'string') throw Error(expected);
    await touch(page, deal, action);
    await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected.board);
    await page.waitForTimeout(action.type === 'transfer' ? 250 : 370);
  }
}

async function dealOnScreen(page: Page, level: number) {
  await ready(page);
  await expect(page.locator('#level-number')).toHaveText('УРОВЕНЬ ' + level);
  const save = await read(page);
  expect(save.attempt.board.rulesVersion).toBe(4);
  expect(save.attempt.issuance?.policy).toBe('campaign-core-stage1-v1');
  const deal = findDeal(save.attempt.dealId)!;
  expect(Object.values(deal.cards).some(card => card.image)).toBe(true);
  return deal;
}

test('cold start through L6, with real touch, short lessons and a new L6 layout', async ({ page }, info) => {
  test.setTimeout(420_000);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#level-picker-open')).toBeHidden();
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  for (let level = 1; level <= 6; level++) {
    const deal = await dealOnScreen(page, level);
    if (record) await page.screenshot({ path: info.outputPath(`L${level}-first.png`), scale: 'css' });
    if (level === 3) {
      await expect(page.locator('#hint')).toHaveClass(/attention/);
      await page.locator('#hint').tap();
      await expect.poll(async () => (await read(page)).attempt.lessonHint).toBeDefined();
      expect((await read(page)).attempt.lessonHint).toEqual(deal.winningPath[0]);
    }
    if (level === 4) {
      await play(page, deal, deal.winningPath.slice(0, 1));
      await expect(page.locator('#undo')).toHaveClass(/attention/);
      await page.locator('#undo').tap();
      await expect.poll(async () => (await read(page)).attempt.board).toEqual(deal.initial);
    }
    if (level === 6) {
      for (const kind of ['foundation', 'tableau'])
        await expect(page.locator('#bonus-' + kind)).toBeVisible();
      const initial = await read(page);
      await play(page, deal, deal.winningPath.slice(0, 3));
      const moved = (await read(page)).attempt;
      await page.reload();
      await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
      expect((await read(page)).attempt.board).toEqual(moved.board);
      if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
      await ready(page);
      await play(page, deal, deal.winningPath.slice(3));
      await expect(page.locator('#result')).toBeVisible();
      expect((await read(page)).campaignLives?.remaining).toBe(initial.campaignLives?.remaining);
      break;
    }
    await play(page, deal, deal.winningPath);
    await expect(page.locator('#result')).toBeVisible();
    const next = page.locator('#result[open] #next-level');
    await next.tap();
    if (await next.isVisible() && await page.locator('#result').getAttribute('data-reward-phase') === 'claimed') await next.tap();
  }
});

test('L6 voluntary restart creates a second playable board without losing a life', async ({ page }, info) => {
  test.setTimeout(180_000);
  const base = findDeal('campaign-c8-dealer-006-bonus-r2')!;
  // Begin with the old untouched L6 so this also proves the explicit save upgrade path.
  const save = freshSave(base, 'historical-l6-stage1');
  save.contentVersion = 8;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 5 }, (_, i) => 'campaign-00' + (i + 1)) };
  await page.addInitScript(value => {
    const key = 'asoc-solitaire.save.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, save);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await ready(page);
  if (record) await page.screenshot({ path: info.outputPath('L6-archive.png'), scale: 'css' });
  const before = await read(page);
  expect(before.attempt.board.rulesVersion).toBe(3);
  await page.locator('#menu').tap();
  await page.locator('#restart').tap();
  await page.locator('#restart-confirm-yes').tap();
  const first = await dealOnScreen(page, 6);
  if (record) await page.screenshot({ path: info.outputPath('L6-restart-1.png'), scale: 'css' });
  await play(page, first, first.winningPath.slice(0, 6));
  await page.locator('#menu').tap();
  await page.locator('#restart').tap();
  await page.locator('#restart-confirm-yes').tap();
  const next = await dealOnScreen(page, 6);
  expect(layoutFingerprint(next)).not.toBe(layoutFingerprint(first));
  if (record) await page.screenshot({ path: info.outputPath('L6-restart-2.png'), scale: 'css' });
  await play(page, next, next.winningPath);
  await expect(page.locator('#result')).toBeVisible();
  expect((await read(page)).campaignLives?.remaining).toBe(before.campaignLives?.remaining ?? LIVES_RULES.max);
});
