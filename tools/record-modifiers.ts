import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium, type Page } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { modifierDeals } from '../src/content/modifiers';
import { freshSave, packet } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import type { BoardCommand, Deal, Save } from '../src/domain/types';
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function geometry(page: Page, deal: Deal) {
  const save = await read(page), rect = (await page.locator('canvas').boundingBox())!, frame = boardFrame(rect.width, rect.height);
  return { save, geo: layout(save.attempt.board, deal, frame.height), tap: (p: {x: number; y: number}) => page.touchscreen.tap(rect.x + frame.offsetX + p.x * frame.unit, rect.y + p.y * frame.unit) };
}
async function move(page: Page, deal: Deal, cmd: BoardCommand, valid = true) {
  const { save, geo, tap } = await geometry(page, deal);
  if (cmd.type === 'transfer') {
    const id = cmd.from.kind === 'waste' ? save.attempt.board.waste.at(-1) : packet(save.attempt.board, cmd.from.index, deal).at(-1);
    await tap(geo.poses.find(p => p.id === id)!); await tap(geo.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!);
  } else await tap(geo.stock);
  await page.waitForTimeout(500);
  if (valid && (await read(page)).attempt.board.movesLeft !== (save.attempt.board.movesLeft! - 1)) throw Error(`Recording refused ${JSON.stringify(cmd)}`);
}
await mkdir('docs/qa', { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4183, strictPort: true } }), browser = await chromium.launch();
try {
  for (const [name, deal] of [['joker', modifierDeals[0]], ['ordered', modifierDeals[2]], ['keys', modifierDeals[4]]] as const) {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, recordVideo: { dir: '.recording/modifiers-video', size: { width: 360, height: 640 } } }), page = await context.newPage();
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:4183'); await page.waitForSelector('#app[data-ready="true"]');
    const save = freshSave(deal, `qa-${name}`);
    save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0, completedCampaign: campaignDeals.slice(0, deal.campaignLevel! - 1).map(d => d.id) };
    await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
    await page.reload(); await page.waitForSelector('#app[data-ready="true"]'); await page.locator('#home-play').tap(); await page.waitForTimeout(1100);
    await page.screenshot({ path: `docs/qa/modifier-${name}.png`, scale: 'css' });
    if (name === 'joker') {
      await page.locator('#joker').tap(); await page.waitForTimeout(400);
      const { geo, tap } = await geometry(page, deal); await tap(geo.targets.find(t => t.location.kind === 'tableau' && t.location.index === 0)!); await page.waitForTimeout(650);
      for (const cmd of deal.tutorialPath!.slice(1)) { await move(page, deal, cmd as BoardCommand); await page.waitForTimeout(250); }
    } else if (name === 'ordered') {
      await move(page, deal, deal.winningPath[0]);
      await move(page, deal, { type: 'transfer', from: { kind: 'tableau', index: 2 }, to: { kind: 'foundation', index: 0 } }, false);
      await page.waitForTimeout(850);
      for (const cmd of deal.winningPath.slice(1)) await move(page, deal, cmd);
    } else {
      for (const cmd of deal.winningPath.slice(0, 3)) { await move(page, deal, cmd); await page.waitForTimeout(500); }
      await page.waitForTimeout(650); await page.locator('#undo').tap(); await page.waitForTimeout(900);
      for (const cmd of deal.winningPath.slice(2)) await move(page, deal, cmd);
    }
    await page.waitForSelector('#result[open]'); await page.waitForTimeout(800);
    if ((await read(page)).attempt.board.phase !== 'won' || errors.length) throw Error(`${name}: ${errors.join('\n')}`);
    const video = page.video()!; await context.close(); const source = `.recording/modifier-${name}.webm`; await video.saveAs(source);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-vf', 'fps=6,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', `docs/qa/modifier-${name}.gif`]);
    console.info(`Recorded ${name} production touch flow.`);
  }
} finally { await browser.close(); server.httpServer.close(); }
