import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { dailyForDay } from '../src/content/daily';
import { dispatch, freshSave } from '../src/domain/engine';
import type { Save } from '../src/domain/types';
// This audit reads rendered DOM and screenshots. It deliberately does not use
// layout(), boardFrame(), scene.geometry() or a runtime debug bridge as its oracle.
const output = process.argv[2] ?? '.recording/layout-audit';
await mkdir(output, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4195, strictPort: true }, build: { outDir: process.env.ASOC_QA_DIST ?? 'dist' } });
const browser = await chromium.launch();
const issues: { state: string; reason: string }[] = [], captures: object[] = [], rasterIssues: object[] = [];
const allSizes = [[320,480],[320,568],[360,640],[360,780],[393,851],[412,915],[520,700]];
const dialogsOnly = process.argv.includes('--dialogs');
const sizes = dialogsOnly ? allSizes.filter(([w,h])=>w===320||w===360&&h===780) : allSizes;
function seed(index: number, filled = false) {
 const deal = campaignDeals[index]; let save = freshSave(deal, 'audit-layout'); save.settings.reducedMotion = true;
 save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0,index).map(d=>d.id) };
 if (filled) {
  for (const cmd of deal.winningPath) {
   const next = dispatch(save, cmd, deal); if (!next.accepted) throw Error('Invalid audit witness'); if (next.events.some(e=>e.type==='complete')) break; save = next.next;
   if (save.attempt.board.foundations.every(ids=>ids.length)) break;
  }
 }
 return save;
}
async function load(page: Page, save: Save) {
 if(!page.url().startsWith('http://127.0.0.1:4195')){await page.goto('http://127.0.0.1:4195');await page.locator('#app[data-ready=true]').waitFor();}
 await page.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
 await page.reload(); await page.locator('#app[data-ready=true]').waitFor(); await page.evaluate(()=>document.fonts.ready);
}
async function audit(page: Page, state: string, home = false) {
 const found = await page.evaluate(({home})=>{
  const result: string[] = [], rect = (s:string)=>document.querySelector(s)!.getBoundingClientRect();
  const shown=(e:Element)=>e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=='hidden';
  const overlap=(a:DOMRect,b:DOMRect)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
  const selectors=home?['#appearance-open','.daily-card','#win-cycle-open','#looks-open','.linked-emblem','.brand-scene h1','#daily-resume-old','#home-play','#level-picker-open']:['#menu','#wallet-open','.streak-row','#dock button:not([hidden])'];
  const elements=selectors.flatMap(s=>[...document.querySelectorAll(s)]).filter(shown);
  for(let i=0;i<elements.length;i++)for(let j=i+1;j<elements.length;j++)if(overlap(elements[i].getBoundingClientRect(),elements[j].getBoundingClientRect()))result.push('DOM overlap: '+(elements[i].id||elements[i].className)+' / '+(elements[j].id||elements[j].className));
  for(const e of document.querySelectorAll<HTMLElement>('header button,header #coins,header .streak-row'))if(shown(e)){
   const r=e.getBoundingClientRect();if(r.left < -1||r.right>innerWidth+1||e.scrollWidth>e.clientWidth+2)result.push('Header overflow: '+(e.id||e.className));
  }
  if(home&&innerHeight>=568){const r=rect('#home-play');if(r.bottom>rect('#app').bottom+1)result.push('Primary home action below viewport');}
  if(!home&&document.querySelector('dialog[open]'))result.push('Playing field is covered by an unexpected dialog');
  if(!home){const canvas=rect('canvas'),dock=rect('#dock'),msg=rect('#message');if(canvas.bottom>msg.top+1||msg.bottom>dock.top+1||dock.bottom>innerHeight+1)result.push('Field/guidance/helper boundary overlap');}
  return result;
 },{home});
 found.forEach(reason=>issues.push({state,reason}));
 await page.screenshot({path:`${output}/${state}.png`,scale:'css'});
 if(!home){
  const raster = await page.evaluate(()=>{const canvas=document.querySelector('canvas')!.getBoundingClientRect();return {width:canvas.width,height:canvas.height,controls:[...document.querySelectorAll('.deck-tools .moves,#inspect')].map(e=>{const r=e.getBoundingClientRect();return {name:e.id||e.className,x:r.x-canvas.x,y:r.y-canvas.y,width:r.width,height:r.height}})};});
  await page.locator('.deck-tools').evaluate(e=>(e as HTMLElement).style.visibility='hidden');
  const pixels = await page.locator('canvas').screenshot({path:`${output}/${state}-raster.png`,scale:'css'});
  // Transfer the PNG as ordinary local HTTP bytes; decode pixels with the browser.
  await page.route('http://127.0.0.1:4195/qa-raster.png', route=>route.fulfill({body:pixels,contentType:'image/png',headers:{'Cache-Control':'no-store'}}), {times:1});
  const collisions = await page.evaluate(async controls=>{
    const image=new Image();image.src='http://127.0.0.1:4195/qa-raster.png';await image.decode();
    const bitmap=document.createElement('canvas');bitmap.width=image.width;bitmap.height=image.height;
    const ctx=bitmap.getContext('2d')!;ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,image.width,image.height).data;
    let cards=0,tabs=0;const w=image.width,h=image.height,seen=new Uint8Array(w*h),found:{reason:string;rendered:number[]}[]=[];
    const kind=(i:number)=>Math.abs(rgba[i*4]-237)+Math.abs(rgba[i*4+1]-187)+Math.abs(rgba[i*4+2]-141)<15?1:rgba[i*4]>248&&rgba[i*4+1]>230&&rgba[i*4+2]>200?2:0;
    for(let start=0;start<w*h;start++){
      if(seen[start])continue;const color=kind(start);if(!color)continue;
      const todo=[start];seen[start]=1;let count=0,left=w,right=0,top=h,bottom=0;
      while(todo.length){const i=todo.pop()!,x=i%w,y=Math.floor(i/w);count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&kind(j)===color){seen[j]=1;todo.push(j);}
      }
      if(count<30||right-left<10)continue;
      if(color===1)tabs++;else cards++;
      for(const c of controls)if(Math.min(right+1,c.x+c.width)-Math.max(left,c.x)>2&&Math.min(bottom+1,c.y+c.height)-Math.max(top,c.y)>2)found.push({reason:c.name+' overlaps rendered '+(color===1?'tab':'card'),rendered:[left,top,right+1,bottom+1]});
    }
    if(!cards||!tabs)found.push({reason:'Missing rendered card/tab positive control',rendered:[]});
    return found;
  },raster.controls);
  rasterIssues.push(...collisions.map(c=>({state,...c})));
  await page.locator('.deck-tools').evaluate(e=>(e as HTMLElement).style.removeProperty('visibility'));
  captures.push({state,...raster});
 }
}
try {
 const errors: string[]=[];
 for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-10T12:00:00Z')});
  if(!dialogsOnly)for(const kind of ['fresh','rich','stale']){
   const s=seed(kind==='fresh'?0:16);if(kind==='rich'){s.profile.coins=9999999;s.attempt.streak.tier=2;s.attempt.streak.progress=3;}
   if(kind==='stale')s.parked={daily:freshSave(dailyForDay('2026-11-09'),'audit-old-daily').attempt};
   await load(page,s);await audit(page,`${width}x${height}-home-${kind}`,true);
  }
  if(!dialogsOnly)for(const level of [1,17,21,23,26])for(const position of ['top','bottom'] as const)for(const side of ['left','right'] as const){
   if(level===1&&(position!=='top'||side!=='right'))continue;
   let s=seed(level-1,true);if(level===21){const column=s.attempt.board.tableau.reduce((last,ids,i)=>ids.length?i:last,-1);const result=dispatch(s,{type:'place-joker',column},campaignDeals[level-1]);if(!result.accepted)throw Error('Joker audit fixture refused');s=result.next;}if(level===17){s.profile.coins=9999999;s.attempt.streak.tier=3;s.attempt.streak.progress=6;}s.settings.deckPosition=position;s.settings.deckSide=side;
   await load(page,s);await page.locator('#home-play').tap();
   // Model a short native content viewport and measured banner reservation,
   // not a claim of an Android SDK or physical-inset check.
   if(width===320){await page.locator('#app').evaluate(e=>(e as HTMLElement).style.height='calc(100dvh - 48px)');}
   if(level!==1)await page.locator('#banner-slot').evaluate(e=>{(e as HTMLElement).hidden=false;(e as HTMLElement).style.height='90px';});
   await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
   await audit(page,`${width}x${height}-level${level}-${position}-${side}`);
  }
  // Every dialog is checked at both the shortest and a normal viewport.
  if(width===320||width===360&&height===780){
   await load(page,seed(25));await page.locator('#home-play').tap();
   for(const id of ['settings','appearance','helpers','level-picker','calendar','cycle-info','restart-confirm','replace-daily','switch-level','inspect-dialog','result','result-exhausted']){
    const dialogId=id.startsWith('result')?'result':id;
    if(dialogId==='result'){
     const index=id==='result'?19:16;let state=seed(index);state.meta!.winCycle=4;
     if(id==='result')for(const cmd of campaignDeals[index].winningPath)state=dispatch(state,cmd,campaignDeals[index]).next;
     else while(state.attempt.board.phase==='playing')state=dispatch(state,{type:state.attempt.board.stock.length?'draw':'recycle'},campaignDeals[index]).next;
     await load(page,state);await page.locator('#home-play').tap();await page.locator('#result[open]').waitFor();
    }
    if(id==='inspect-dialog'){
     const card=Object.values(campaignDeals.flatMap(deal=>Object.values(deal.cards))).sort((a,b)=>b.text.length-a.text.length)[0];
     await page.evaluate(card=>{document.querySelector('#word-title')!.textContent=card.text;document.querySelector('#word-description')!.textContent=card.explanation;},card);
    }
    await page.evaluate(id=>{document.querySelectorAll('dialog').forEach(d=>d.close());document.querySelector<HTMLDialogElement>('#'+id)!.showModal();},dialogId);
    const buttons=page.locator(`#${dialogId} button:visible,#${dialogId} input:visible`);
    for(let i=0;i<await buttons.count();i++){
     const e=buttons.nth(i);await e.scrollIntoViewIfNeeded();
     const reason=await e.evaluate(el=>{const e=el as HTMLElement,r=e.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return e.scrollWidth>e.clientWidth+2?'Button text overflow':!hit||!(e===hit||e.contains(hit))?'Control covered or outside viewport':null;});
     if(reason)issues.push({state:`${width}x${height}-${id}`,reason:reason+': '+await e.getAttribute('id')});
    }
    await page.locator('#'+dialogId).evaluate(e=>e.scrollTop=0);await page.screenshot({path:`${output}/${width}x${height}-${id}.png`,scale:'css'});
   }
  }
  await context.close();console.info('Audited',width,height);
 }
 errors.forEach(reason=>issues.push({state:'runtime',reason}));
 await writeFile(`${output}/dom-report.json`,JSON.stringify({issues,captures},null,2));
 await writeFile(`${output}/report.json`,JSON.stringify({issues,raster_issues:rasterIssues,total_issues:issues.length+rasterIssues.length,captures},null,2));
 console.info('DOM issues:',issues.length,'Raster issues:',rasterIssues.length,'Cases:',captures.length);
 if(issues.length||rasterIssues.length)process.exitCode=1;
} finally {await browser.close();await new Promise<void>(r=>server.httpServer.close(()=>r()));}
