import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { introDeal as deal } from '../src/content/intro';
import { packet } from '../src/domain/engine';
import { layout } from '../src/game/layout';
import type { Save } from '../src/domain/types';

await mkdir('docs/qa', { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4179, strictPort: true } });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
    recordVideo: { dir: '.recording/video', size: { width: 360, height: 640 } } });
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4179');
  await page.waitForSelector('#app[data-ready="true"]'); await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/qa/opening.png', scale: 'css' });
  for (const [index, cmd] of deal.winningPath.entries()) {
    const save: Save = await page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!));
    const rect = (await page.locator('canvas').boundingBox())!;
    const metrics = layout(save.attempt.board, deal, rect.height * 540 / rect.width);
    const tap = async (p: { x: number; y: number }) => page.touchscreen.tap(rect.x + p.x * rect.width / 540, rect.y + p.y * rect.width / 540);
    if (cmd.type === 'transfer') {
      const id = cmd.from.kind === 'waste' ? save.attempt.board.waste.at(-1) : packet(save.attempt.board, cmd.from.index, deal).at(-1);
      await tap(metrics.poses.find(p => p.id === id)!);
      await tap(metrics.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!);
    } else await tap(metrics.stock);
    await page.waitForTimeout(320);
    if (index === 10) await page.screenshot({ path: 'docs/qa/midgame.png', scale: 'css' });
  }
  await page.waitForSelector('#result[open]'); await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/qa/result.png', scale: 'css' });
  const won: Save = await page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!));
  if (errors.length || won.attempt.board.phase !== 'won') throw Error(JSON.stringify(errors));
  await page.close(); await context.close();
  await page.video()!.saveAs('docs/qa/first-party.webm');
  console.info('Recorded first party: opening / midgame / result / video; won without assistance.');
} finally {
  await browser.close(); server.httpServer.close();
}
