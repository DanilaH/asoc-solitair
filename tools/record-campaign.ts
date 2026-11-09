import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium, type Page } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { freshSave, packet } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import type { BoardCommand, Deal, Save } from '../src/domain/types';
const key='asoc-solitaire.save.v1';
const read=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!) as Save,key);
async function move(page:Page,deal:Deal,cmd:BoardCommand){
  const save=await read(page),rect=(await page.locator('canvas').boundingBox())!,frame=boardFrame(rect.width,rect.height),geometry=layout(save.attempt.board,deal,frame.height);
  const tap=(p:{x:number;y:number})=>page.touchscreen.tap(rect.x+frame.offsetX+p.x*frame.unit,rect.y+p.y*frame.unit);
  if(cmd.type==='transfer'){
    const id=cmd.from.kind==='waste'?save.attempt.board.waste.at(-1):packet(save.attempt.board,cmd.from.index,deal).at(-1);
    await tap(geometry.poses.find(p=>p.id===id)!);await tap(geometry.targets.find(t=>t.location.kind===cmd.to.kind&&t.location.index===cmd.to.index)!);
  }else await tap(geometry.stock);
  await page.waitForTimeout(300);
}
await mkdir('docs/qa',{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:4182,strictPort:true}}),browser=await chromium.launch({headless:true});
try{
  for(const mode of ['first','dense'] as const){
    const context=await browser.newContext({viewport:{width:360,height:640},deviceScaleFactor:1,hasTouch:true,isMobile:true,recordVideo:{dir:'.recording/campaign-video',size:{width:360,height:640}}}),page=await context.newPage();
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4182');await page.waitForSelector('#app[data-ready="true"]');
    if(mode==='first'){
      await page.screenshot({path:'docs/qa/campaign-home.png',scale:'css'});await page.waitForTimeout(800);await page.locator('#home-play').tap();await page.waitForTimeout(1000);
      await page.screenshot({path:'docs/qa/campaign-first.png',scale:'css'});
      for(const cmd of campaignDeals[0].winningPath)await move(page,campaignDeals[0],cmd);
      await page.waitForSelector('#result[open]');await page.waitForTimeout(500);await page.locator('#next-level').tap();await page.waitForTimeout(1100);
    }else{
      // A valid restored profile reaches the same production route; there is no runtime test bridge.
      const deal=campaignDeals[16],fixture=freshSave(deal,'qa-dense');
      fixture.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:campaignDeals.slice(0,16).map(d=>d.id)};
      await page.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});await page.reload();await page.waitForSelector('#app[data-ready="true"]');await page.locator('#home-play').tap();await page.waitForTimeout(1000);
      await page.screenshot({path:'docs/qa/campaign-dense.png',scale:'css'});
      await page.locator('#inspect').tap();
      const save=await read(page),rect=(await page.locator('canvas').boundingBox())!,frame=boardFrame(rect.width,rect.height),geo=layout(save.attempt.board,deal,frame.height);
      const pose=geo.poses.find(p=>p.id==='office_5')!;
      await page.touchscreen.tap(rect.x+frame.offsetX+pose.x*frame.unit,rect.y+pose.y*frame.unit);await page.waitForSelector('#inspect-dialog[open]');await page.waitForTimeout(1100);await page.locator('#inspect-dialog [data-close]').last().tap();
      await page.locator('#hint').tap();await page.waitForTimeout(1600);await move(page,deal,deal.winningPath[0]);await page.waitForTimeout(500);
    }
    if(errors.length)throw Error(errors.join('\n'));
    const video=page.video()!;await context.close();const source=`.recording/campaign-${mode}.webm`;await video.saveAs(source);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',source,'-vf','fps=5,scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',`docs/qa/campaign-${mode}.gif`]);
  }
  console.info('Recorded real production UI: home, first win/next deal, four-column field, exact-word inspection and hint.');
}finally{await browser.close();server.httpServer.close();}
