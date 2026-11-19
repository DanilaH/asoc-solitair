import {test,expect} from '@playwright/test';
import {campaignDeals} from '../../src/content/campaign';
import {dispatch} from '../../src/domain/engine';
import type {BoardCommand} from '../../src/domain/types';
import {readFileSync} from 'node:fs';
import {decodePcm16} from '../../src/platform/recorded-sounds';
import {read,seed,move,fixture} from './wallet-fixture';
type CoinAudio = { at: number; hash: number; rate: number };
const recordedCoins = readFileSync('public/audio/coins-arrive.wav');
const coinCue = decodePcm16(recordedCoins.buffer.slice(recordedCoins.byteOffset, recordedCoins.byteOffset + recordedCoins.byteLength) as ArrayBuffer);
const coinHash = hash(coinCue.samples);
const isCoinCue = (audio: CoinAudio) => audio.rate === coinCue.rate && audio.hash === coinHash;
function hash(data:Float32Array){let h=2166136261;for(let i=0;i<Math.min(2048,data.length);i++)h=Math.imul(h^Math.round(data[i]*1e6),16777619);return h>>>0;}
test('fresh win flies to the real shared wallet, counts smoothly and sounds on arrival; reload does not replay income',async({page})=>{
  await page.addInitScript(()=>{const w=window as any;w.__walletAudio=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){const a=this.buffer?.getChannelData(0);let h=2166136261;if(a)for(let i=0;i<Math.min(2048,a.length);i++)h=Math.imul(h^Math.round(a[i]*1e6),16777619);w.__walletAudio.push({at:performance.now(),hash:h>>>0,rate:this.buffer?.sampleRate ?? 0});return start.apply(this,args);};});
  const s=fixture(4,true),d=campaignDeals[4];await seed(page,s);const before=s.profile.coins;await page.evaluate(()=>{const w=window as any;w.__walletFrames=[];new MutationObserver(()=>{if(document.querySelector<HTMLDialogElement>('#result')!.open&&!w.__resultOpenedAt)w.__resultOpenedAt=performance.now();}).observe(document.querySelector('#result')!,{attributes:true,attributeFilter:['open']});let n=0;const loop=()=>{const coins=document.querySelector('#coins')!;const icon=document.querySelector('#wallet-open .coin-icon')!.getBoundingClientRect();const active=[...document.querySelectorAll('.flying-coin')].filter(e=>getComputedStyle(e).display!=='none'&&+getComputedStyle(e).opacity>.5);w.__walletFrames.push({at:performance.now(),value:Number(coins.textContent),dist:Math.min(999,...active.map(e=>{const r=e.getBoundingClientRect();return Math.hypot(r.x+r.width/2-icon.x-icon.width/2,r.y+r.height/2-icon.y-icon.height/2)}))});if(n++<250)requestAnimationFrame(loop);};requestAnimationFrame(loop);});
  await move(page,d,d.winningPath.at(-1)!);await page.locator('#result[open]').waitFor();const actual=await read(page);await expect(page.locator('#result #wallet-open')).toBeVisible();await expect(page.locator('.coin-gain')).toContainText('+');await expect(page.locator('#coins')).toHaveText(String(actual.profile.coins));
  const frames=await page.evaluate(()=>(window as any).__walletFrames);expect(frames.some((f:any)=>f.value>before&&f.value<actual.profile.coins)).toBe(true);expect(Math.min(...frames.map((f:any)=>f.dist))).toBeLessThan(28);const audio=await page.evaluate(()=>(window as any).__walletAudio);const hits=audio.filter(isCoinCue);expect(hits.length).toBeGreaterThan(0);const openedAt=await page.evaluate(()=>(window as any).__resultOpenedAt);expect(hits.filter((h:any)=>h.at<openedAt).length).toBeLessThanOrEqual(4);expect(hits.filter((h:any)=>h.at>=openedAt).length).toBeLessThanOrEqual(4);const firstIncrease=frames.find((f:any)=>f.value>before);expect(Math.abs(firstIncrease.at-hits[0].at)).toBeLessThan(140);expect(frames.every((f:any,i:number)=>!i||f.value>=frames[i-1].value)).toBe(true);expect(await page.locator('#wallet-open').evaluate(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!h&&(h===e||e.contains(h));})).toBe(true);
  await page.reload();await page.locator('#app[data-ready=true]').waitFor();await page.locator('#home-play').tap();await page.waitForTimeout(1200);expect(await page.locator('.flying-coin:visible').count()).toBe(0);expect((await read(page)).profile).toEqual(actual.profile);await expect(page.locator('#coins')).toHaveText(String(actual.profile.coins));
});
test('streak income shows its exact delta and lands in the same wallet without taking a move for the effect',async({page})=>{
  const d=campaignDeals[16];let s=fixture(16),next:BoardCommand|undefined;
  for(const cmd of d.winningPath){const r=dispatch(s,cmd,d);if(r.events.some(e=>e.type==='coins')&&!r.events.some(e=>e.type==='win')){next=cmd;break;}s=r.next;}if(!next)throw Error('No streak fixture');await seed(page,s);const expected=dispatch(s,next,d).next;await move(page,d,next);await expect(page.locator('.coin-gain')).toHaveText('+'+(expected.profile.coins-s.profile.coins));await expect(page.locator('#coins')).toHaveText(String(expected.profile.coins));expect((await read(page)).attempt.board).toEqual(expected.attempt.board);await page.locator('#menu').tap();await page.locator('#levels-open').tap();await expect(page.locator('#home-progress')).toContainText('из 80');expect((await read(page)).profile).toEqual(expected.profile);
});
test('a delayed streak flight finishes with its sound before the win panel can cancel it', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any, raf = requestAnimationFrame.bind(window);
    w.__slowCoinUntil = 0; w.__coinAudio = [];
    window.requestAnimationFrame = callback => raf(time => {
      const delay = w.__slowCoinUntil - performance.now();
      if (delay > 0) setTimeout(() => callback(performance.now()), delay);
      else callback(time);
    });
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const data = this.buffer?.getChannelData(0); let h = 2166136261;
      if (data) for (let i = 0; i < Math.min(2048, data.length); i++) h = Math.imul(h ^ Math.round(data[i] * 1e6), 16777619);
      w.__coinAudio.push({ at: performance.now(), hash: h >>> 0, rate: this.buffer?.sampleRate ?? 0 });
      return start.apply(this, args);
    };
  });
  const s = fixture(4, true), d = campaignDeals[4], last = d.winningPath.at(-1)!;
  const expected = dispatch(s, last, d); expect(expected.events.some(e => e.type === 'coins')).toBe(true);
  await seed(page, s);
  await page.evaluate(() => {
    const w = window as any;
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.coin-gain')) return;
      w.__slowCoinUntil = performance.now() + 1000; observer.disconnect();
    });
    observer.observe(document.querySelector('#coin-layer')!, { childList: true });
  });
  await move(page, d, last);
  await page.waitForFunction(() => (window as any).__slowCoinUntil > 0);
  await page.waitForFunction(() => performance.now() >= (window as any).__slowCoinUntil - 80);
  await expect(page.locator('#result')).toBeHidden();
  await page.locator('#result[open]').waitFor();
  const trace = await page.evaluate(() => ({ calls: (window as any).__coinAudio as CoinAudio[], until: Number((window as any).__slowCoinUntil) }));
  expect(trace.calls.some(a => isCoinCue(a) && a.at < trace.until + 250)).toBe(true);
  await expect(page.locator('#coins')).toHaveText(String(expected.next.profile.coins));
  expect((await read(page)).profile).toEqual(expected.next.profile);
});
test('skipping win or reduced motion settles counters without losing or minting coins',async({page})=>{
  for(const reduced of [false,true]){const s=fixture(4,true);s.settings.reducedMotion=reduced;await seed(page,s);await move(page,campaignDeals[4],campaignDeals[4].winningPath.at(-1)!);await page.locator('#result[open]').waitFor();const paid=await read(page);await page.locator('#next-level').tap();await expect(page.locator('#coins')).toHaveText(String(paid.profile.coins));await page.waitForTimeout(1000);expect(await page.locator('.flying-coin:visible').count()).toBe(0);expect((await read(page)).profile).toEqual(paid.profile);}
});
test('a final streak and victory show their own amounts without paying the streak twice in the popup', async ({page}) => {
  await page.addInitScript(() => {
    const show = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      if (this.id === 'result') {
        const trace = window as typeof window & { __coinsAtResult?: number };
        trace.__coinsAtResult = Number(document.querySelector('#coins')!.textContent);
      }
      return show.call(this);
    };
  });
  let index = -1;
  for (let i = 4; i < 26; i++) {
    const deal = campaignDeals[i], save = fixture(i, true);
    if (dispatch(save, deal.winningPath.at(-1)!, deal).events.some(e => e.type === 'coins')) { index = i; break; }
  }
  expect(index).toBeGreaterThanOrEqual(0);
  for (const reduced of [false, true]) {
    const deal = campaignDeals[index], save = fixture(index, true), command = deal.winningPath.at(-1)!;
    save.settings.reducedMotion = reduced;
    const result = dispatch(save, command, deal), expected = result.next;
    const core = result.events.filter(e => e.type === 'coins').reduce((n, e) => n + (e.amount ?? 0), 0);
    await seed(page, save);
    await move(page, deal, command);
    await page.locator('#result[open]').waitFor();
    const coinsAtResult = await page.evaluate(() => (window as typeof window & { __coinsAtResult?: number }).__coinsAtResult);
    expect(coinsAtResult).toBe(save.profile.coins + core);
    const award = expected.attempt.payout!.reduce((n, r) => n + r.coins, 0);
    await expect(page.locator('#result-total')).toHaveText('+' + award);
    await expect(page.locator('#coins')).toHaveText(String(expected.profile.coins));
    expect((await read(page)).profile).toEqual(expected.profile);
  }
});
