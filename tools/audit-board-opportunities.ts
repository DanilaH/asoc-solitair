/** Read-only 0.11 board audit. Legal isolated saves; real touch; no scene/card mutation. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { dailyForDay } from '../src/content/daily';
import { dispatch, freshSave, legalCommands, sourceCards } from '../src/domain/engine';
import { boardFrame, cardMetrics, layout } from '../src/game/layout';
import { cueDurations, cueSamples } from '../src/platform/sounds';
import type { BoardCommand, Command, Deal, Save } from '../src/domain/types';

const out = process.env.ASOC_QA_OUT ?? '.recording/board-opportunities-011';
await mkdir(out, { recursive: true });
type Candidate = { deal: Deal; save: Save; cmd: Command };
type Probe = { type: string; at: number; [key: string]: unknown };
function findCase(predicate: (c: Candidate) => boolean): Candidate {
  for (const deal of campaignDeals) {
    let save = freshSave(deal, 'independent-board-audit');
    for (const witness of deal.winningPath) {
      for (const cmd of legalCommands(save.attempt.board, deal)) if (predicate({ deal, save, cmd })) return { deal, save, cmd };
      save = dispatch(save, witness, deal).next;
    }
  }
  throw Error('No legal audit candidate');
}
function prefix(deal: Deal, count: number) {
  return deal.winningPath.slice(0, count).reduce((s, cmd) => {
    const r = dispatch(s, cmd, deal); assert.equal(r.accepted, true); return r.next;
  }, freshSave(deal, 'independent-board-audit'));
}
const merge = findCase(({ deal, save, cmd }) => cmd.type === 'transfer' && cmd.to.kind === 'tableau' &&
  save.attempt.board.tableau[cmd.to.index].length > 0 && sourceCards(save.attempt.board, cmd.from, deal).length >= 2);
const unlock = findCase(({ deal, save, cmd }) => Boolean(deal.lock) && dispatch(save, cmd, deal).events.some(e => e.type === 'unlock'));
const ordered = findCase(({ deal, cmd }) => Boolean(deal.tags?.includes('ordered')) && cmd.type === 'transfer' && cmd.to.kind === 'foundation');
const orderedNext = findCase(({ deal, save, cmd }) => Boolean(deal.tags?.includes('ordered')) && cmd.type === 'transfer' && cmd.to.kind === 'foundation' && sourceCards(save.attempt.board, cmd.from, deal).some(id => Boolean(deal.cards[id].rank)));
const foundation = { deal: campaignDeals[5], save: prefix(campaignDeals[5], 1), cmd: campaignDeals[5].winningPath[1] };
// Preserve the audited light-first opening, independently from the full witness.
const lights: BoardCommand[] = [
  { type: 'transfer', from: { kind: 'tableau', index: 1 }, to: { kind: 'foundation', index: 1 } },
  { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'foundation', index: 1 } },
  { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'foundation', index: 0 } },
  { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'foundation', index: 1 } },
  { type: 'transfer', from: { kind: 'tableau', index: 1 }, to: { kind: 'foundation', index: 1 } },
  { type: 'transfer', from: { kind: 'tableau', index: 1 }, to: { kind: 'foundation', index: 1 } },
];
const completion = { deal: campaignDeals[5], save: lights.slice(0, 5).reduce((s, c) => dispatch(s, c, campaignDeals[5]).next, freshSave(campaignDeals[5], 'independent-board-audit')), cmd: lights[5] };
const dense = campaignDeals.find(d => d.campaignLevel! >= 50 && d.initial.tableau.length === 4)!;
const daily = dailyForDay('2026-11-13');
const jokerDeal = campaignDeals[20];
const cases: { name: string; candidate: Candidate; palette?: 'ink'; bottom?: boolean; drag?: boolean; }[] = [
  { name: 'packet-merge', candidate: merge },
  { name: 'foundation', candidate: foundation },
  { name: 'completion', candidate: completion },
  { name: 'unlock', candidate: unlock },
  { name: 'ordered', candidate: ordered },
  { name: 'dense', candidate: { deal: dense, save: freshSave(dense, 'independent-board-audit'), cmd: dense.winningPath[0] } },
  { name: 'daily', candidate: { deal: daily, save: freshSave(daily, 'independent-board-audit'), cmd: daily.winningPath[0] } },
  { name: 'ink-bottom', candidate: foundation, palette: 'ink', bottom: true },
  { name: 'ordered-next', candidate: orderedNext },
  { name: 'joker', candidate: { deal: jokerDeal, save: freshSave(jokerDeal, 'independent-board-audit'), cmd: { type: 'place-joker', column: 0 } } },
  { name: 'drag-transfer', candidate: foundation, drag: true },
];
const selectedCases = process.env.ASOC_QA_CASES?.split(',');
const server = await preview({ preview: { host: '127.0.0.1', port: 4199, strictPort: true } });
const browser = await chromium.launch();
const report: object[] = [], errors: string[] = [];
try {
  for (const [width, height, reduced] of [[360, 780, false], [320, 568, false], [360, 780, true]] as const) {
    for (const entry of cases) {
      if (selectedCases && !selectedCases.includes(entry.name)) continue;
      const { deal, save: original, cmd } = entry.candidate, label = `${width}-${reduced ? 'reduced' : 'motion'}-${entry.name}`;
      const dir = `${out}/${label}`; await mkdir(dir, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: dir + '/video', size: { width, height } } });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(`${label}: ${e.message}`));
      // Passive diagnostic wrappers record timing only; the production JS bundle
      // and every rule/visual state remain unchanged. Audio is measured, not rated by ear.
      await page.addInitScript(() => {
        const win = window as typeof window & { __boardAudit: Probe[] }; win.__boardAudit = [];
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          const result = set.call(this, key, value);
          if (key === 'asoc-solitaire.save.v1') try { const s = JSON.parse(value); win.__boardAudit.push({ type: 'persist', at: performance.now(), revision: s.revision, moves: s.attempt.board.movesLeft, keys: s.attempt.board.keys, phase: s.attempt.board.phase }); } catch { /* observational */ }
          return result;
        };
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
          const b = this.buffer; let hash = 2166136261;
          if (b) { const data = b.getChannelData(0); for (let i = 0; i < Math.min(2048, data.length); i++) hash = Math.imul(hash ^ Math.round(data[i] * 1e6), 16777619); }
          win.__boardAudit.push({ type: 'audio', at: performance.now(), duration: b?.duration, sampleRate: b?.sampleRate, fingerprint: hash >>> 0 });
          return start.apply(this, args);
        };
      });
      await page.goto('http://127.0.0.1:4199'); await page.locator('#app[data-ready=true]').waitFor();
      const seed = structuredClone(original); seed.settings.sfx = true; seed.settings.reducedMotion = reduced;
      if (entry.palette) seed.settings.palette = entry.palette;
      if (entry.bottom) { seed.settings.deckPosition = 'bottom'; seed.settings.deckSide = 'left'; }
      seed.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, 79).map(d => d.id) };
      seed.campaign = { version: 1, tutorials: ['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used'] };
      await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), seed);
      await page.reload(); await page.locator('#app[data-ready=true]').waitFor();
      const entryButton = deal.daily && await page.locator('#daily-resume-old').isVisible() ? '#daily-resume-old' : deal.daily ? '#daily-play' : '#home-play';
      await page.locator(entryButton).tap(); await page.waitForTimeout(450);
      const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
      const before = await read(); assert.equal(before.attempt.dealId, deal.id);
      const r = (await page.locator('#game-root').boundingBox())!, f = boardFrame(r.width, r.height, before.settings.deckPosition, deal);
      const g = layout(before.attempt.board, deal, f.height, before.settings.deckSide, before.settings.deckPosition);
      const point = (p: { x: number; y: number }) => ({ x: r.x + f.offsetX + p.x * f.unit, y: r.y + p.y * f.unit });
      await page.screenshot({ path: dir + '/before.png', scale: 'css' });
      const cdp = await context.newCDPSession(page), frames: object[] = [], writes: Promise<void>[] = [];
      cdp.on('Page.screencastFrame', frame => {
        const file = `frame-${String(frames.length).padStart(3, '0')}.png`;
        frames.push({ file, epochMs: frame.metadata.timestamp! * 1000 });
        writes.push(writeFile(`${dir}/${file}`, Buffer.from(frame.data, 'base64')));
        void cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => undefined);
      });
      const expected = dispatch(before, cmd, deal); assert.equal(expected.accepted, true);
      let anchors: object;
      await page.evaluate(() => { (window as typeof window & { __boardAudit: Probe[] }).__boardAudit = []; });
      await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
      if (cmd.type === 'transfer') {
        const ids = sourceCards(before.attempt.board, cmd.from, deal), a = point(g.poses.find(p => p.id === ids.at(-1))!), b = point(g.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!);
        anchors = { from: a, target: b, sourceIds: ids, destinationIds: cmd.to.kind === 'tableau' ? before.attempt.board.tableau[cmd.to.index] : before.attempt.board.foundations[cmd.to.index] };
        if (entry.drag) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
          for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 10, y: a.y + (b.y - a.y) * i / 10 }] }); await page.waitForTimeout(15); }
          await page.screenshot({ path: dir + '/selected.png', scale: 'css' });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
          await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(90); await page.screenshot({ path: dir + '/selected.png', scale: 'css' });
          await page.touchscreen.tap(b.x, b.y);
        }
      } else if (cmd.type === 'place-joker') {
        const p = point(g.targets.find(t => t.location.kind === 'tableau' && t.location.index === cmd.column)!); anchors = { target: p };
        await page.locator('#joker').tap(); await page.screenshot({ path: dir + '/selected.png', scale: 'css' }); await page.touchscreen.tap(p.x, p.y);
      } else { anchors = { stock: point(g.stock) }; const p = point(g.stock); await page.touchscreen.tap(p.x, p.y); }
      await page.waitForFunction(rev => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!).revision > rev, before.revision);
      assert.deepEqual((await read()).attempt.board, expected.next.attempt.board);
      await page.waitForTimeout(85); await page.screenshot({ path: dir + '/during.png', scale: 'css' });
      await page.waitForTimeout(800); await cdp.send('Page.stopScreencast');
      await page.screenshot({ path: dir + '/after.png', scale: 'css' });
      const probes = await page.evaluate(() => (window as typeof window & { __boardAudit: Probe[] }).__boardAudit);
      for (const probe of probes.filter(p => p.type === 'audio')) {
        probe.matches = [];
        for (const name of Object.keys(cueDurations)) for (let variant = 0; variant < 3; variant++) {
          let hash = 2166136261; const data = cueSamples(name, Number(probe.sampleRate), variant);
          for (let i = 0; i < Math.min(2048, data.length); i++) hash = Math.imul(hash ^ Math.round(data[i] * 1e6), 16777619);
          if ((hash >>> 0) === probe.fingerprint) (probe.matches as string[]).push(`${name}:${variant}`);
        }
      }
      const value = { label, deal: deal.id, level: deal.campaignLevel, daily: deal.daily, cmd, events: expected.events, boardBounds: r, unit: f.unit, card: cardMetrics(deal), anchors, probes, frames, timing: await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, now: performance.now() })), actualInput: entry.drag ? 'CDP touch drag' : 'touchscreen taps', prepared: 'legal isolated save prefix; helper/tutorial unlock flags; no scene/card positioning' };
      report.push(value); await writeFile(dir + '/events.json', JSON.stringify(value, null, 2) + '\n');
      await cdp.detach(); const video = page.video()!; await context.close(); await video.saveAs(dir + '/actual-touch.webm'); await Promise.all(writes);
      console.info(`${label} ${expected.events.map(e => e.type).join(',')} frames=${frames.length}`);
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(out + '/checks.json', JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), appVersion: '0.11.0', productionBundleUnmodified: true, passiveTimingWrappers: ['Storage.setItem', 'AudioBufferSourceNode.start'], cases: report, errors }, null, 2) + '\n');
} finally { await browser.close(); await new Promise<void>(r => server.httpServer.close(() => r())); }
