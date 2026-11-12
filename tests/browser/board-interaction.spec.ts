import { expect, test, type Page, type BrowserContext, type CDPSession } from '@playwright/test';
import sharp from 'sharp';
import { campaignDeals } from '../../src/content/campaign';
import { introDeal } from '../../src/content/intro';
import { dispatch, freshSave, packet } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import type { Deal, Save } from '../../src/domain/types';
const read = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function seed(p: Page, d = campaignDeals[16], change?: (s: Save) => void) {
  await p.goto('/'); await p.locator('#app[data-ready=true]').waitFor();
  const s = freshSave(d, 'board-pointer-acceptance'); s.settings.reducedMotion = false; s.settings.sfx = false;
  s.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, Math.max(20, (d.campaignLevel ?? 1) - 1)).map(d => d.id) };
  s.campaign = { version: 1, tutorials: ['intro:joker', 'intro:ordered', 'intro:keys', 'learn:category', 'learn:match', 'learn:stock'] }; change?.(s);
  await p.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), s);
  await p.reload(); await p.locator('#app[data-ready=true]').waitFor(); await p.locator('#home-play').tap(); await p.waitForTimeout(400); return read(p);
}
async function geometry(p: Page, d: Deal) {
  const s = await read(p), r = (await p.locator('#game-root').boundingBox())!, f = boardFrame(r.width, r.height, s.settings.deckPosition, d), g = layout(s.attempt.board, d, f.height, s.settings.deckSide, s.settings.deckPosition);
  return { s, r, f, g, point: (v: { x: number; y: number }) => ({ x: r.x + f.offsetX + v.x * f.unit, y: r.y + v.y * f.unit }) };
}
async function moveTouch(c: CDPSession, from: { x: number; y: number }, to: { x: number; y: number }) {
  for (let i = 1; i <= 12; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 12, y: from.y + (to.y - from.y) * i / 12 }] }); await new Promise(r => setTimeout(r, 12)); }
}
async function touch(context: BrowserContext, p: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const c = await context.newCDPSession(p); await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] }); await moveTouch(c, from, to); return c;
}
for (const anchor of ['finger', 'card'] as const) test(`a legal transfer accepts the ${anchor} over its destination`, async ({ page, context }) => {
  const d = campaignDeals[0], before = await seed(page, d), { g, point } = await geometry(page, d), command = d.winningPath[0]; if (command.type !== 'transfer') throw Error('Expected transfer');
  const from = g.poses.find(p => p.id === packet(before.attempt.board, command.from.index, d).at(-1))!, target = g.targets.find(t => t.location.kind === command.to.kind && t.location.index === command.to.index)!;
  const a = point(from), b = point(target); if (anchor === 'card') b.y += 80;
  const c = await touch(context, page, a, b); await page.screenshot({ path: test.info().outputPath(`${anchor}-held.png`) }); await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await c.detach();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(dispatch(before, command, d).next.attempt.board);
  await page.locator('#menu').tap(); await page.locator('#settings-done').tap();
});

test('one captured touch crosses every former field edge, keeps the card visible and cancels without a turn', async ({ page, context }) => {
  const before = await seed(page), { g, point, r } = await geometry(page, campaignDeals[16]), a = point(g.poses.find(p => p.faceUp && p.depth >= 50)!);
  const viewport = page.viewportSize()!, baseline = await page.screenshot(), c = await context.newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] }); let previous = a;
  for (const [name, p] of [['left', { x: 2, y: r.y + r.height / 2 }], ['right', { x: viewport.width - 2, y: r.y + r.height / 2 }], ['top', { x: a.x, y: 4 }], ['bottom', { x: a.x, y: viewport.height - 4 }]] as const) {
    await moveTouch(c, previous, p); previous = p; await page.waitForTimeout(30); const buffer = await page.screenshot({ path: test.info().outputPath(`held-${name}.png`) });
    const pixels = await sharp(buffer).raw().toBuffer({ resolveWithObject: true }), base = await sharp(baseline).raw().toBuffer(); let added = 0;
    for (let y = 0; y < pixels.info.height; y++) for (let x = 0; x < pixels.info.width; x++) {
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) continue;
      const i = (y * pixels.info.width + x) * pixels.info.channels;
      if (pixels.data[i] > 225 && pixels.data[i + 1] > 200 && pixels.data[i + 2] > 160 && Math.abs(pixels.data[i] - base[i]) + Math.abs(pixels.data[i + 1] - base[i + 1]) > 55) added++;
    }
    expect(added, `Card remains painted beyond ${name} field edge`).toBeGreaterThan(35);
  }
  await c.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await c.detach();
  expect((await read(page)).attempt).toEqual(before.attempt); expect((await read(page)).profile).toEqual(before.profile);
});

test('drag to Aa previews locally and returns the original cards with no command, charge or modal', async ({ page, context }) => {
  const d = campaignDeals[0], before = await seed(page, d), { g, point } = await geometry(page, d), source = g.poses.find(p => p.id === 'fruit')!, zone = (await page.locator('#inspect').boundingBox())!;
  const c = await touch(context, page, point(source), { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 });
  await expect(page.locator('#inspect-peek')).toBeVisible(); await expect(page.locator('#peek-title')).toHaveText('Фрукты');
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await c.detach();
  await expect(page.locator('#inspect-peek')).toBeVisible(); await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await read(page)).toEqual(before); await page.screenshot({ path: test.info().outputPath('inspection.png') });
});

test('draw fans three previous cards and recycle preserves exact order, including reduced motion', async ({ page }) => {
  for (const reduced of [false, true]) {
    const before = await seed(page, introDeal, s => { s.settings.reducedMotion = reduced; });
    for (let i = 0; i < before.attempt.board.stock.length; i++) {
      const { g, point } = await geometry(page, introDeal), a = point(g.stock), old = await read(page); await page.touchscreen.tap(a.x, a.y);
      await expect.poll(async () => (await read(page)).attempt.board.stock.length).toBe(old.attempt.board.stock.length - 1); await page.waitForTimeout(reduced ? 20 : 310);
      if (i === 2) { const { g } = await geometry(page, introDeal), waste = g.poses.filter(p => (before.attempt.board.stock.slice(0, 3)).includes(p.id)); expect(new Set(waste.map(p => p.x)).size).toBe(3); await page.screenshot({ path: test.info().outputPath(`fan-${reduced}.png`) }); }
    }
    const exhausted = await read(page), { g, point } = await geometry(page, introDeal), a = point(g.stock); await page.touchscreen.tap(a.x, a.y);
    await expect.poll(async () => (await read(page)).attempt.board.stock).toEqual(exhausted.attempt.board.waste); expect((await read(page)).attempt.board.waste).toEqual([]); await page.waitForTimeout(400);
    expect((await read(page)).attempt.board.movesLeft).toBe(exhausted.attempt.board.movesLeft! - 1);
  }
});

test('pause preferences keep the outer panel bounds and reward disclosure is absent', async ({ page }) => {
  await seed(page); await page.locator('#menu').tap(); await page.waitForTimeout(220); const before = (await page.locator('#settings').boundingBox())!;
  for (const expanded of [true, false, true]) { await page.locator('#pause-options summary').tap(); await expect(page.locator('#pause-options')).toHaveJSProperty('open', expanded); for (const delay of [0, 70, 170]) { await page.waitForTimeout(delay); const after = (await page.locator('#settings').boundingBox())!; for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(after[key] - before[key]), key).toBeLessThan(.6); } }
  await expect(page.getByText('Подробнее о награде')).toHaveCount(0); await page.screenshot({ path: test.info().outputPath('stable-preferences.png') });
});

test('inspection stays separate from foundations for every deck side and row, and never spends a move', async ({ page, context }) => {
  const d = campaignDeals.find(d => d.initial.tableau.length === 4 && d.initial.foundations.length === 3 && d.initial.stock.length)!;
  for (const side of ['left', 'right'] as const) for (const row of ['top', 'bottom'] as const) {
    const before = await seed(page, d, s => { s.settings.deckSide = side; s.settings.deckPosition = row; });
    const { g, point, f } = await geometry(page, d), zone = (await page.locator('#inspect').boundingBox())!;
    for (const t of g.targets.filter(t => t.location.kind === 'foundation')) {
      const center = point(t), overlapX = Math.min(zone.x + zone.width, center.x + t.width * f.unit / 2) - Math.max(zone.x, center.x - t.width * f.unit / 2), overlapY = Math.min(zone.y + zone.height, center.y + t.height * f.unit / 2) - Math.max(zone.y, center.y - t.height * f.unit / 2);
      expect(overlapX > 1 && overlapY > 1, `${side}/${row}: reader covers foundation`).toBe(false);
    }
    const source = g.poses.find(p => p.faceUp && p.depth >= 50)!;
    const c = await touch(context, page, point(source), { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 });
    await expect(page.locator('#peek-title')).toHaveText(d.cards[source.id].text); await expect(page.locator('#inspect-peek')).toBeVisible();
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await c.detach();
    expect((await read(page)).attempt.board).toEqual(before.attempt.board); expect((await read(page)).profile).toEqual(before.profile);
  }
});
