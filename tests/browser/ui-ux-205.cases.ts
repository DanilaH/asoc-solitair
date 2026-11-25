import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { findDeal, integratedCampaignDeals } from '../../src/content/campaign';
import { content8Dealer, content8Wave, content8Late } from '../../src/content/campaign-v8-dealer';
import { content8Special } from '../../src/content/campaign-v8-special';
import { coreSpecialDeals } from '../../src/content/campaign-v8-integrated-specials';
import { content8BonusDeals } from '../../src/content/campaign-v8-bonus';
import { dailyForDay } from '../../src/content/daily';
import { freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { openDailyBonusRound, revealDailyBonusCard } from '../../src/domain/events/daily-bonus';
import type { Deal, Save } from '../../src/domain/types';
import { read } from './wallet-fixture';
import { boardFrame, layout } from '../../src/game/layout';

const KEY='asoc-solitaire.save.v1';
const baseline = process.env.ASOC_UI_205_BASELINE === '1';
const bank=[...coreSpecialDeals,...content8BonusDeals,...content8Special,...content8Dealer,...content8Wave,...content8Late];
const chosen=(level:number):Deal => integratedCampaignDeals.find(d=>d.campaignLevel===level&&d.id.endsWith('-rights-r1')&&(level===30?d.shuffleCost==='charge':true)&&!d.adaptive)
  ?? bank.find(d=>d.campaignLevel===level)!;
function profile(deal:Deal,id:string):Save {
  const s=freshSave(deal,id);s.contentVersion=8;s.settings.reducedMotion=false;s.settings.sfx=true;
  s.campaign={version:1,tutorials:['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','learn:covered-waste','hint-demo','hint-practiced','undo-used','joker-buffer']};
  s.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:Array.from({length:(deal.campaignLevel??1)-1},(_,i)=>campaignId(i+1))};
  return s;
}
async function seed(page:Page,s:Save) {
  if(!page.url().startsWith('http://127.0.0.1:4173'))await page.goto('/');
  await page.locator('#app[data-ready=true]').waitFor();
  await page.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:KEY,save:s});
  await page.reload();await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  await page.evaluate(()=>document.fonts.ready);
}
async function enter(page:Page,deal:Deal) {
  await page.locator('#home-play').tap();
  if(await page.locator('#difficulty-play').isVisible())await page.locator('#difficulty-play').tap();
  if(await page.locator('#learn-rule').isVisible())await page.locator('#learn-rule .primary').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal',deal.id);
  await page.waitForTimeout(850);
}
async function manifest(page:Page) {
  const response=await page.request.get('/release-manifest.json');expect(response.ok()).toBe(true);
  const value=await response.json();
  expect(value).toMatchObject({id:'c8-release-v1',contentVersion:8,capabilities:{proofShuffle:'active',bonusSlots:'active',frozenBoundPuzzleGoldenStarter:'active',purchases:'off'}});
  if (baseline) expect(value.commit).toBe('5039f1fbafcfebc399e36141826cc9ca6a59fe5d');
  return value.commit;
}

// Raster-derived connected components, without invoking our geometry or game bridge.
async function paintedComponents(png:Buffer) {
  const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h,channels}=info,seen=new Uint8Array(w*h),out:{type:string;left:number;top:number;width:number;height:number;pixels:number}[]=[];
  const kind=(i:number)=>{const j=i*channels,r=data[j],g=data[j+1],b=data[j+2];return Math.abs(r-237)+Math.abs(g-187)+Math.abs(b-141)<15?1:r>248&&g>230&&b>200?2:0};
  for(let start=0;start<w*h;start++) {
    const color=kind(start);if(!color||seen[start])continue;
    const stack=[start];seen[start]=1;let left=w,right=0,top=h,bottom=0,pixels=0;
    while(stack.length){const i=stack.pop()!,x=i%w,y=Math.floor(i/w);pixels++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&kind(j)===color){seen[j]=1;stack.push(j);}
    }
    if(pixels>=30&&right-left>=10)out.push({type:color===1?'title':'card-face',left,top,width:right-left+1,height:bottom-top+1,pixels});
  }
  return out;
}
test.describe('205 C8 independent screen evidence',()=>{
  test.skip(process.env.VITE_ASOC_PROFILE!=='c8-release-v1','Requires exact ordinary C8 runtime');
  const cases=[
    {w:320,h:480,l:16,b:60},{w:360,h:640,l:30,b:0},{w:320,h:568,l:1,b:0},
    {w:360,h:780,l:22,b:60},{w:393,h:851,l:40,b:0},{w:412,h:915,l:80,b:90},
    {w:520,h:700,l:19,b:0},{w:768,h:1024,l:24,b:0},
    ...[2,3,8,17,18,21,26,27,28,32,33,36,39,45,49,66,76].map(l=>({w:360,h:640,l,b:l%2?60:0})),
  ];
  for(const {w,h,l,b} of cases)test(`205 capture L${l} ${w}x${h} banner${b}`,async({page},info)=>{
    await page.setViewportSize({width:w,height:h});
    const deal=chosen(l),s=profile(deal,'ui205-'+l);s.profile.coins=500;
    // Both stock sides and heights are actual persisted player settings.
    if(l%2)s.settings.deckSide='left';
    if(l%3===0)s.settings.deckPosition='bottom';
    await seed(page,s);const commit=await manifest(page);
    await page.screenshot({path:info.outputPath('home.png'),scale:'css'});
    const home=await page.locator('#home-play').boundingBox();expect(home!.y+home!.height).toBeLessThanOrEqual(h+1);
    await enter(page,deal);
    if(b)await page.locator('#banner-slot').evaluate((slot,height)=>{slot.removeAttribute('hidden');(slot as HTMLElement).style.height=height+'px'},b);
    await page.waitForTimeout(350);
    const field=page.locator('#game-root'),area=(await field.boundingBox())!;
    const inspect=(await page.locator('#inspect').boundingBox())!;
    await page.screenshot({path:info.outputPath('field.png'),scale:'css'});
    const png=await field.screenshot({path:info.outputPath('field-raster.png'),scale:'css'});
    const img=await sharp(png).metadata();
    const components=await paintedComponents(png);
    const computed=await page.evaluate(()=>({
      adjust:getComputedStyle(document.documentElement).getPropertyValue('-webkit-text-size-adjust'),
      dpr:devicePixelRatio,scroll:[scrollX,scrollY],dock:document.querySelector('#dock')!.getBoundingClientRect().toJSON(),
      bonus:[...document.querySelectorAll<HTMLElement>('.board-bonus:not([hidden])')].map(e=>({id:e.id,rect:e.getBoundingClientRect().toJSON()}))
    }));
    if (!baseline) {
    expect(computed.adjust).toBe('100%');
    expect(inspect.width).toBeGreaterThanOrEqual(43.9);expect(inspect.height).toBeGreaterThanOrEqual(43.9);
    expect(computed.dock.bottom).toBeLessThanOrEqual(h+1);expect(area.y+area.height).toBeLessThanOrEqual(computed.dock.top+1);
    for(const item of computed.bonus){
      expect(Math.abs(item.rect.height-item.rect.width*166/138)).toBeLessThanOrEqual(1);
      expect(item.rect.left).toBeGreaterThanOrEqual(area.x-1);expect(item.rect.right).toBeLessThanOrEqual(area.x+area.width+1);
    }
    }
    const evidence={commit,dealId:deal.id,viewport:{w,h},banner:b,area,inspect,image:{width:img.width,height:img.height},components,...computed};
    await writeFile(info.outputPath('measurements.json'),JSON.stringify(evidence,null,2));
    await info.attach('actual viewport and measured controls',{path:info.outputPath('measurements.json'),contentType:'application/json'});
    if([1,16,19,22,24,30,40,80].includes(l)){
      await page.locator('#wallet-open').tap();await expect(page.locator('#helpers')).toBeVisible();
      await page.screenshot({path:info.outputPath('helpers.png'),scale:'css'});
      await page.locator('#helper-return').tap();
      await page.locator('#menu').tap();await page.screenshot({path:info.outputPath('settings.png'),scale:'css'});
    }
  });
  for(const viewport of [{width:320,height:480},{width:360,height:640}])test('205 raw stock jitter and cancellation '+viewport.width+'x'+viewport.height,async({page,context},info)=>{
    test.skip(baseline,'Candidate-only behavior assertion');
    await page.setViewportSize(viewport);const deal=findDeal('campaign-c8-wave-016-c8-core-r1-rights-r1')!,s=profile(deal,'ui205-jitter');
    await seed(page,s);await manifest(page);await enter(page,deal);
    if(viewport.height===480)await page.locator('#banner-slot').evaluate(slot=>{slot.removeAttribute('hidden');(slot as HTMLElement).style.height='60px'});
    await page.waitForTimeout(250);
    const area=(await page.locator('#game-root').boundingBox())!,before=await read(page);
    const frame=boardFrame(area.width,area.height,before.settings.deckPosition,deal);
    const stock=layout(before.attempt.board,deal,frame,before.settings.deckSide,before.settings.deckPosition).stock;
    const p={x:area.x+frame.offsetX+stock.x*frame.unit,y:area.y+stock.y*frame.unit};
    const c=await context.newCDPSession(page);
    const gesture=async(delta:number,cancel=false)=>{
      await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
      await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-delta,y:p.y}]});
      await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});
      await c.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
    };
    await gesture(12);await page.waitForTimeout(120);
    expect((await read(page)).attempt.board).toEqual(before.attempt.board);
    await gesture(6,true);await page.waitForTimeout(120);
    expect((await read(page)).attempt.board).toEqual(before.attempt.board);
    await gesture(6);
    await expect.poll(async()=>(await read(page)).attempt.board.stock.length).toBe(before.attempt.board.stock.length-1);
    await expect.poll(async()=>(await read(page)).attempt.undo.length).toBe(before.attempt.undo.length+1);
    await page.waitForTimeout(400);await page.screenshot({path:info.outputPath('draw.png'),scale:'css'});
    await page.locator('#undo').tap();
    await expect.poll(async()=>(await read(page)).attempt.board).toEqual(before.attempt.board);await c.detach();
  });
  test('205 Bonus cards show committed matches and ready shortcut, no face-down prize leakage',async({page},info)=>{
    test.skip(baseline,'Candidate-only behavior assertion');
    await page.setViewportSize({width:320,height:480});
    const deal=chosen(3),s=profile(deal,'ui205-bonus');
    const now=Date.now(),round=openDailyBonusRound(s,now,'ui205-bonus-round',()=>0)!;
    const matches=round.slots.flatMap((column,i)=>column===0?[i]:[]);
    revealDailyBonusCard(s,round.roundId,matches[0],now);
    await seed(page,s);await manifest(page);
    await page.locator('#daily-bonus-open').tap();
    await expect(page.locator('#daily-bonus-match')).toHaveText('Совпадения: 1/3');
    await expect(page.locator('.bonus-card[data-revealed="false"]')).toHaveCount(11);
    const hidden=await page.locator('.bonus-card[data-revealed="false"]').allTextContents();
    expect(hidden.every(t=>t==='?Открыть')).toBe(true);
    await page.screenshot({path:info.outputPath('bonus-1.png'),scale:'css'});
    for(const [i,n] of matches.slice(1).entries()){
      await page.locator('#daily-bonus-cards button').nth(n).tap();
      await expect(page.locator('#daily-bonus-match')).toHaveText('Совпадения: '+(i+2)+'/3');
      await expect(page.locator('.bonus-card[data-match="'+(i+2)+'"]')).toHaveCount(i+2);
      await page.waitForTimeout(220);
      await page.screenshot({path:info.outputPath('bonus-'+(i+2)+'.png'),scale:'css'});
    }
    const close=(await page.locator('#daily-bonus-dialog .sheet-actions [data-close]').boundingBox())!;
    expect(close.y+close.height).toBeLessThanOrEqual(480);
    await page.locator('#daily-bonus-dialog .sheet-actions [data-close]').tap();
    await expect(page.locator('#home-bonus-ready')).toBeVisible();
    await page.reload();await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
    await page.locator('#home-bonus-ready').tap();await expect(page.locator('#daily-bonus-match')).toHaveText('Совпадения: 3/3');
    expect((await read(page)).dailyBonus?.revealed).toEqual(matches);
    expect((await read(page)).profile.coins).toBe(s.profile.coins);
  });
});
