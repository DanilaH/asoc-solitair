/** Independent rendered-state audit. Only legal model fixtures + real UI actions. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { dailyForDay } from '../src/content/daily';
import { dispatch, freshSave, sourceCards } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import type { Save } from '../src/domain/types';
const { inspectInitialActions } = await import(pathToFileURL(resolve('tools/qa/critical-actions-check.mjs')).href);
const output = process.env.ASOC_UI_AUDIT_OUT ?? '.recording/all-screen-audit-2026-11-14';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const server = await preview({ preview: { host: '127.0.0.1', port: 4196, strictPort: true } });
const records: object[] = [], errors: object[] = [];
const learned = ['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used'];
function seed(index = 16, kind = 'normal') {
  const deal = kind === 'stale-daily' ? dailyForDay('2026-11-13') : campaignDeals[index];
  let s = freshSave(deal, 'all-screens-audit');
  s.settings.sfx = false; s.settings.reducedMotion = false;
  s.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0,index).map(d=>d.id) };
  s.campaign = { version:1, tutorials:[...learned] };
  for(let level=10;level<=index;level+=10)s.profile.rewards.push('milestone:'+level);
  s.meta!.cycles=Math.floor(index/5);
  if (kind === 'resume' || kind === 'switch') s.meta!.winCycle=3;
  if (kind === 'stale-daily') s=dispatch(s,deal.winningPath[0],deal).next;
  if (kind === 'resume' || kind === 'switch' || kind === 'empty-resume') for (const c of deal.winningPath.slice(0, 3)) s = dispatch(s, c, deal).next;
  if (kind === 'win') { s.meta!.winCycle=4; for (const c of deal.winningPath) s=dispatch(s,c,deal).next; }
  if (kind === 'exhausted') while (s.attempt.board.phase==='playing') s=dispatch(s,{type:s.attempt.board.stock.length?'draw':'recycle'},deal).next;
  if (kind.startsWith('empty')) { s.profile.hints=0;s.profile.undos=0;s.profile.jokers=0;s.profile.coins=0; }
  if (kind === 'large') { s.profile.coins=999999; s.profile.hints=999; s.profile.undos=999; }
  if (kind === 'teach') s.campaign!.tutorials=[];
  if (['resume','switch','empty-resume','stale-daily'].includes(kind)) s.attempt.telemetry={started:true,finished:false,activeMs:1000};
  if (['win','exhausted'].includes(kind)) s.attempt.telemetry={started:true,finished:true,activeMs:1000};
  if (kind === 'modifier') s.campaign!.tutorials=s.campaign!.tutorials.filter(x=>!x.startsWith('intro:'));
  return s;
}
async function load(page: Page, state: Save) {
  if (!page.url().startsWith('http://127.0.0.1:4196')) { await page.goto('http://127.0.0.1:4196'); await page.locator('#app[data-ready=true]').waitFor(); }
  await page.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),state);
  await page.reload(); await page.locator('#app[data-ready=true]').waitFor(); await page.evaluate(()=>document.fonts.ready);
}
const tap = (page: Page, selector: string) => page.locator(selector).tap();
async function enter(page: Page) { await tap(page,'#home-play'); await page.waitForTimeout(350); }
async function cardTap(page: Page) {
  const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save), deal=campaignDeals.find(d=>d.id===s.attempt.dealId)!;
  const r=(await page.locator('#game-root').boundingBox())!, f=boardFrame(r.width,r.height,s.settings.deckPosition,deal),g=layout(s.attempt.board,deal,f.height,s.settings.deckSide,s.settings.deckPosition);
  const id=sourceCards(s.attempt.board,{kind:'tableau',index:0},deal).at(-1),p=g.poses.find(p=>p.id===id)!;
  await page.touchscreen.tap(r.x+p.x*f.unit,r.y+p.y*f.unit);
}
type Entry = { name:string; index?:number; kind?:string; prepare(page:Page):Promise<void>; actions:string[]; };
const entries: Entry[] = [
 {name:'home-fresh',index:0,kind:'teach',prepare:async()=>{},actions:['#home-play','#level-picker-open','#menu']},
 {name:'home-resume',kind:'resume',prepare:async()=>{},actions:['#home-play','#level-picker-open']},
 {name:'home-rich',index:25,prepare:async()=>{},actions:['#home-play','#calendar-open','#looks-open']},
 {name:'home-large-wallet',kind:'large',prepare:async()=>{},actions:['#home-play','#wallet-open']},
 {name:'home-stale-daily',kind:'stale-daily',prepare:async()=>{},actions:['#daily-play','#daily-resume-old']},
 {name:'settings-home',prepare:async p=>{await tap(p,'#menu');},actions:['#settings-done','#settings .close']},
 {name:'settings-play',prepare:async p=>{await enter(p);await tap(p,'#menu');},actions:['#settings-done','#restart','#levels-open']},
 {name:'settings-expanded',prepare:async p=>{await enter(p);await tap(p,'#menu');await tap(p,'#pause-options > summary');},actions:['#settings-done','#appearance-settings','#helpers-open','#settings .close']},
 {name:'appearance-locked',index:0,prepare:async p=>{await tap(p,'#menu');if(await p.locator('#pause-options').getAttribute('open')===null)await tap(p,'#pause-options > summary');await tap(p,'#appearance-settings');},actions:['#appearance-done','#appearance .close']},
 {name:'appearance-unlocked',index:25,prepare:async p=>{await tap(p,'#looks-open');},actions:['#appearance-done','#appearance .close']},
 {name:'helpers-all',index:25,prepare:async p=>{await tap(p,'#wallet-open');},actions:['#helper-return','#helpers .close']},
 {name:'hint-empty',kind:'empty',prepare:async p=>{await enter(p);await tap(p,'#hint');},actions:['#helper-return','#helpers .close']},
 {name:'undo-empty',kind:'empty-resume',prepare:async p=>{await enter(p);await tap(p,'#undo');},actions:['#helper-return','#helpers .close']},
 {name:'level-picker-current',prepare:async p=>{await tap(p,'#level-picker-open');},actions:['#level-picker .close','#level-picker .secondary[data-close]','#chapter-next']},
 {name:'level-picker-locked',prepare:async p=>{await tap(p,'#level-picker-open');await tap(p,'#chapter-next');await tap(p,'#chapter-next');await tap(p,'#chapter-next');},actions:['#level-picker .close','#level-picker .secondary[data-close]','#chapter-prev']},
 {name:'calendar',prepare:async p=>{await tap(p,'#calendar-open');},actions:['#calendar .close','#calendar .primary']},
 {name:'cycle',prepare:async p=>{await tap(p,'#win-cycle-open');},actions:['#cycle-info .close','#cycle-info .primary']},
 {name:'restart-confirm',kind:'resume',prepare:async p=>{await enter(p);await tap(p,'#menu');await tap(p,'#restart');},actions:['#restart-confirm-yes','#restart-confirm button[data-close]']},
 {name:'switch-level',kind:'switch',prepare:async p=>{await tap(p,'#level-picker-open');await tap(p,'#level-5');},actions:['#switch-confirm','#switch-level button[data-close]']},
 {name:'replace-daily',kind:'stale-daily',prepare:async p=>{await tap(p,'#daily-play');},actions:['#replace-daily-yes','#replace-daily button[data-close]']},
 {name:'board-normal',index:5,prepare:enter,actions:['#menu','#inspect','#hint','#undo']},
 {name:'board-dense',index:63,prepare:enter,actions:['#menu','#inspect','#hint','#undo','#joker']},
 {name:'reader-word',prepare:async p=>{await enter(p);await tap(p,'#inspect');await cardTap(p);},actions:['#inspect-dialog .close','#inspect-dialog .primary']},
 {name:'result-win',index:4,kind:'win',prepare:async p=>{await enter(p);await p.locator('#result[open]').waitFor();},actions:['#next-level','#replay','#result-home']},
 {name:'result-unlock',index:19,kind:'win',prepare:async p=>{await enter(p);await p.locator('#result[open]').waitFor();},actions:['#next-level','#apply-unlock','#result-home']},
 {name:'result-final',index:79,kind:'win',prepare:async p=>{await enter(p);await p.locator('#result[open]').waitFor();},actions:['#next-level','#replay']},
 {name:'result-exhausted',kind:'exhausted',prepare:async p=>{await enter(p);await p.locator('#result[open]').waitFor();},actions:['#result-undo','#replay','#result-home']},
 ...[20,22,25].map((index):Entry=>({name:`learn-${index+1}`,index,kind:'modifier',prepare:async p=>{await enter(p);await p.locator('#learn-rule[open]').waitFor();},actions:['#learn-rule .close','#learn-rule .primary']})),
];
try {
 for (const [width,height] of [[320,480],[320,568],[360,780],[393,851]]) {
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();page.setDefaultTimeout(4000);
  page.on('pageerror',e=>errors.push({width,height,error:e.message}));
  for (const e of entries) {
   if(process.env.ASOC_UI_AUDIT_CASES&&!process.env.ASOC_UI_AUDIT_CASES.split(',').includes(e.name))continue;
   const name=`${width}x${height}-${e.name}`;
   try {
    await load(page,seed(e.index??16,e.kind));await e.prepare(page);await page.waitForTimeout(280);
    const expected:Record<string,string>={'restart-confirm':'restart-confirm','switch-level':'switch-level','replace-daily':'replace-daily'};
    if(expected[e.name])await page.locator('#'+expected[e.name]+'[open]').waitFor();
    const initial=await inspectInitialActions(page,e.actions);
    const rounded=await page.evaluate(selectors=>selectors.map((selector:string)=>{
      const nodes=document.querySelectorAll<HTMLElement>(selector);if(nodes.length!==1)return {selector,center:false,interior:false};
      const node=nodes[0],r=node.getBoundingClientRect();const hit=(x:number,y:number)=>{const h=document.elementFromPoint(x,y);return Boolean(h&&(h===node||node.contains(h)));};
      return {selector,radius:getComputedStyle(node).borderRadius,center:hit(r.x+r.width/2,r.y+r.height/2),interior:[[r.x+r.width/2,r.top+3],[r.x+r.width/2,r.bottom-3],[r.left+3,r.y+r.height/2],[r.right-3,r.y+r.height/2]].every(([x,y])=>hit(x,y))};
    }),e.actions);
    for(const a of initial){const r=rounded.find((r:any)=>r.selector===a.selector);if(a.reason==='occluded-or-not-interactive'&&r?.center&&r?.interior){a.roundedCornerOnly=true;a.geometryPassed=true;}}

    const details=await page.evaluate(()=>{
     const root=document.querySelector('dialog[open]')??document.querySelector('#app')!;
     const rect=(e:Element)=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
     return {dialog:document.querySelector('dialog[open]')?.id??null,scrollTop:root.scrollTop,scrollHeight:root.scrollHeight,clientHeight:root.clientHeight,
      buttons:[...root.querySelectorAll<HTMLElement>('button,summary')].filter(e=>e.getClientRects().length).map(e=>({id:e.id,text:e.innerText,disabled:e.matches(':disabled'),rect:rect(e),font:getComputedStyle(e).fontSize})),
      texts:[...root.querySelectorAll<HTMLElement>('h2,p,small')].filter(e=>e.getClientRects().length).map(e=>({text:e.innerText,font:getComputedStyle(e).fontSize,rect:rect(e)}))};
    });
    await page.screenshot({path:`${output}/${name}.png`,scale:'css'});records.push({name,initial,rounded,details});
   } catch (error) {errors.push({name,error:String(error)});await page.screenshot({path:`${output}/${name}-error.png`,scale:'css'});}
  }
  await context.close();console.info(`Captured ${width}x${height}`);
 }
} finally { await browser.close();await new Promise<void>(r=>server.httpServer.close(()=>r())); }
await writeFile(`${output}/screens.json`,JSON.stringify({gameSource:'47c57b6d8d8c81d01c9a945e28b42ba6a37491ca',kitGuidance:'aab9dc8e06bf1b487da9b3a5e67444975e7c8ac0',runtimeKit:'a9325265e87583a4872cf6a158e1e881a0d7508e',records,errors},null,2)+'\n');
console.info(JSON.stringify({screens:records.length,errors,initialActions:records.flatMap((x:any)=>x.initial.filter((a:any)=>!a.passed).map((a:any)=>({screen:x.name,...a})))}));
