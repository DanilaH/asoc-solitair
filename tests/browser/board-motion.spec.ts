import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, freshSave, sourceCards } from '../../src/domain/engine';
import { resolveHint } from '../../src/domain/hint';
import { boardFrame, cardMetrics, layout } from '../../src/game/layout';
import { cueSamples } from '../../src/platform/sounds';
import type { Save } from '../../src/domain/types';

const deal = campaignDeals[5], first = deal.winningPath[0], cmd = deal.winningPath[1];
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
type Audio = { at: number; rate: number; hash: number };
async function seed(page: Page, reduced = false) {
  await page.addInitScript(() => {
    const w = window as typeof window & { __motionAudio: Audio[] }; w.__motionAudio = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const b = this.buffer, data = b?.getChannelData(0); let hash = 2166136261;
      if (data) for (let i = 0; i < Math.min(2048, data.length); i++) hash = Math.imul(hash ^ Math.round(data[i] * 1e6), 16777619);
      w.__motionAudio.push({ at: performance.now(), rate: b?.sampleRate ?? 0, hash: hash >>> 0 }); return start.apply(this, args);
    };
  });
  await page.goto('/'); await page.locator('#app[data-ready=true]').waitFor();
  const save = dispatch(freshSave(deal, 'board-motion'), first, deal).next;
  save.settings.sfx = true; save.settings.reducedMotion = reduced;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, 79).map(d => d.id) };
  save.campaign = { version: 1, tutorials: ['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used'] };
  await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
  await page.reload(); await page.locator('#app[data-ready=true]').waitFor(); await page.locator('#home-play').tap(); await page.waitForTimeout(350);
  const r = (await page.locator('#game-root').boundingBox())!, f = boardFrame(r.width, r.height, save.settings.deckPosition, deal);
  const g = layout(save.attempt.board, deal, f.height, save.settings.deckSide, save.settings.deckPosition);
  const point = (p: { x: number; y: number }) => ({ x: r.x + f.offsetX + p.x * f.unit, y: r.y + p.y * f.unit });
  const hint = resolveHint(save.attempt.board, deal); if (hint.status !== 'SOLVED' || hint.action.type !== 'transfer') throw Error('Expected a verified transfer hint');
  const action = hint.action;
  const a = point(g.poses.find(p => p.id === sourceCards(save.attempt.board, action.from, deal).at(-1))!);
  const b = point(g.targets.find(t => t.location.kind === action.to.kind && t.location.index === action.to.index)!);
  return { before: await read(page), a, b, f, r, action };
}
async function changedStrip(image: Buffer, baseline: Buffer, p: { x: number; y: number }, unit: number) {
  const w = Math.round(cardMetrics(deal).width * unit * .55), h = Math.max(2, Math.round(6 * unit));
  const roi = { left: Math.round(p.x - w / 2), top: Math.round(p.y + cardMetrics(deal).height * unit / 2 - 8 * unit), width: w, height: h };
  const [current, old] = await Promise.all([sharp(image).extract(roi).removeAlpha().raw().toBuffer(), sharp(baseline).extract(roi).removeAlpha().raw().toBuffer()]);
  let sum = 0; for (let i = 0; i < old.length; i++) sum += Math.abs(current[i] - old[i]); return sum / old.length;
}

test('a paid hint stages the source before the destination, repeats for free and yields to a real move', async ({ page }) => {
  const { before, a, b, f, action } = await seed(page);
  await page.clock.install(); await page.clock.pauseAt(new Date());
  const baseline = await page.screenshot({ scale: 'css' });
  await page.touchscreen.tap(a.x, a.y); await page.locator('#hint').tap();
  await expect.poll(async () => (await read(page)).profile.hints).toBe(before.profile.hints - 1);
  await page.clock.runFor(120);
  const origin = await page.screenshot({ scale: 'css', path: test.info().outputPath('hint-source.png') });
  expect(await changedStrip(origin, baseline, a, f.unit)).toBeGreaterThan(12);
  expect(await changedStrip(origin, baseline, b, f.unit)).toBeLessThan(3);
  await page.clock.runFor(650);
  const destination = await page.screenshot({ scale: 'css', path: test.info().outputPath('hint-destination.png') });
  expect(await changedStrip(destination, baseline, b, f.unit)).toBeGreaterThan(10);
  expect((await read(page)).attempt.board).toEqual(before.attempt.board);
  await page.locator('#hint').tap(); await page.clock.runFor(120);
  expect((await read(page)).profile.hints).toBe(before.profile.hints - 1);
  await page.touchscreen.tap(a.x, a.y); await page.touchscreen.tap(b.x, b.y);
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(dispatch(before, action, deal).next.attempt.board);
  await page.clock.runFor(2500);
  expect((await read(page)).profile.hints).toBe(before.profile.hints - 1);
  await page.locator('#undo').tap(); await page.clock.runFor(300);
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(before.attempt.board);
});

test('reduced-motion hint stays still and pause removes its presentation without changing the board', async ({ page }) => {
  const { before } = await seed(page, true);
  await page.clock.install(); await page.clock.pauseAt(new Date()); await page.locator('#hint').tap();
  await expect.poll(async () => (await read(page)).profile.hints).toBe(before.profile.hints - 1);
  await page.clock.runFor(300);
  const a = await page.screenshot({ scale: 'css' }); await page.clock.runFor(2500);
  expect(await page.screenshot({ scale: 'css' })).toEqual(a);
  await page.locator('#menu').tap(); await page.locator('#settings-done').tap(); await page.clock.runFor(300);
  expect((await read(page)).attempt.board).toEqual(before.attempt.board);
  await page.screenshot({ path: test.info().outputPath('reduced-after-pause.png') });
});

function isTransfer(call: Audio) {
  return [0, 1, 2].some(v => { const data = cueSamples('transfer', call.rate, v); let hash = 2166136261; for (let i = 0; i < Math.min(2048, data.length); i++) hash = Math.imul(hash ^ Math.round(data[i] * 1e6), 16777619); return (hash >>> 0) === call.hash; });
}
test('a drop already over its slot contacts sooner than a long tap transfer, preserving exact Undo', async ({ page, context }) => {
  const { before, a, b, action } = await seed(page);
  expect(cmd).toEqual(action);
  await page.clock.install(); await page.clock.pauseAt(new Date());
  const contact = async (start: number) => {
    const calls = await page.evaluate(() => (window as typeof window & { __motionAudio: Audio[] }).__motionAudio);
    const last = calls.filter(c => c.at >= start && isTransfer(c)).at(-1); expect(last).toBeDefined(); return last!.at - start;
  };
  await page.touchscreen.tap(a.x, a.y); const tapAt = await page.evaluate(() => performance.now()); await page.touchscreen.tap(b.x, b.y);
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(dispatch(before, cmd, deal).next.attempt.board); await page.clock.runFor(250);
  const far = await contact(tapAt);
  await page.locator('#undo').tap(); await expect.poll(async () => (await read(page)).attempt.board).toEqual(before.attempt.board); await page.clock.runFor(300);
  const c = await context.newCDPSession(page), finger = { x: b.x, y: b.y + 68 };
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let i = 1; i <= 10; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (finger.x - a.x) * i / 10, y: a.y + (finger.y - a.y) * i / 10 }] }); await page.clock.runFor(16); }
  await page.clock.runFor(100); const dropAt = await page.evaluate(() => performance.now()); await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await c.detach();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(dispatch(before, cmd, deal).next.attempt.board); await page.clock.runFor(250);
  const near = await contact(dropAt); expect(near + 25).toBeLessThan(far);
  await test.info().attach('contact-timings', { body: JSON.stringify({ near, far }), contentType: 'application/json' });
  await page.locator('#undo').tap(); await expect.poll(async () => (await read(page)).attempt.board).toEqual(before.attempt.board);
});
