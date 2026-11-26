import { expect, test, type Page } from '@playwright/test';
import { campaignDeals, hitappsR4Deals } from '../../src/content/campaign';
import { freshSave, sourceCards } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';
import { read } from './wallet-fixture';

test.skip(process.env.VITE_HITAPPS_SOURCE_QA !== '1', 'Requires the signed-candidate browser profile');

function profile(deal: Deal, id: string) {
  const save = freshSave(deal, id);
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.campaign = { version: 1, tutorials: ['intro:ordered', 'intro:keys', 'intro:joker'] };
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0,
    completedCampaign: Array.from({ length: 32 }, (_, index) => campaignId(index + 1)) };
  return save;
}
async function launch(page: Page, save: Save) {
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value));
  }, save);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
}

async function touch(page: Page, deal: Deal, command: BoardCommand) {
  const save = await read(page), { board } = save.attempt;
  const game = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(game.width, game.height, save.settings.deckPosition, deal);
  const tiles = layout(board, deal, frame, save.settings.deckSide, save.settings.deckPosition);
  const tap = ({ x, y }: {x:number;y:number}) => page.touchscreen.tap(game.x + frame.offsetX + x * frame.unit, game.y + y * frame.unit);
  if (command.type !== 'transfer') await tap(tiles.stock);
  else {
    const ids = sourceCards(board, command.from, deal, command.root), id = ids[0];
    const origin = tiles.poses.find(tile => tile.id === id)!;
    const next = tiles.poses.find(tile => tile.id === ids[1]);
    const point = next && next.y > origin.y ? { x: origin.x, y: origin.y - 83 + (next.y - origin.y) / 2 } : origin;
    await tap(point);
    await tap(tiles.targets.find(tile => tile.location.kind === command.to.kind && tile.location.index === command.to.index)!);
  }
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(board.movesLeft! - 1);
}

test('a signed-candidate deal restores the same layout and Undo across reload', async ({ page }, info) => {
  const entry = [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 &&
    row.deal.campaignLevel === 23 && row.deal.winningPath[0].type === 'draw') ??
    [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.winningPath[0].type === 'draw')!;
  const { deal } = entry;
  const save = profile(deal, 'hitapps-r4-restore-touch');
  await launch(page, save);
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
  await page.waitForTimeout(350);
  await touch(page, deal, deal.winningPath[0]);
  const moved = (await read(page)).attempt;
  expect(moved.board.rulesVersion).toBe(4);
  expect(moved.board.hitapps?.move).toBe(1);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  expect((await read(page)).attempt.board).toEqual(moved.board);
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(save.attempt.board);
  await page.screenshot({ path: info.outputPath('hitapps-r4-board.png'), scale: 'css' });
});

test('the candidate picker issues a certified special board through the campaign SaveStore', async ({ page }, info) => {
  const base = campaignDeals.find(deal => deal.campaignLevel === 18)!;
  await launch(page, profile(base, 'hitapps-old-rule-save'));
  await page.locator('#level-picker-open').tap();
  const fixture = page.locator('#source-deal-list').getByRole('button', { name: '18 · Замок и ключи' }).first();
  await expect(fixture).toBeEnabled();
  await fixture.tap();
  await expect.poll(async () => (await read(page)).attempt.board.rulesVersion).toBe(4);
  const after = (await read(page)).attempt;
  expect(after.issuance).toMatchObject({ policy: 'hitapps-r4-bank-v1', dealId: after.dealId, source: 'certified-seed' });
  expect(Object.values(after.board.hitapps!.cards).some(card => card.lock?.type === 1)).toBe(true);
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', after.dealId);
  await page.screenshot({ path: info.outputPath('hitapps-r4-locker.png'), scale: 'css' });
});

test('the Rules4 retry replaces geometry and settles one life with the new passport', async ({ page }) => {
  const { deal } = [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.campaignLevel === 23)!;
  const save = profile(deal, 'hitapps-r4-exhausted-touch');
  save.attempt.board.phase = 'exhausted';
  save.attempt.board.movesLeft = 0;
  await launch(page, save);
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await expect(page.locator('#result')).toBeVisible();
  await page.locator('#replay').tap();
  await expect.poll(async () => (await read(page)).attempt.dealId).not.toBe(deal.id);
  const after = await read(page);
  expect(after.attempt.board.rulesVersion).toBe(4);
  expect([after.attempt.board.tableau, after.attempt.board.stock, after.attempt.board.faceUp])
    .not.toEqual([deal.initial.tableau, deal.initial.stock, deal.initial.faceUp]);
  expect(after.attempt.issuance?.dealId).toBe(after.attempt.dealId);
  expect(after.campaignLives?.remaining).toBe(4);
});

test('the last Rules4 layout falls back to a different archived deal on an ordinary retry', async ({ page }) => {
  const entries = [...hitappsR4Deals()].filter(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.campaignLevel === 31);
  expect(entries).toHaveLength(1);
  const { deal } = entries[0];
  const save = profile(deal, 'hitapps-r4-fallback-touch');
  save.attempt.board.phase = 'exhausted';
  save.attempt.board.movesLeft = 0;
  await launch(page, save);
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await expect(page.locator('#result')).toBeVisible();
  await page.locator('#replay').tap();
  await expect.poll(async () => (await read(page)).attempt.dealId).not.toBe(deal.id);
  const after = await read(page);
  expect(after.attempt.board.rulesVersion).toBe(3);
  expect(after.attempt.board.tableau).not.toEqual(deal.initial.tableau);
  expect(after.attempt.issuance?.dealId).toBe(after.attempt.dealId);
  expect(after.campaignLives?.remaining).toBe(4);
});
