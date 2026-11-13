import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, freshSave, legalCommands, sourceCards } from '../../src/domain/engine';
import { boardFrame, cardMetrics, layout } from '../../src/game/layout';
import { cueSamples } from '../../src/platform/sounds';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';

type Trace = { writes: { at: number; revision: number }[]; audio: { at: number; rate: number; hash: number }[] };
type Fixture = { deal: Deal; save: Save; cmd: BoardCommand };
const read = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
function candidate(predicate: (v: Fixture) => boolean): Fixture {
  for (const deal of campaignDeals) {
    let save = freshSave(deal, 'contact-regression');
    for (const witness of deal.winningPath) {
      for (const cmd of legalCommands(save.attempt.board, deal)) if (predicate({ deal, save, cmd })) return { deal, save, cmd };
      save = dispatch(save, witness, deal).next;
    }
  }
  throw Error('Missing legal fixture');
}
async function seed(page: Page, deal: Deal, save: Save) {
  await page.addInitScript(() => {
    const w = window as typeof window & { __contactTrace: Trace }; w.__contactTrace = { writes: [], audio: [] };
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { const result = set.call(this, k, v); if (k === 'asoc-solitaire.save.v1') w.__contactTrace.writes.push({ at: performance.now(), revision: JSON.parse(v).revision }); return result; };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const data = this.buffer?.getChannelData(0); let hash = 2166136261;
      if (data) for (let i = 0; i < Math.min(2048, data.length); i++) hash = Math.imul(hash ^ Math.round(data[i] * 1e6), 16777619);
      w.__contactTrace.audio.push({ at: performance.now(), rate: this.buffer?.sampleRate ?? 0, hash: hash >>> 0 });
      return start.apply(this, args);
    };
  });
  await page.goto('/'); await page.locator('#app[data-ready=true]').waitFor();
  save = structuredClone(save); save.settings.sfx = true; save.settings.reducedMotion = false;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, 79).map(d => d.id) };
  save.campaign = { version: 1, tutorials: ['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used'] };
  await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
  await page.reload(); await page.locator('#app[data-ready=true]').waitFor(); await page.locator('#home-play').tap(); await page.waitForTimeout(300);
  expect((await read(page)).attempt.dealId).toBe(deal.id);
}
async function geometry(page: Page, deal: Deal) {
  const save = await read(page), r = (await page.locator('#game-root').boundingBox())!, f = boardFrame(r.width, r.height, save.settings.deckPosition, deal);
  const g = layout(save.attempt.board, deal, f.height, save.settings.deckSide, save.settings.deckPosition);
  return { save, r, f, g, point: (p: { x: number; y: number }) => ({ x: r.x + f.offsetX + p.x * f.unit, y: r.y + p.y * f.unit }) };
}
async function tapCommand(page: Page, deal: Deal, cmd: BoardCommand) {
  const { save, g, point } = await geometry(page, deal);
  if (cmd.type !== 'transfer') throw Error('Transfer fixture required');
  const from = point(g.poses.find(p => p.id === sourceCards(save.attempt.board, cmd.from, deal).at(-1))!), to = point(g.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!);
  await page.touchscreen.tap(from.x, from.y); await page.waitForTimeout(80); await page.touchscreen.tap(to.x, to.y);
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(dispatch(save, cmd, deal).next.attempt.board);
}
async function record(page: Page, action: () => Promise<void>) {
  const c = await page.context().newCDPSession(page), frames: { buffer: Buffer; epoch: number }[] = [];
  c.on('Page.screencastFrame', f => { frames.push({ buffer: Buffer.from(f.data, 'base64'), epoch: f.metadata.timestamp! * 1000 }); void c.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined); });
  await c.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await action(); await page.waitForTimeout(380); await c.send('Page.stopScreencast'); await c.detach();
  return frames;
}
type Pattern = { size: number; points: number[][] };
async function pattern(buffer: Buffer, center: { x: number; y: number }, size: number): Promise<Pattern> {
  size = Math.max(24, Math.round(size / 2) * 2); const small = size / 2;
  const { data, info } = await sharp(buffer).extract({ left: Math.round(center.x - size / 2), top: Math.round(center.y - size / 2), width: size, height: size }).resize(small, small).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const points = [];
  for (let y = 2; y < small - 2; y += 3) for (let x = 2; x < small - 2; x += 3) {
    const i = (y * small + x) * info.channels;
    if (data[i] < 170 || data[i + 2] < 130) points.push([x, y, data[i], data[i + 1], data[i + 2]]);
  }
  expect(points.length).toBeGreaterThan(5); return { size: small, points };
}
async function pixels(buffer: Buffer, width: number) { return sharp(buffer).resize({ width: Math.round(width / 2) }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); }
type Pixels = Awaited<ReturnType<typeof pixels>>;
function errorAt(image: Pixels, p: Pattern, x: number, y: number) {
  let sum = 0;
  for (const [px, py, r, g, b] of p.points) { const i = ((y + py) * image.info.width + x + px) * image.info.channels; sum += Math.abs(image.data[i] - r) + Math.abs(image.data[i + 1] - g) + Math.abs(image.data[i + 2] - b); }
  return sum / (p.points.length * 3);
}
function locate(image: Pixels, p: Pattern, top: number, bottom: number) {
  let error = Infinity, x = 0, y = 0;
  for (let py = Math.max(0, Math.floor(top / 2)); py < Math.min(image.info.height - p.size, bottom / 2); py++) for (let px = 0; px < image.info.width - p.size; px++) {
    const value = errorAt(image, p, px, py); if (value < error) { error = value; x = px; y = py; }
  }
  return { error, x: x * 2 + p.size, y: y * 2 + p.size };
}

test('an ordinary flight stays visible above the opening source and sounds on contact', async ({ page }) => {
  const deal = campaignDeals[5], save = dispatch(freshSave(deal, 'flight-layer'), deal.winningPath[0], deal).next, cmd = deal.winningPath[1];
  await seed(page, deal, save); const { g, point, f, r } = await geometry(page, deal);
  const a = point(g.poses.find(p => p.id === 'lights_3')!), before = await page.screenshot({ scale: 'css' }), p = await pattern(before, a, 104 * f.unit * .84);
  const frames = await record(page, () => tapCommand(page, deal, cmd)); expect(frames.length).toBeGreaterThan(3);
  let worst = 0, weakest = frames[0].buffer;
  for (const frame of frames) {
    const found = locate(await pixels(frame.buffer, page.viewportSize()!.width), p, r.y, r.y + r.height);
    if (found.error > worst) { worst = found.error; weakest = frame.buffer; }
  }
  await test.info().attach('least-visible-flight', { body: weakest, contentType: 'image/png' });
  expect(worst, 'The flashlight silhouette stays visible throughout the flight').toBeLessThan(32);
  const trace = await page.evaluate(() => (window as typeof window & { __contactTrace: Trace }).__contactTrace);
  const written = trace.writes.find(w => w.revision > save.revision)!;
  const transfer = trace.audio.find(a => {
    const data = cueSamples('transfer', a.rate, 0); let hash = 2166136261;
    for (let i = 0; i < Math.min(2048, data.length); i++) hash = Math.imul(hash ^ Math.round(data[i] * 1e6), 16777619);
    return (hash >>> 0) === a.hash;
  });
  expect(transfer).toBeDefined(); expect(transfer!.at - written.at).toBeGreaterThan(90);
});

test('the receiving apple keeps its picture until the arriving packet covers it', async ({ page }) => {
  const c = candidate(({ deal, save, cmd }) => cmd.type === 'transfer' && cmd.to.kind === 'tableau' && save.attempt.board.tableau[cmd.to.index].length > 0 && sourceCards(save.attempt.board, cmd.from, deal).length >= 2);
  await seed(page, c.deal, c.save); const { save, g, point, f, r } = await geometry(page, c.deal), cmd = c.cmd;
  if (cmd.type !== 'transfer' || cmd.to.kind !== 'tableau') throw Error('Fixture');
  const under = save.attempt.board.tableau[cmd.to.index].at(-1)!, ids = sourceCards(save.attempt.board, cmd.from, c.deal), a = point(g.poses.find(p => p.id === under)!), front = point(g.poses.find(p => p.id === ids.at(-1))!);
  const screenshot = await page.screenshot({ scale: 'css' }), size = 104 * f.unit * .75;
  const apple = await pattern(screenshot, a, size), moving = await pattern(screenshot, front, size), timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const frames = await record(page, () => tapCommand(page, c.deal, cmd));
  const trace = await page.evaluate(() => (window as typeof window & { __contactTrace: Trace }).__contactTrace), commit = trace.writes.find(w => w.revision > c.save.revision)!.at + timeOrigin;
  let checked = 0;
  for (const frame of frames.filter(f => f.epoch >= commit)) {
    const image = await pixels(frame.buffer, page.viewportSize()!.width), incoming = locate(image, moving, r.y, r.y + r.height);
    // Check only frames where even the full incoming card width is still away
    // from the old picture; legitimate physical coverage may hide it later.
    if (incoming.error > 30 || Math.abs(incoming.x - a.x) < cardMetrics(c.deal).width * f.unit / 2 + apple.size + 3) continue;
    const error = errorAt(image, apple, Math.round(a.x / 2 - apple.size / 2), Math.round(a.y / 2 - apple.size / 2));
    await test.info().attach(`uncovered-apple-${checked}`, { body: frame.buffer, contentType: 'image/png' });
    expect(error, 'Old picture cannot disappear while the incoming group is elsewhere').toBeLessThan(32); checked++;
  }
  expect(checked, 'Capture an intermediate uncovered receiving card').toBeGreaterThan(0);
});

test('an ordered upper leader has one legible rule label without a fraction over it', async ({ page }) => {
  const deal = campaignDeals[22], state = dispatch(freshSave(deal, 'ordered-label'), deal.winningPath[0], deal).next;
  await seed(page, deal, state); const { g, point, f } = await geometry(page, deal), leader = Object.values(deal.cards).find(c => c.ordered && c.leader)!, p = point(g.poses.find(p => p.id === leader.id)!);
  const { data, info } = await sharp(await page.screenshot({ scale: 'css' })).extract({ left: Math.round(p.x - 29 * f.unit), top: Math.round(p.y - cardMetrics(deal).height / 2 * f.unit + 7 * f.unit), width: Math.round(58 * f.unit), height: Math.round(22 * f.unit) }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let darkFraction = 0;
  for (let i = 0; i < data.length; i += info.channels) if (data[i] < 175 && data[i + 1] < 139 && data[i + 2] < 110) darkFraction++;
  expect(darkFraction, 'No dark 0/7 digits collide with the lighter rule label').toBeLessThan(5);
});

test('a final key keeps its visible lock destination, and early Undo cancels the whole presentation', async ({ page }) => {
  const c = candidate(({ deal, save, cmd }) => Boolean(deal.lock) && dispatch(save, cmd, deal).events.some(e => e.type === 'unlock'));
  await seed(page, c.deal, c.save); const { g, point, f } = await geometry(page, c.deal), target = point(g.targets.find(t => t.location.kind === 'tableau' && t.location.index === c.deal.lock!.column)!);
  const roi = { left: Math.round(target.x - 25 * f.unit), top: Math.round(target.y - 35 * f.unit), width: Math.round(50 * f.unit), height: Math.round(50 * f.unit) };
  // Hold this visual phase explicitly: CI screenshot transport time is not the
  // length of a key animation. Gameplay input and the durable write remain real.
  await page.clock.install(); await page.clock.pauseAt(new Date());
  const before = await sharp(await page.screenshot({ scale: 'css' })).extract(roi).removeAlpha().raw().toBuffer();
  await tapCommand(page, c.deal, c.cmd);
  await page.clock.runFor(60);
  expect((await read(page)).attempt.board.keys).toHaveLength(3);
  const duringBuffer = await page.screenshot({ scale: 'css' }), during = await sharp(duringBuffer).extract(roi).removeAlpha().raw().toBuffer();
  let difference = 0; for (let i = 0; i < before.length; i++) difference += Math.abs(before[i] - during[i]);
  await test.info().attach('key-still-has-a-lock', { body: duringBuffer, contentType: 'image/png' });
  expect(difference / before.length, 'Durable unlock precedes the visual key contact; destination remains visible').toBeLessThan(8);
  const undo = (await page.locator('#undo').boundingBox())!;
  await page.touchscreen.tap(undo.x + undo.width / 2, undo.y + undo.height / 2); await page.clock.runFor(1000);
  expect((await read(page)).attempt.board).toEqual(c.save.attempt.board);
  await expect(page.locator('#praise')).toBeHidden();
});
