import { expect, test, type Page, type CDPSession } from '@playwright/test';
import sharp from 'sharp';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, freshSave, legalCommands, sourceCards } from '../../src/domain/engine';
import { boardFrame, cardMetrics, layout } from '../../src/game/layout';
import { cueSamples } from '../../src/platform/sounds';
import type { Deal, Save } from '../../src/domain/types';

function fixture() {
  for (const deal of campaignDeals) {
    let save = freshSave(deal, 'packet-feel');
    for (const witness of deal.winningPath) {
      for (const cmd of legalCommands(save.attempt.board, deal)) {
        if (cmd.type === 'transfer' && cmd.from.kind === 'tableau' && cmd.to.kind === 'tableau' && sourceCards(save.attempt.board, cmd.from, deal).length >= 3) return { deal, save, cmd };
      }
      save = dispatch(save, witness, deal).next;
    }
  }
  throw Error('No legal three-card fixture');
}
const chosen = fixture();
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
type Trace = { rate: number; hash: number }[];
async function seed(page: Page, muted = false, reduced = false) {
  await page.addInitScript(() => {
    const w = window as typeof window & { __packetAudio: Trace }; w.__packetAudio = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const data = this.buffer?.getChannelData(0); let hash = 2166136261;
      if (data) for (let i = 0; i < Math.min(2048, data.length); i++) hash = Math.imul(hash ^ Math.round(data[i] * 1e6), 16777619);
      w.__packetAudio.push({ rate: this.buffer?.sampleRate ?? 0, hash: hash >>> 0 }); return start.apply(this, args);
    };
  });
  await page.goto('/'); await page.locator('#app[data-ready=true]').waitFor();
  const save = structuredClone(chosen.save); save.settings.sfx = !muted; save.settings.reducedMotion = reduced;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, 79).map(d => d.id) };
  save.campaign = { version: 1, tutorials: ['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used'] };
  await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
  await page.reload(); await page.locator('#app[data-ready=true]').waitFor(); await page.locator('#home-play').tap(); await page.waitForTimeout(300);
  await page.evaluate(() => { (window as typeof window & { __packetAudio: Trace }).__packetAudio = []; });
  return read(page);
}
async function geometry(page: Page, deal: Deal) {
  const save = await read(page), r = (await page.locator('#game-root').boundingBox())!, f = boardFrame(r.width, r.height, save.settings.deckPosition, deal);
  const g = layout(save.attempt.board, deal, f.height, save.settings.deckSide, save.settings.deckPosition);
  return { save, r, f, g, point: (p: { x: number; y: number }) => ({ x: r.x + f.offsetX + p.x * f.unit, y: r.y + p.y * f.unit }) };
}
async function move(c: CDPSession, a: { x: number; y: number }, b: { x: number; y: number }) {
  for (let i = 1; i <= 12; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 12, y: a.y + (b.y - a.y) * i / 12 }] }); await new Promise(r => setTimeout(r, 12)); }
}
async function gathers(page: Page) {
  const calls = await page.evaluate(() => (window as typeof window & { __packetAudio: Trace }).__packetAudio);
  return calls.filter(call => [0, 1, 2].some(variant => {
    let hash = 2166136261; const data = cueSamples('gather', call.rate, variant);
    for (let i = 0; i < Math.min(2048, data.length); i++) hash = Math.imul(hash ^ Math.round(data[i] * 1e6), 16777619);
    return (hash >>> 0) === call.hash;
  })).length;
}

test('a held packet compresses, sounds once, leaves the save untouched and restores its paper on cancel', async ({ page, context }) => {
  const before = await seed(page), { f, g, point, r } = await geometry(page, chosen.deal), ids = sourceCards(before.attempt.board, chosen.cmd.from, chosen.deal);
  const a = point(g.poses.find(p => p.id === ids.at(-1))!), b = { x: page.viewportSize()!.width / 2, y: page.viewportSize()!.height - 100 };
  const baseline = await page.screenshot({ scale: 'css' }), c = await context.newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] }); await move(c, a, b); await page.waitForTimeout(110);
  for (let i = 0; i < 3; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + i, y: b.y }] });
  const held = await page.screenshot({ scale: 'css', path: test.info().outputPath('compact-held.png') });
  expect(await read(page)).toEqual(before);
  const img = await sharp(held).removeAlpha().raw().toBuffer({ resolveWithObject: true }), old = await sharp(baseline).removeAlpha().raw().toBuffer();
  const { width, height } = cardMetrics(chosen.deal), top = Math.max(r.y, b.y - 68 - height * f.unit / 2 - 75), bottom = b.y - 68 + height * f.unit / 2 + 12;
  let min = Infinity, max = -Infinity, area = 0;
  for (let y = Math.floor(top); y < Math.min(img.info.height, bottom); y++) for (let x = Math.floor(b.x - width * f.unit / 2 - 5); x < b.x + width * f.unit / 2 + 5; x++) {
    const i = (y * img.info.width + x) * 3, [red, green, blue] = img.data.subarray(i, i + 3);
    if (red > 180 && green > 155 && blue > 110 && red > green && green > blue && Math.abs(red - old[i]) + Math.abs(green - old[i + 1]) + Math.abs(blue - old[i + 2]) > 70) { min = Math.min(min, y); max = Math.max(max, y); area++; }
  }
  expect(area, 'A full bright front card remains above the finger').toBeGreaterThan(width * height * f.unit ** 2 * .2);
  expect(max - min, 'Three or more cards form one small packet, not an expanded column').toBeLessThan(height * f.unit * 1.04 + 34);
  expect(await gathers(page)).toBe(1);
  await c.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await c.detach(); await page.waitForTimeout(330);
  expect(await read(page)).toEqual(before);
  const restored = await page.screenshot({ scale: 'css', path: test.info().outputPath('cancel-restored.png') }), after = await sharp(restored).removeAlpha().raw().toBuffer();
  let error = 0, count = 0;
  for (let y = Math.ceil(r.y); y < r.y + r.height; y++) for (let x = Math.ceil(r.x); x < r.x + r.width; x++) { const i = (y * img.info.width + x) * 3; for (let ch = 0; ch < 3; ch++) { error += Math.abs(old[i + ch] - after[i + ch]); count++; } }
  expect(error / count, 'Cancel restores captions, brightness and resting positions').toBeLessThan(2);
});

for (const anchor of ['finger', 'card'] as const) test(`a packet grabbed by its rear strip still uses the ${anchor} drop anchor and exact Undo`, async ({ page, context }) => {
  const before = await seed(page), { g, point } = await geometry(page, chosen.deal), ids = sourceCards(before.attempt.board, chosen.cmd.from, chosen.deal);
  const rear = g.poses.find(p => p.id === ids[0])!, a = point({ x: rear.x, y: rear.y - cardMetrics(chosen.deal).height / 2 + 22 });
  const target = g.targets.find(t => t.location.kind === chosen.cmd.to.kind && t.location.index === chosen.cmd.to.index)!, b = point(target); if (anchor === 'card') b.y += 68;
  const c = await context.newCDPSession(page); await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] }); await move(c, a, b); await page.waitForTimeout(100);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await c.detach();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(dispatch(before, chosen.cmd, chosen.deal).next.attempt.board);
  await page.locator('#undo').tap(); await expect.poll(async () => (await read(page)).attempt.board).toEqual(before.attempt.board);
});

test('muted reduced-motion packet gestures stay compact and produce no audio or state change', async ({ page, context }) => {
  const before = await seed(page, true, true), { g, point } = await geometry(page, chosen.deal), ids = sourceCards(before.attempt.board, chosen.cmd.from, chosen.deal), a = point(g.poses.find(p => p.id === ids.at(-1))!);
  const c = await context.newCDPSession(page); await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] }); await move(c, a, { x: a.x + 50, y: a.y + 65 });
  await page.screenshot({ path: test.info().outputPath('reduced-held.png') }); await c.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await c.detach();
  expect(await read(page)).toEqual(before); expect(await page.evaluate(() => (window as typeof window & { __packetAudio: Trace }).__packetAudio)).toEqual([]);
});
