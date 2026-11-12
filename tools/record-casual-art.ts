import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { campaignDeals } from '../src/content/campaign';
import { introDeal } from '../src/content/intro';
import { freshSave, dispatch, isLocked } from '../src/domain/engine';
import { boardFrame, cardMetrics, layout } from '../src/game/layout';
import { illustrationUrl } from '../src/game/art';
import type { Deal, Save } from '../src/domain/types';

// Presentation QA only: every seed is reached through a frozen deal's witness.
// Capture real canvas cards and the normal reader; no runtime debug bridge.
const output=resolve(process.env.ASOC_ART_OUTPUT??'.recording/casual-art-evidence');
const baseline=process.env.ASOC_ART_BASELINE&&resolve(process.env.ASOC_ART_BASELINE);
if(baseline)await access(baseline);
await mkdir(output,{recursive:true});
type Case={subject:string;title:string;id:string;deal:Deal;save:Save};
const cases=new Map<string,Case>();
for(const deal of [introDeal,...campaignDeals]){
 let save=freshSave(deal,'casual-subject-gallery');
 const collect=()=>{
  if(save.attempt.board.phase!=='playing')return;
  const ids=save.attempt.board.tableau.flatMap((column,i)=>isLocked(save.attempt.board,i,deal)?[]:column.slice(-1)).concat(save.attempt.board.waste.slice(-1));
  for(const id of ids){const card=deal.cards[id];if(!card?.image)continue;
   const subject=illustrationUrl(card.image).split('/').at(-1)!.replace(/\.webp$/,'');
   if(!cases.has(subject))cases.set(subject,{subject,title:card.text,id,deal,save:structuredClone(save)});
  }
 };
 collect();for(const action of deal.winningPath){save=dispatch(save,action,deal).next;collect();}
 if(cases.size===33)break;
}
if(cases.size!==33)throw Error('Reachable subjects found: '+cases.size);
const server=await preview({preview:{host:'127.0.0.1',port:4193,strictPort:true},build:{outDir:process.env.ASOC_QA_DIST??'dist'}});
const browser=await chromium.launch(),errors:string[]=[],captures:object[]=[];
try{
 const variants=[...(baseline?[{width:360,height:780,variant:'before'}]:[]),{width:360,height:780,variant:'after'},{width:320,height:568,variant:'after'}];
 for(const {width,height,variant}of variants){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  if(variant==='before')await page.route('**/art/generated/*.webp',route=>{
   const name=new URL(route.request().url()).pathname.split('/').at(-1)!;
   return route.fulfill({path:resolve(baseline!,name),contentType:'image/webp'});
  });
  await page.goto('http://127.0.0.1:4193');await page.locator('#app[data-ready=true]').waitFor();
  for(const c of cases.values()){
   const seed=structuredClone(c.save);seed.settings.reducedMotion=true;
   seed.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:campaignDeals.slice(0,(c.deal.campaignLevel??1)-1).map(d=>d.id)};
   seed.campaign={version:1,tutorials:['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock']};
   await page.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),seed);
   await page.reload();await page.locator('#app[data-ready=true]').waitFor();await page.locator('#home-play').tap();
   await page.waitForFunction(id=>document.querySelector<HTMLElement>('#app')?.dataset.presentedDeal===id,c.deal.id);
   await page.waitForTimeout(200);
   const r=(await page.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height,seed.settings.deckPosition,c.deal),g=layout(seed.attempt.board,c.deal,f.height,seed.settings.deckSide,seed.settings.deckPosition),p=g.poses.find(p=>p.id===c.id)!,m=cardMetrics(c.deal);
   const x=r.x+f.offsetX+p.x*f.unit,y=r.y+p.y*f.unit;
   const stem=`${width}-${variant}-${c.subject}`;
   const clip={x:Math.max(0,x-m.width*f.unit/2-3),y:Math.max(0,y-m.height*f.unit/2-3),width:m.width*f.unit+6,height:m.height*f.unit+10};
   await page.screenshot({path:resolve(output,stem+'-card.png'),clip,scale:'css'});
   if(width===360&&variant==='after'&&['drum','shirt','helicopter','vacuum','rope','tea'].includes(c.subject))await page.screenshot({path:resolve(output,stem+'-board.png'),scale:'css'});
   if(variant==='after'){
    await page.locator('#inspect').tap();await page.touchscreen.tap(x,y);await page.locator('#word-image:visible').waitFor();
    const image=await page.locator('#word-image').evaluate(async e=>{const i=e as HTMLImageElement;await i.decode();return{width:i.naturalWidth,height:i.naturalHeight,src:i.src}});
    if(image.width!==192||image.height!==192||!image.src.endsWith('/'+illustrationUrl(c.deal.cards[c.id].image!)))throw Error('Wrong reader image: '+c.subject);
    if((await page.locator('#word-title').textContent())?.trim()!==c.title)throw Error('Wrong reader subject: '+c.subject);
    await page.locator('#inspect-dialog').screenshot({path:resolve(output,stem+'-reader.png')});
    await page.locator('#inspect-dialog .primary').tap();
    if(await page.locator('#inspect').getAttribute('aria-pressed')!=='false')throw Error('Reader mode leaked: '+c.subject);
   }
   const actual=await page.evaluate(()=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
   if(JSON.stringify(actual.attempt.board)!==JSON.stringify(seed.attempt.board)||JSON.stringify(actual.profile)!==JSON.stringify(seed.profile))throw Error('Art preview changed game/resources: '+c.subject);
   captures.push({subject:c.subject,title:c.title,dealId:c.deal.id,width,height,variant,reader:variant==='after'});
  }
  await context.close();console.info('Captured',width,height,variant,cases.size,'subjects');
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(resolve(output,'report.json'),JSON.stringify({subjects:cases.size,captures,errors},null,2)+'\n');
 console.info('PASS:',cases.size,'reachable subjects;',captures.length,'real card captures;',captures.filter(c=>(c as {reader:boolean}).reader).length,'reader checks; no board/resource changes.');
}finally{await browser.close();await new Promise<void>(r=>server.httpServer.close(()=>r()));}
