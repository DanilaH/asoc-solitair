import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, freshSave, packet } from '../../src/domain/engine';
import { boardFrame, cardMetrics, layout } from '../../src/game/layout';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';

const read = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function seed(page: Page, deal: Deal, state: Save) {
  await page.goto('/'); await page.locator('#app[data-ready=true]').waitFor();
  state.settings.sfx = false; state.settings.reducedMotion = false;
  state.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, Math.max(26, (deal.campaignLevel ?? 1) - 1)).map(d => d.id) };
  state.campaign = { version: 1, tutorials: ['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used'] };
  await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), state);
  await page.reload(); await page.locator('#app[data-ready=true]').waitFor(); await page.locator('#home-play').tap(); await page.waitForTimeout(300);
}
async function geometry(page: Page, deal: Deal) {
  const state = await read(page), r = (await page.locator('#game-root').boundingBox())!, f = boardFrame(r.width, r.height, state.settings.deckPosition, deal);
  const g = layout(state.attempt.board, deal, f.height, state.settings.deckSide, state.settings.deckPosition);
  return { state, f, g, point: (p: { x: number; y: number }) => ({ x: r.x + f.offsetX + p.x * f.unit, y: r.y + p.y * f.unit }) };
}
async function move(page: Page, deal: Deal, command: BoardCommand) {
  const { state, g, point } = await geometry(page, deal), expected = dispatch(state, command, deal); expect(expected.accepted).toBe(true);
  if (command.type === 'transfer') {
    const id = command.from.kind === 'waste' ? state.attempt.board.waste.at(-1) : packet(state.attempt.board, command.from.index, deal).at(-1);
    const a = point(g.poses.find(p => p.id === id)!), b = point(g.targets.find(t => t.location.kind === command.to.kind && t.location.index === command.to.index)!);
    await page.touchscreen.tap(a.x, a.y); await page.touchscreen.tap(b.x, b.y);
  } else { const p = point(g.stock); await page.touchscreen.tap(p.x, p.y); }
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected.next.attempt.board);
  return expected.next;
}
// The audited opening deliberately collects the light cards before drawing.
// The supplied full witness takes a different legal route through the stock.
const lightsOpening: BoardCommand[] = [
  { type: 'transfer', from: { kind: 'tableau', index: 1 }, to: { kind: 'foundation', index: 1 } },
  { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'foundation', index: 1 } },
  { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'foundation', index: 0 } },
  { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'foundation', index: 1 } },
  { type: 'transfer', from: { kind: 'tableau', index: 1 }, to: { kind: 'foundation', index: 1 } },
  { type: 'transfer', from: { kind: 'tableau', index: 1 }, to: { kind: 'foundation', index: 1 } },
];
const lightsState = (count: number) => lightsOpening.slice(0, count).reduce((s, cmd) => {
  const result = dispatch(s, cmd, campaignDeals[5]); expect(result.accepted).toBe(true); return result.next;
}, freshSave(campaignDeals[5], 'board-continuity'));
async function patchMean(buffer: Buffer, point: { x: number; y: number }) {
  // stats() describes the input image, not the pending extract pipeline.
  const { data, info } = await sharp(buffer).extract({ left: Math.round(point.x) - 5, top: Math.round(point.y) - 5, width: 10, height: 10 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const means = Array.from({ length: info.channels }, () => 0);
  for (let i = 0; i < data.length; i++) means[i % info.channels] += data[i];
  return means.map(value => value / (info.width * info.height));
}

test('a new first game and Next finish their entry with usable card positions', async ({ page }) => {
  await page.goto('/'); await page.locator('#app[data-ready=true]').waitFor();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');
  const first = campaignDeals[0]; expect((await read(page)).attempt.dealId).toBe(first.id);
  await page.waitForTimeout(380);
  for (const cmd of first.winningPath) { await move(page, first, cmd); await page.waitForTimeout(220); }
  await page.locator('#result').waitFor({ state: 'visible' }); await page.locator('#next-level').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', campaignDeals[1].id);
  await page.waitForTimeout(380); await move(page, campaignDeals[1], campaignDeals[1].winningPath[0]);
});

test('lifting an entire last packet exposes the column base and preserves the attempt', async ({ page, context }) => {
  let candidate: { deal: Deal; state: Save; column: number } | undefined;
  for (const deal of campaignDeals) {
    let state = freshSave(deal, 'packet-well');
    for (const cmd of deal.winningPath) {
      const column = state.attempt.board.tableau.findIndex((col, index) => col.length > 1 && packet(state.attempt.board, index, deal).length === col.length);
      if (column >= 0) { candidate = { deal, state, column }; break; }
      state = dispatch(state, cmd, deal).next;
    }
    if (candidate) break;
  }
  if (!candidate) throw Error('Expected a supplied deal to expose a whole last packet');
  const { deal, state, column } = candidate; await seed(page, deal, state);
  const { state: before, g, point } = await geometry(page, deal), ids = packet(before.attempt.board, column, deal), a = point(g.poses.find(p => p.id === ids.at(-1))!), base = point(g.poses.find(p => p.id === ids[0])!);
  const destination = { x: base.x < page.viewportSize()!.width / 2 ? page.viewportSize()!.width - 45 : 45, y: page.viewportSize()!.height * .74 }, c = await context.newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let i = 1; i <= 10; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (destination.x - a.x) * i / 10, y: a.y + (destination.y - a.y) * i / 10 }] }); await page.waitForTimeout(12); }
  const color = await patchMean(await page.screenshot({ scale: 'css', path: test.info().outputPath('packet-well.png') }), base);
  expect(color[0]).toBeLessThan(70); expect(color[1]).toBeLessThan(105);
  expect((await read(page)).attempt).toEqual(before.attempt);
  await c.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await c.detach();
  await page.waitForTimeout(300); expect((await read(page)).attempt).toEqual(before.attempt);
});

test('lifting the final card exposes the same physical well as an empty column, without committing', async ({ page, context }) => {
  const d = campaignDeals[5]; await seed(page, d, lightsState(5));
  const { state, g, point } = await geometry(page, d), a = point(g.poses.find(p => p.id === 'lights_1')!), empty = point(g.targets.find(t => t.location.kind === 'tableau' && t.location.index === 0)!);
  expect(state.attempt.board.tableau[1]).toEqual(['lights_1']);
  expect(state.attempt.board.tableau[0]).toEqual([]);
  const c = await context.newCDPSession(page), destination = { x: page.viewportSize()!.width - 45, y: page.viewportSize()!.height * .72 };
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let i = 1; i <= 10; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (destination.x - a.x) * i / 10, y: a.y + (destination.y - a.y) * i / 10 }] }); await page.waitForTimeout(12); }
  const image = await page.screenshot({ scale: 'css', path: test.info().outputPath('last-card-well.png') }), sourceColor = await patchMean(image, a), emptyColor = await patchMean(image, empty);
  expect(Math.max(...sourceColor.map((v, i) => Math.abs(v - emptyColor[i])))).toBeLessThan(4);
  expect((await read(page)).attempt).toEqual(state.attempt);
  await c.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await c.detach();
  expect((await read(page)).attempt).toEqual(state.attempt);
});

test('a foundation keeps a paper surface throughout an ordinary accepted flight', async ({ page, context }) => {
  const d = campaignDeals[5]; await seed(page, d, lightsState(1));
  const { g, point, f } = await geometry(page, d), target = point(g.targets.find(t => t.location.kind === 'foundation' && t.location.index === 1)!);
  const c = await context.newCDPSession(page), frames: Buffer[] = [];
  c.on('Page.screencastFrame', frame => { frames.push(Buffer.from(frame.data, 'base64')); void c.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {}); });
  await c.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await move(page, d, lightsOpening[1]); await page.waitForTimeout(350); await c.send('Page.stopScreencast'); await c.detach();
  expect(frames.length).toBeGreaterThan(2);
  const roi = { left: Math.round(target.x - 45 * f.unit), top: Math.round(target.y - 55 * f.unit), width: Math.round(90 * f.unit), height: Math.round(110 * f.unit) };
  let minimum = 1, weakest = frames[0];
  for (const buffer of frames) {
    const { data, info } = await sharp(buffer).extract(roi).removeAlpha().raw().toBuffer({ resolveWithObject: true }); let paper = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i] > 185 && data[i + 1] > 165 && data[i + 2] > 115) paper++;
    const fraction = paper / (info.width * info.height); if (fraction < minimum) { minimum = fraction; weakest = buffer; }
  }
  await test.info().attach('least-paper-during-flight', { body: weakest, contentType: 'image/png' });
  expect(minimum, 'No intermediate empty frame under the title/counter').toBeGreaterThan(.45);
});

test('an off-target release is neutral and draws no rejection below the finger', async ({ page, context }) => {
  const d = campaignDeals[5]; await seed(page, d, lightsState(5));
  const { state, g, point, f } = await geometry(page, d), a = point(g.poses.find(p => p.id === 'lights_1')!), destination = { x: page.viewportSize()!.width - 45, y: page.viewportSize()!.height * .72 };
  const before = await page.screenshot({ scale: 'css' }), c = await context.newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let i = 1; i <= 10; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (destination.x - a.x) * i / 10, y: a.y + (destination.y - a.y) * i / 10 }] }); await page.waitForTimeout(12); }
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await c.detach();
  const after = await page.screenshot({ scale: 'css', path: test.info().outputPath('neutral-release.png') });
  const bottom = { x: destination.x, y: destination.y + (cardMetrics(d).height / 2 - 2) * f.unit };
  const oldColor = await patchMean(before, bottom), newColor = await patchMean(after, bottom);
  expect(Math.max(...oldColor.map((v, i) => Math.abs(v - newColor[i])))).toBeLessThan(8);
  expect((await read(page)).attempt).toEqual(state.attempt);
});

function reuseCase() {
  for (const d of campaignDeals) {
    let state = freshSave(d, 'rapid-foundation-reuse');
    for (let i = 0; i < d.winningPath.length - 1; i++) {
      const cmd = d.winningPath[i], next = d.winningPath[i + 1], result = dispatch(state, cmd, d);
      if (cmd.type === 'transfer' && next.type === 'transfer' && cmd.to.kind === 'foundation' && next.to.kind === 'foundation' && cmd.to.index === next.to.index && result.events.some(e => e.type === 'complete') && result.next.attempt.board.phase === 'playing') return { d, state, cmd, next };
      state = result.next;
    }
  }
  throw Error('Expected a supplied witness to reuse a just-completed slot');
}

test('a cleared slot accepts the next leader and two early Undos leave no departing cards', async ({ page }) => {
  const { d, state, cmd, next } = reuseCase(); await seed(page, d, state);
  const before = await read(page), completed = await move(page, d, cmd), replaced = await move(page, d, next);
  expect(replaced.attempt.board.foundations[next.to.index].length).toBeGreaterThan(0);
  const coins = (await read(page)).profile.coins;
  await page.locator('#undo').tap(); await expect.poll(async () => (await read(page)).attempt.board).toEqual(completed.attempt.board);
  await page.locator('#undo').tap(); await expect.poll(async () => (await read(page)).attempt.board).toEqual(before.attempt.board);
  await page.waitForTimeout(650); expect((await read(page)).profile.coins).toBe(coins);
  expect((await read(page)).profile.undos).toBe(before.profile.undos - 2);
  await page.screenshot({ scale: 'css', path: test.info().outputPath('early-undo-restored.png') });
});

test('pause interrupts collection without leaving a ghost above the empty slot', async ({ page }) => {
  const d = campaignDeals[5]; await seed(page, d, lightsState(5)); const accepted = await move(page, d, lightsOpening[5]);
  expect(accepted.attempt.board.collected.length).toBe(5);
  await page.locator('#menu').tap(); await page.locator('#settings-done').tap(); await page.waitForTimeout(600);
  expect((await read(page)).attempt.board).toEqual(accepted.attempt.board);
  const { g, point } = await geometry(page, d), p = point(g.targets.find(t => t.location.kind === 'foundation' && t.location.index === 1)!);
  const color = await patchMean(await page.screenshot({ scale: 'css', path: test.info().outputPath('collection-resumed.png') }), { x: p.x, y: p.y + 25 });
  expect(color[0], 'The completed cream card is gone').toBeLessThan(160);
  await expect(page.locator('#praise')).toBeHidden();
});
