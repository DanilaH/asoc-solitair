import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium, type Page } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { dailyForDay } from '../src/content/daily';
import { dispatch, freshSave, packet } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import type { BoardCommand, Deal, Save } from '../src/domain/types';
const day = '2026-11-09', read = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
const pause = (p: Page, ms = 700) => p.waitForTimeout(ms);
function profile(level: number) {
  const s = freshSave(campaignDeals[level - 1], `qa-meta-${level}`);
  s.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, level - 1).map(d => d.id) }; return s;
}
async function move(page: Page, deal: Deal, cmd: BoardCommand) {
  await page.waitForSelector(`#app[data-ready="true"][data-presented-deal="${deal.id}"]`);
  const before = await read(page), rect = (await page.locator('#game-root').boundingBox())!, frame = boardFrame(rect.width, rect.height), geo = layout(before.attempt.board, deal, frame.height, before.settings.deckSide);
  const tap = (p: { x: number; y: number }) => page.touchscreen.tap(rect.x + frame.offsetX + p.x * frame.unit, rect.y + p.y * frame.unit);
  if (cmd.type === 'transfer') {
    const id = cmd.from.kind === 'waste' ? before.attempt.board.waste.at(-1) : packet(before.attempt.board, cmd.from.index, deal).at(-1);
    await tap(geo.poses.find(p => p.id === id)!); await tap(geo.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!);
  } else await tap(geo.stock);
  await pause(page, 450);
  if ((await read(page)).attempt.board.movesLeft !== before.attempt.board.movesLeft! - 1) throw Error(`Recording move refused: ${JSON.stringify(cmd)}`);
}
await mkdir('docs/qa', { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4184, strictPort: true } }), browser = await chromium.launch();
try {
  for (const name of ['progress', 'daily', 'appearance'] as const) {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, timezoneId: 'UTC', recordVideo: { dir: '.recording/meta-video', size: { width: 360, height: 640 } } }), page = await context.newPage();
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date(`${day}T12:00:00Z`) });
    await page.goto('http://127.0.0.1:4184'); await page.waitForSelector('#app[data-ready="true"]');
    let save = profile(name === 'progress' ? 10 : name === 'daily' ? 4 : 21);
    if (name === 'progress') { save.meta!.winCycle = 4; for (const cmd of campaignDeals[9].winningPath.slice(0, -2)) save = dispatch(save, cmd, campaignDeals[9]).next; }
    if (name === 'daily') {
      save.meta!.dailyDates = ['2026-11-07', '2026-11-08']; save.meta!.lastDaily = '2026-11-08'; save.meta!.dailyStreak = 2;
      let daily = freshSave(dailyForDay(day), 'qa-day'); for (const cmd of dailyForDay(day).winningPath.slice(0, -2)) daily = dispatch(daily, cmd, dailyForDay(day), day).next;
      save.parked = { daily: daily.attempt };
    }
    if (name === 'appearance') save.attempt = freshSave(campaignDeals[2], 'qa-appearance').attempt;
    await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save); await page.reload(); await page.waitForSelector('#app[data-ready="true"]'); await pause(page);
    await page.screenshot({ path: `docs/qa/meta-${name}.png`, scale: 'css' });
    if (name === 'progress') {
      await page.locator('#home-play').tap(); await pause(page, 900);
      for (const cmd of campaignDeals[9].winningPath.slice(-2)) await move(page, campaignDeals[9], cmd);
      await page.waitForSelector('#result[open]'); await pause(page, 1800); await page.locator('#result-home').tap(); await pause(page);
      await page.locator('#appearance-open').tap(); await pause(page); await page.locator('button[data-palette=ink]').tap(); await pause(page); await page.locator('#appearance .primary').tap(); await pause(page);
    } else if (name === 'daily') {
      const before = save.attempt.id; await page.locator('#daily-play').tap(); await pause(page, 900);
      for (const cmd of dailyForDay(day).winningPath.slice(-2)) await move(page, dailyForDay(day), cmd);
      await page.waitForSelector('#result[open]'); await pause(page, 1400); await page.locator('#next-level').tap(); await page.locator('#calendar-open').tap(); await pause(page, 1400); await page.locator('#calendar .primary').tap();
      await page.locator('#home-play').tap(); await page.waitForSelector('#app[data-ready="true"][data-presented-deal="campaign-004"]'); await pause(page, 1100);
      if ((await read(page)).attempt.id !== before) throw Error('Lost campaign recording state');
    } else {
      await page.locator('#appearance-open').tap(); await pause(page); await page.locator('button[data-palette=ink]').tap(); await page.locator('button[data-card-back=diamonds]').tap(); await page.locator('button[data-deck-side=left]').tap(); await pause(page, 1100);
      await page.screenshot({ path: 'docs/qa/meta-unlocked.png', scale: 'css' }); await page.locator('#appearance .primary').tap(); await page.locator('#home-play').tap(); await pause(page, 1000);
      for (const cmd of campaignDeals[2].winningPath.slice(0, 4)) await move(page, campaignDeals[2], cmd);
      await page.screenshot({ path: 'docs/qa/meta-ink-field.png', scale: 'css' }); await pause(page, 850);
    }
    if (errors.length) throw Error(errors.join('\n'));
    const video = page.video()!; await context.close(); const source = `.recording/meta-${name}.webm`; await video.saveAs(source);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-vf', 'fps=6,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', `docs/qa/meta-${name}.gif`]);
    console.info(`Recorded production ${name} flow.`);
  }
} finally { await browser.close(); server.httpServer.close(); }
