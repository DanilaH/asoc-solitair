import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium, type Page, type BrowserContext } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { dispatch, freshSave, packet } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import type { BoardCommand, Deal, Save } from '../src/domain/types';
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
const wait = (page: Page, ms: number) => page.waitForTimeout(ms);
await mkdir('.recording/feel-evidence', { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4186, strictPort: true }, build: { outDir: process.env.ASOC_QA_DIST ?? 'dist' } }), browser = await chromium.launch();
async function move(page: Page, context: BrowserContext, deal: Deal, cmd: BoardCommand) {
  console.info('touch', deal.id, JSON.stringify(cmd));
  const before = await read(page), rect = (await page.locator('canvas').boundingBox())!, frame = boardFrame(rect.width, rect.height, before.settings.deckPosition, deal);
  const g = layout(before.attempt.board, deal, frame.height, before.settings.deckSide, before.settings.deckPosition);
  const point = (p: { x: number; y: number }) => ({ x: rect.x + frame.offsetX + p.x * frame.unit, y: rect.y + p.y * frame.unit });
  if (cmd.type === 'transfer') {
    const id = cmd.from.kind === 'waste' ? before.attempt.board.waste.at(-1) : packet(before.attempt.board, cmd.from.index, deal).at(-1);
    const a = point(g.poses.find(p => p.id === id)!), b = point(g.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 12, y: a.y + (b.y - a.y) * i / 12 }] });
      await wait(page, 30);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  } else { const p = point(g.stock); await page.touchscreen.tap(p.x, p.y); }

  await page.waitForFunction(revision => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!).revision > revision, before.revision, { timeout: 5000 });
  const expected = dispatch(before, cmd, deal);
  if (!expected.accepted || JSON.stringify((await read(page)).attempt.board) !== JSON.stringify(expected.next.attempt.board)) throw Error('Recorded input disagrees with domain');
}
try {
  const errors: string[] = [];
  // A complete, unseeded first campaign level using only production touch input.
  const context = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: '.recording/feel', size: { width: 360, height: 780 } } });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4186'); await page.waitForSelector('#app[data-ready=true]'); await wait(page, 500);
  await page.screenshot({ path: '.recording/feel-evidence/feel-home.png' });
 await page.locator('#home-play').tap(); await wait(page, 2200);
  await page.screenshot({ path: '.recording/feel-evidence/feel-board.png' });
  const first = campaignDeals[0]; let didCapture = false;
  for (const [index, cmd] of first.winningPath.entries()) {
    const before = await read(page), completes = dispatch(before, cmd, first).events.some(e => e.type === 'complete');
    await move(page, context, first, cmd);
    if (completes && !didCapture) { await wait(page, 340); await page.screenshot({ path: '.recording/feel-evidence/feel-category.png' }); didCapture = true; await wait(page, 550); }
    else await wait(page, index < 2 ? 1600 : 400);
  }
  await page.waitForSelector('#result[open]'); await wait(page, 1000); await page.screenshot({ path: '.recording/feel-evidence/feel-result.png' });
  await page.locator('#next-level').tap(); await wait(page, 950);
  if ((await read(page)).attempt.dealId !== campaignDeals[1].id) throw Error('Next did not open level 2');
  const video = page.video()!; await context.close(); await video.saveAs('.recording/feel-first.webm');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', '.recording/feel-first.webm', '-vf', 'fps=16,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', '.recording/feel-evidence/feel-first.gif']);
  // A reachable dense state: seed is replayed from the exact frozen winning path.
  const dense = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: '.recording/feel-dense', size: { width: 360, height: 780 } } });
  const p = await dense.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://127.0.0.1:4186'); await p.waitForSelector('#app[data-ready=true]');
  const deal = campaignDeals[16]; let index = 0, seed = freshSave(deal, 'qa-feel-dense');
  seed.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, 16).map(d => d.id) };
  while (index < deal.winningPath.length - 1 && !dispatch(seed, deal.winningPath[index], deal).events.some(e => e.type === 'complete')) seed = dispatch(seed, deal.winningPath[index++], deal).next;
  seed.attempt.telemetry = { started: true, finished: false, activeMs: 0 };
  await p.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), seed); await p.reload(); await p.waitForSelector('#app[data-ready=true]'); await p.locator('#home-play').tap(); await wait(p, 800);
  await p.screenshot({ path: '.recording/feel-evidence/feel-dense.png' });
  await move(p, dense, deal, deal.winningPath[index]);
  // The next action starts during the collection/praise tail, then Undo restores it.
  await wait(p, 90); const collected = await read(p); await move(p, dense, deal, deal.winningPath[index + 1]); await wait(p, 650);
  await p.locator('#undo').tap(); await wait(p, 650);
  if (JSON.stringify((await read(p)).attempt.board) !== JSON.stringify(collected.attempt.board)) throw Error('Undo after overlapped category did not restore');
  await p.locator('#menu').tap(); await wait(p, 400); await p.screenshot({ path: '.recording/feel-evidence/feel-pause.png' }); await p.locator('#settings-done').tap(); await wait(p, 400);
  const compactSeed = await read(p), denseVideo = p.video()!; await dense.close(); await denseVideo.saveAs('.recording/feel-dense.webm');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', '.recording/feel-dense.webm', '-vf', 'fps=16,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', '.recording/feel-evidence/feel-dense.gif']);
  // Resizing is audited separately from the fixed-viewport demonstration videos.
  const compactContext = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const compactPage = await compactContext.newPage(); compactPage.on('pageerror', e => errors.push(e.message));
  await compactPage.goto('http://127.0.0.1:4186'); await compactPage.waitForSelector('#app[data-ready=true]');
  await compactPage.screenshot({ path: '.recording/feel-evidence/feel-home-compact.png' });
  await compactPage.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), compactSeed);
  await compactPage.reload(); await compactPage.waitForSelector('#app[data-ready=true]'); await compactPage.locator('#home-play').tap(); await wait(compactPage, 300);
  await compactPage.screenshot({ path: '.recording/feel-evidence/feel-dense-compact.png' });
  await compactPage.locator('#menu').tap(); await compactPage.locator('#appearance-settings').tap();
  await compactPage.locator('button[data-deck-position=bottom]').tap(); await compactPage.locator('button[data-deck-side=left]').tap(); await compactPage.locator('#appearance .primary').tap(); await wait(compactPage, 300);
  await compactPage.screenshot({ path: '.recording/feel-evidence/feel-bottom-compact.png' }); await compactContext.close();
  if (errors.length) throw Error(errors.join('\n'));
  console.info('PASS: real touch first win / Next and reachable dense completion / overlapping next move / Undo / settings.');
} catch (error) { console.error(error); throw error; } finally { await browser.close(); await new Promise<void>(resolve => server.httpServer.close(() => resolve())); }
