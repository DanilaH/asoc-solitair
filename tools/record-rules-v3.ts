/** Real production touch recording: refused lower theme, correct upper collection and Undo. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { freshSave } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import type { Location, Save } from '../src/domain/types';

const dir='.recording/rules-v3-media';await mkdir(dir,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:4199,strictPort:true}}),browser=await chromium.launch();
const records:object[]=[],errors:string[]=[];
try {
 for(const [width,height]of [[360,780],[320,568]]) {
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:dir+'/video',size:{width,height}}});
  const born=Date.now(),p=await ctx.newPage(),cdp=await ctx.newCDPSession(p),d=campaignDeals[5];p.on('pageerror',e=>errors.push(e.message));
  const read=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
  await p.goto('http://127.0.0.1:4199');await p.locator('#app[data-ready=true]').waitFor();
  const s=freshSave(d,'rules-v3-recording');s.settings.sfx=false;
  s.platform={receipts:[],continuedAttempts:[],continueCredits:0,winsSinceInterstitial:0,lastFullscreenAt:0,completedCampaign:campaignDeals.slice(0,26).map(d=>d.id)};
  s.campaign={version:1,tutorials:['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used']};
  await p.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),s);await p.reload();await p.locator('#app[data-ready=true]').waitFor();await p.locator('#home-play').tap();await p.waitForTimeout(350);
  const start=(Date.now()-born)/1000;await p.screenshot({path:`${dir}/${width}-before.png`});await p.waitForTimeout(500);
  async function drag(id:string,to:Location) {
   const s=await read(),r=(await p.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height,s.settings.deckPosition,d),g=layout(s.attempt.board,d,f.height,s.settings.deckSide,s.settings.deckPosition);
   const point=(q:{x:number;y:number})=>({x:r.x+f.offsetX+q.x*f.unit,y:r.y+q.y*f.unit}),a=point(g.poses.find(q=>q.id===id)!),b=point(g.targets.find(t=>t.location.kind===to.kind&&t.location.index===to.index)!);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
   for(let i=1;i<=16;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/16,y:a.y+(b.y-a.y)*i/16}]});await p.waitForTimeout(20);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(350);
  }
  const before=await read();await drag('lights_3',{kind:'tableau',index:1});
  assert.deepEqual((await read()).attempt.board,before.attempt.board);assert.deepEqual((await read()).profile,before.profile);
  assert.match(await p.locator('#message').innerText(),/Сначала перенесите тему/);await p.screenshot({path:`${dir}/${width}-refused.png`});await p.waitForTimeout(1100);
  for(const [id,index]of [['lights',1],['lights_3',1],['dishes',0],['lights_4',1],['lights_2',1],['lights_1',1]] as const)await drag(id,{kind:'foundation',index});
  const completed=await read();assert.equal(completed.attempt.board.collected.length,5);assert.equal(completed.attempt.board.movesLeft,26);
  await p.screenshot({path:`${dir}/${width}-completed.png`});await p.waitForTimeout(900);
  await p.locator('#undo').tap();await p.waitForTimeout(500);const undone=await read();assert.equal(undone.attempt.board.collected.length,0);assert.equal(undone.attempt.board.movesLeft,27);assert.equal(undone.profile.undos,4);assert.equal(undone.profile.coins,completed.profile.coins);
  await drag('lights_1',{kind:'foundation',index:1});await p.waitForTimeout(1000);
  const video=p.video()!;await cdp.detach();await ctx.close();await video.saveAs(`${dir}/${width}-rules.webm`);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(Math.max(0,start-.15)),'-i',`${dir}/${width}-rules.webm`,'-vf',`fps=15,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[x];[b][x]paletteuse=dither=none:diff_mode=rectangle`,`${dir}/${width}-rules.gif`]);
  records.push({width,height,deal:d.id,rulesVersion:3,lowerThemeRefused:true,upperCollection:true,completion:true,undoRestores:true,budgetUnchanged:true,trimSeconds:Math.max(0,start-.15)});
 }
 assert.deepEqual(errors,[]);await writeFile(dir+'/checks.json',JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),records,errors},null,2)+'\n');console.info(JSON.stringify({records,errors}));
}finally{await browser.close();await new Promise<void>(r=>server.httpServer.close(()=>r()));}
