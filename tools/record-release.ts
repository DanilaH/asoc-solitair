import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium, type Page } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { dailyForDay } from '../src/content/daily';
import { freshSave, packet, dispatch } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import type { Save, Deal, BoardCommand } from '../src/domain/types';
const read = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
const wait = (p: Page, n = 650) => p.waitForTimeout(n);
function fixture(level: number) {
  const s = freshSave(campaignDeals[level - 1], `qa-release-${level}`); s.meta!.winCycle = 3;
  s.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, level - 1).map(d => d.id) };
  for (let n = 10; n < level; n += 10) s.profile.rewards.push(`milestone:${n}`); return s;
}
async function move(page: Page, deal: Deal, cmd: BoardCommand) {
  await page.waitForSelector(`#app[data-ready="true"][data-presented-deal="${deal.id}"]`);
  const s = await read(page), r = (await page.locator('#game-root').boundingBox())!, f = boardFrame(r.width, r.height), g = layout(s.attempt.board, deal, f.height, s.settings.deckSide);
  const tap = (p: {x: number; y: number}) => page.touchscreen.tap(r.x + f.offsetX + p.x * f.unit, r.y + p.y * f.unit);
  if (cmd.type === 'transfer') { const id = cmd.from.kind === 'waste' ? s.attempt.board.waste.at(-1) : packet(s.attempt.board, cmd.from.index, deal).at(-1); await tap(g.poses.find(p => p.id === id)!); await tap(g.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!); } else await tap(g.stock);
  await wait(page, 360); if ((await read(page)).attempt.board.movesLeft !== s.attempt.board.movesLeft! - 1) throw Error('Recording refused move');
}
await mkdir('docs/qa', { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4185, strictPort: true } }), browser = await chromium.launch();
try {
  for (const name of ['bank','ordered','safety'] as const) {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, timezoneId: 'UTC', recordVideo: { dir: '.recording/release-video', size: { width: 360, height: 640 } } }), page = await context.newPage();
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.clock.install({ time: new Date('2026-11-09T14:00:00Z') });
    await page.goto('http://127.0.0.1:4185'); await page.waitForSelector('#app[data-ready="true"]');
    const level = name === 'bank' ? 27 : name === 'ordered' ? 30 : 4;
    let save = fixture(level);
    if (name === 'ordered') for (const cmd of campaignDeals[level - 1].winningPath.slice(0, -7)) save = dispatch(save, cmd, campaignDeals[level - 1]).next;
    await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save); await page.reload(); await page.waitForSelector('#app[data-ready="true"]'); await wait(page);
    if (name === 'bank') {
      await page.locator('#level-picker-open').tap(); await wait(page);
      await page.screenshot({ path: 'docs/qa/release-chapters.png', scale: 'css' });
      await page.locator('#chapter-next').tap(); await wait(page, 450); await page.locator('#chapter-next').tap(); await wait(page, 600);
      await page.locator('#chapter-prev').tap(); await page.locator('#chapter-prev').tap(); await page.locator('#level-picker [data-close]').first().tap(); await page.locator('#home-play').tap(); await wait(page, 900);
      await page.screenshot({ path: 'docs/qa/release-new-topics.png', scale: 'css' }); for (const cmd of campaignDeals[26].winningPath) await move(page, campaignDeals[26], cmd); await page.waitForSelector('#result[open]'); await wait(page, 1100);
    } else if (name === 'ordered') {
      await page.locator('#home-play').tap(); await wait(page, 900); await page.screenshot({ path: 'docs/qa/release-rainbow.png', scale: 'css' });
      for (const cmd of campaignDeals[level - 1].winningPath.slice(-7)) await move(page, campaignDeals[level - 1], cmd);
      await page.waitForSelector('#result[open]'); await wait(page, 1300);
    } else {
      await page.locator('#home-play').tap(); await wait(page, 900); await move(page, campaignDeals[3], campaignDeals[3].winningPath[0]);
      const before = (await read(page)).attempt.id;
      await page.locator('#menu').tap(); await page.locator('#restart').tap(); await wait(page, 1000); await page.locator('#restart-confirm [data-close]').tap();
      if ((await read(page)).attempt.id !== before) throw Error('Cancel restarted attempt');
      await page.locator('#menu').tap(); await page.locator('#levels-open').tap(); await page.locator('#daily-play').tap(); await wait(page, 900); await move(page, dailyForDay('2026-11-09'), dailyForDay('2026-11-09').winningPath[0]);
      await page.clock.setSystemTime(new Date('2026-11-10T10:00:00Z')); await page.locator('#menu').tap(); await page.locator('#levels-open').tap();
      await page.locator('#daily-resume-old').tap(); await wait(page, 1100); await page.screenshot({ path: 'docs/qa/release-training.png', scale: 'css' });
      await page.locator('#menu').tap(); await page.locator('#levels-open').tap(); await page.locator('#daily-play').tap(); await page.waitForSelector('#replace-daily[open]'); await wait(page, 1100);
      await page.locator('#replace-daily [data-close]').tap(); await wait(page);
    }
    if (errors.length) throw Error(errors.join('\n'));
    const video = page.video()!; await context.close(); const source = `.recording/release-${name}.webm`; await video.saveAs(source);
    execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-i',source,'-vf','fps=12,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',`docs/qa/release-${name}.gif`]); console.info(`Recorded ${name}.`);
  }
} finally { await browser.close(); server.httpServer.close(); }
