import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, freshSave } from '../../src/domain/engine';
import type { Save } from '../../src/domain/types';

const key = 'asoc-solitaire.save.v1';
const learned = ['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used'];
const read = (p: Page) => p.evaluate(k => JSON.parse(localStorage.getItem(k)!) as Save, key);
function profile(index = 16, won = false) {
  const deal = campaignDeals[index]; let s = freshSave(deal, 'ui-coherence');
  s.settings.sfx = false;
  s.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0,index).map(d=>d.id) };
  s.campaign = { version:1, tutorials:[...learned] };
  for (let level=10;level<=index;level+=10) s.profile.rewards.push('milestone:'+level);
  if (won) { s.meta!.winCycle=4; for(const cmd of deal.winningPath) s=dispatch(s,cmd,deal).next; s.attempt.telemetry={started:true,finished:true,activeMs:1000}; }
  return s;
}
async function seed(p:Page,s:Save) {
  await p.goto('/'); await p.locator('#app[data-ready=true]').waitFor();
  await p.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s});
  await p.reload(); await p.locator('#app[data-ready=true]').waitFor(); await p.evaluate(()=>document.fonts.ready);
}
// Reuse the initial-action probe, then verify real interior points on rounded buttons.
async function action(p:Page, selector:string) {
  const modulePath = '../../tools/qa/critical-actions-check.mjs';
  const {inspectInitialActions} = await import(modulePath);
  const [probe] = await inspectInitialActions(p,[selector],{minimumCssSize:44});
  if (!probe.passed) await p.screenshot({path:test.info().outputPath('action-failure.png'),scale:'css'});
  if (!probe.passed) expect(probe.reason,selector+' '+JSON.stringify(probe)).toBe('occluded-or-not-interactive');
  const actual = await p.locator(selector).evaluate(node=>{
    const r=node.getBoundingClientRect(); const points=[[r.x+r.width/2,r.y+r.height/2],[r.x+r.width/2,r.top+4],[r.x+r.width/2,r.bottom-4],[r.left+4,r.y+r.height/2],[r.right-4,r.y+r.height/2]];
    return {x:r.x+r.width/2,y:r.y+r.height/2,hit:points.every(([x,y])=>{const h=document.elementFromPoint(x,y);return !!h&&(h===node||node.contains(h));})};
  });
  expect(actual.hit,selector).toBe(true); return actual;
}
for(const [width,height] of [[320,480],[320,568],[360,780],[393,851]]) {
  test(`dialog actions stay reachable before scroll at ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height}); await seed(page,profile(25));
    for(const [open,close] of [['#looks-open','#appearance-done'],['#wallet-open','#helper-return'],['#calendar-open','#calendar .sheet-actions button'],['#level-picker-open','#level-picker .sheet-actions button']]) {
      await page.locator(open).tap(); await page.waitForTimeout(250);
      const point=await action(page,close); await action(page,'dialog[open] .close');
      const body=page.locator('dialog[open] .sheet-body');
      await body.evaluate(e=>{e.scrollTop=e.scrollHeight;});
      const after=await action(page,close); expect(after.y).toBeCloseTo(point.y,0);
      await page.touchscreen.tap(after.x,after.y); await expect(page.locator('dialog[open]')).toHaveCount(0);
    }
    await page.locator('#level-picker-open').tap();await page.locator('#chapter-next').tap();
    const back=await action(page,'#level-picker .sheet-actions button');await action(page,'#level-picker .close');await page.touchscreen.tap(back.x,back.y);
    await action(page,'#home-play');await action(page,'#level-picker-open');await action(page,'#calendar-open');
    await seed(page,profile(9,true));await page.locator('#home-play').tap();await page.locator('#result[open]').waitFor();await page.waitForTimeout(250);
    for(const selector of ['#next-level','#replay','#result-home','#apply-unlock'])await action(page,selector);
    await expect(page.locator('#apply-unlock')).toHaveCSS('min-height','44px');
  });
}
test('enlarged text leaves modal exits and continuation available',async({page})=>{
  await page.setViewportSize({width:320,height:568});await seed(page,profile(25));
  for(const [open,close] of [['#looks-open','#appearance-done'],['#wallet-open','#helper-return'],['#calendar-open','#calendar .sheet-actions button']]){
    await page.locator(open).tap();await page.waitForTimeout(250);
    await page.locator('dialog[open]').evaluate(root=>{
      const nodes=[...root.querySelectorAll<HTMLElement>('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim()));
      const sizes=nodes.map(e=>parseFloat(getComputedStyle(e).fontSize));nodes.forEach((e,i)=>e.style.fontSize=sizes[i]*1.5+'px');
    });
    const point=await action(page,close);await action(page,'dialog[open] .close');await page.touchscreen.tap(point.x,point.y);
  }
});
test('fifth-win receipt remains visible and cannot grant twice after reload or presentation interruption',async({page})=>{
  const s=profile(4,true);await seed(page,s);await page.locator('#home-play').tap();
  await expect(page.locator('#result-bonus')).toBeVisible();await expect(page.locator('#result-bonus')).toContainText('5 / 5');await expect(page.locator('#result-bonus-copy')).toHaveText('Получено: +20 монет и +1 подсказка');
  const paid=await read(page);expect(paid.profile.hints).toBe(4);
  await page.reload();await page.locator('#app[data-ready=true]').waitFor();await page.locator('#home-play').tap();await expect(page.locator('#result-bonus')).toBeVisible();expect((await read(page)).profile).toEqual(paid.profile);
  const next=await action(page,'#next-level');await page.touchscreen.tap(next.x,next.y);await expect(page.locator('#result')).toBeHidden();await page.waitForTimeout(1000);
  expect(await page.locator('.flying-coin:visible').count()).toBe(0);expect((await read(page)).profile).toEqual(paid.profile);
});
test('real result coins avoid title, amount and next action; reduced motion is immediate',async({page})=>{
  for(const index of [4,9])for(const reduced of [false,true]){
    await page.setViewportSize({width:320,height:568});
    const s=profile(index,true);s.settings.reducedMotion=reduced;await seed(page,s);
    await page.evaluate(()=>{
      const w=window as typeof window&{__coinAudit:{seen:number;overlap:number;frames:number;examples:object[]}};w.__coinAudit={seen:0,overlap:0,frames:0,examples:[]};let count=0;
      const step=()=>{const coins=[...document.querySelectorAll('.flying-coin')].filter(c=>getComputedStyle(c).display!=='none'&&Number(getComputedStyle(c).opacity)>.1);w.__coinAudit.seen+=coins.length;w.__coinAudit.frames++;
        for(const coin of coins){const c=coin.getBoundingClientRect();for(const selector of ['#result-title','#result-total','#next-level']){const e=document.querySelector(selector);if(!e?.getClientRects().length)continue;const r=e.getBoundingClientRect();if(c.left<r.right&&c.right>r.left&&c.top<r.bottom&&c.bottom>r.top){w.__coinAudit.overlap++;if(w.__coinAudit.examples.length<4)w.__coinAudit.examples.push({selector,c:c.toJSON(),r:r.toJSON()});}}}
        if(count++<110)requestAnimationFrame(step);};requestAnimationFrame(step);
    });
    await page.locator('#home-play').tap();await page.locator('#result[open]').waitFor();await page.waitForTimeout(1800);
    const audit=await page.evaluate(()=>(window as typeof window&{__coinAudit:{seen:number;overlap:number;frames:number;examples:object[]}}).__coinAudit);
    expect(audit.frames).toBeGreaterThan(30);expect(audit.overlap,JSON.stringify(audit)).toBe(0);if(reduced)expect(audit.seen).toBe(0);else expect(audit.seen).toBeGreaterThan(0);
    await expect(page.locator('#result-bonus')).toBeVisible();expect((await read(page)).profile).toEqual(s.profile);
  }
});
test('startup retry rereads the untouched save and a persistent bad save is never reset',async({page})=>{
  const original=JSON.stringify(profile());
  await page.addInitScript(({key,original})=>{
    if(!sessionStorage.getItem('startup-fixture')){localStorage.setItem(key,original);sessionStorage.setItem('startup-fixture','1');}
    if(!sessionStorage.getItem('read-failed')){const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===key){sessionStorage.setItem('read-failed','1');throw Error('temporary read');}return get.call(this,k);};}
  },{key,original});
  await page.goto('/');await page.locator('.fatal').waitFor();await expect(page.locator('#app')).toBeHidden();await expect(page.locator('.fatal details')).not.toHaveAttribute('open','');
  const point=await action(page,'#startup-retry');expect(await page.evaluate(k=>localStorage.getItem(k),key).catch(()=>null)).toBeNull(); // Injected adapter still rejects reads.
  await page.touchscreen.tap(point.x,point.y);await page.locator('#app[data-ready=true]').waitFor();expect((await read(page)).profile).toEqual(JSON.parse(original).profile);expect((await read(page)).attempt).toEqual(JSON.parse(original).attempt);
  await page.evaluate(k=>localStorage.setItem(k,'broken-original'),key);await page.reload();await page.locator('.fatal').waitFor();await page.locator('#startup-retry').tap();await page.locator('.fatal').waitFor();expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('broken-original');await expect(page.locator('#startup-retry')).toBeEnabled();
});
test('slow real Hint reports pending, charges once and clears its label after success',async({page})=>{
  await page.addInitScript(()=>{const Native=Worker;window.Worker=class extends Native{set onmessage(fn:((this:Worker,e:MessageEvent)=>unknown)|null){if(fn)super.addEventListener('message',e=>setTimeout(()=>fn.call(this,e),1200));}get onmessage(){return null;}};});
  await seed(page,profile(5));await page.locator('#home-play').tap();const before=await read(page),rect=await page.locator('#hint').boundingBox();
  await page.locator('#hint').tap();await expect(page.locator('#hint')).toHaveAttribute('aria-busy','true');await expect(page.locator('#hint-label')).toHaveText('Ищу…');await expect(page.locator('#hint')).toBeDisabled();expect((await read(page)).profile.hints).toBe(before.profile.hints);expect(await page.locator('#hint').boundingBox()).toEqual(rect);
  await expect.poll(async()=>(await read(page)).profile.hints).toBe(before.profile.hints-1);await expect(page.locator('#hint')).toHaveAttribute('aria-busy','false');await expect(page.locator('#hint-label')).toHaveText('Повторить');expect((await read(page)).attempt.board).toEqual(before.attempt.board);
});
test('Hint errors, timeout and a modal interruption leave charges untouched and restore idle state',async({browser})=>{
  for(const mode of ['error','timeout','modal']){
    const context=await browser.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true});const p=await context.newPage();
    if(mode==='error')await p.route('**/assets/hint.worker-*.js',route=>route.abort());
    else await p.addInitScript(mode=>{const Native=Worker;window.Worker=class extends Native{set onmessage(fn:((this:Worker,e:MessageEvent)=>unknown)|null){if(fn&&mode==='modal')super.addEventListener('message',e=>setTimeout(()=>fn.call(this,e),1100));}get onmessage(){return null;}};},mode);
    await seed(p,profile(5));await p.locator('#home-play').tap();const before=await read(p);await p.locator('#hint').tap();
    if(mode==='modal'){await p.locator('#menu').tap();await p.waitForTimeout(1500);await p.locator('#settings-done').tap();}
    await expect(p.locator('#hint')).toHaveAttribute('aria-busy','false',{timeout:6500});await expect(p.locator('#hint-label')).toHaveText('Подсказка');expect((await read(p)).profile).toEqual(before.profile);expect((await read(p)).attempt.board).toEqual(before.attempt.board);
    if(mode==='error')await expect(p.locator('#message')).toContainText('Не удалось');
    if(mode==='timeout')await expect(p.locator('#message')).toContainText('не потрачена');
    await context.close();
  }
});
test('live result text reflow cancels old coin coordinates without touching the owned payout',async({page})=>{
  const s=profile(4,true);await seed(page,s);await page.locator('#home-play').tap();await page.locator('#result[open]').waitFor();
  await expect.poll(()=>page.locator('.flying-coin:visible').count()).toBeGreaterThan(0);
  await page.locator('#result-title').evaluate(e=>{e.style.fontSize='42px';});
  await expect.poll(()=>page.locator('.flying-coin:visible').count()).toBe(0);
  await page.waitForTimeout(800);expect(await page.locator('.flying-coin:visible').count()).toBe(0);expect((await read(page)).profile).toEqual(s.profile);
  await action(page,'#next-level');
});
