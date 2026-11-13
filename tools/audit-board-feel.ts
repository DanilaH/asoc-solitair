/** Read-only product audit: isolated QA profile, production touch events and unmodified production bundle. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { dispatch, freshSave, packet } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import type { BoardCommand, Location, Save } from '../src/domain/types';

const dir=process.env.ASOC_QA_OUT??'.recording/board-feel-audit-2026-11-13';
await mkdir(dir,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:4197,strictPort:true},build:{outDir:process.env.ASOC_QA_DIST??'dist'}}),browser=await chromium.launch();
const records:object[]=[],errors:string[]=[];
try {
 for(const [width,height,reduced]of [[360,780,false],[320,568,false],[360,780,true]] as const) {
  const label=`${width}-${reduced?'reduced':'motion'}`,out=`${dir}/${label}`;await mkdir(out,{recursive:true});
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:out+'/video',size:{width,height}}});
  const born=Date.now(),page=await ctx.newPage(),cdp=await ctx.newCDPSession(page),deal=campaignDeals[5],events:object[]=[],frames:object[]=[],writes:Promise<void>[]=[];
  let burst='';
  cdp.on('Page.screencastFrame',frame=>{void cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId});if(!burst)return;const file=`${burst}-${String(frames.length).padStart(3,'0')}.png`;frames.push({file,epochMs:frame.metadata.timestamp!*1000});writes.push(writeFile(`${out}/${file}`,Buffer.from(frame.data,'base64')));});
  const startBurst=async(name:string)=>{if(width!==360||reduced)return;burst=name;await cdp.send('Page.startScreencast',{format:'png',everyNthFrame:1});};
  const endBurst=async()=>{if(!burst)return;await cdp.send('Page.stopScreencast');burst='';};
  page.on('pageerror',e=>errors.push(e.message));
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
  const mark=async(name:string,extra:object={})=>{const now=await page.evaluate(()=>({pageMs:performance.now(),epochMs:Date.now()}));events.push({name,hostSeconds:(Date.now()-born)/1000,...now,...extra});return now.pageMs;};
  const shot=async(name:string)=>{await mark(name);await page.screenshot({path:`${out}/${name}.png`,scale:'css'});};
  await page.goto('http://127.0.0.1:4197');await page.locator('#app[data-ready=true]').waitFor();
  const seed=freshSave(deal,'board-feel-audit');seed.settings.sfx=false;seed.settings.reducedMotion=reduced;
  seed.platform={receipts:[],continuedAttempts:[],continueCredits:0,winsSinceInterstitial:0,lastFullscreenAt:0,completedCampaign:campaignDeals.slice(0,26).map(d=>d.id)};
  seed.campaign={version:1,tutorials:['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used']};
  await page.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),seed);await page.reload();await page.locator('#app[data-ready=true]').waitFor();
  await mark('enter');await page.locator('#home-play').tap();await page.waitForTimeout(850);await shot('01-idle');
  async function geometry(){const s=await read(),r=(await page.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height,s.settings.deckPosition,deal),g=layout(s.attempt.board,deal,f.height,s.settings.deckSide,s.settings.deckPosition);return{s,r,f,g,point:(p:{x:number;y:number})=>({x:r.x+f.offsetX+p.x*f.unit,y:r.y+p.y*f.unit})};}
  async function begin(id:string,to:{x:number;y:number}){const{g,point}=await geometry(),a=point(g.poses.find(q=>q.id===id)!);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(to.x-a.x)*i/12,y:a.y+(to.y-a.y)*i/12}]});await page.waitForTimeout(20);}}
  async function transfer(id:string,to:Location,settle=350,tap=false){const before=await read(),{g,point}=await geometry();const from:Location=before.attempt.board.waste.at(-1)===id?{kind:'waste',index:0}:{kind:'tableau',index:before.attempt.board.tableau.findIndex(col=>packet(before.attempt.board,before.attempt.board.tableau.indexOf(col),deal).includes(id))};assert.ok(from.kind==='waste'||from.index>=0);const cmd:BoardCommand={type:'transfer',from,to},expected=dispatch(before,cmd,deal),b=point(g.targets.find(t=>t.location.kind===to.kind&&t.location.index===to.index)!);assert.equal(expected.accepted,true);if(tap){const a=point(g.poses.find(q=>q.id===id)!);await page.touchscreen.tap(a.x,a.y);await mark('tap-target-'+id,{cmd});await page.touchscreen.tap(b.x,b.y);}else{await begin(id,b);await mark('release-'+id,{cmd});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}await page.waitForFunction(rev=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!).revision>rev,before.revision);assert.deepEqual((await read()).attempt.board,expected.next.attempt.board);if(settle)await page.waitForTimeout(settle);}
  for(const[id,index]of [['lights',1],['lights_3',1],['dishes',0],['lights_4',1],['lights_2',1]] as const){if(id==='lights_3'){await shot('ordinary-before');await startBurst('ordinary-frame');await transfer(id,{kind:'foundation',index},0,true);await shot('ordinary-early');await page.waitForTimeout(400);await shot('ordinary-settled');await endBurst();}else await transfer(id,{kind:'foundation',index});}
  const before=await read();assert.deepEqual(before.attempt.board.tableau[1],['lights_1']);
  await shot('02-before-last-lift');
  await begin('lights_1',{x:width-45,y:height*.68});await page.waitForTimeout(130);await shot('03-last-card-held');
  assert.deepEqual((await read()).attempt.board,before.attempt.board);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(350);
  const completionStart=(Date.now()-born)/1000;
  await startBurst('completion-frame');await transfer('lights_1',{kind:'foundation',index:1},0);
  await shot('04-completion-early');await page.waitForTimeout(110);await shot('05-completion-middle');await page.waitForTimeout(160);await shot('06-completion-late');await page.waitForTimeout(700);await shot('07-completion-settled');await endBurst();
  const completed=await read();assert.equal(completed.attempt.board.collected.length,5);
  await mark('undo');await page.locator('#undo').tap();await page.waitForTimeout(60);await shot('08-undo-early');await page.waitForTimeout(400);assert.equal((await read()).attempt.board.collected.length,0);await shot('09-undo-settled');
  const missBefore=await read();await begin('lights_1',{x:width-45,y:height*.72});await page.waitForTimeout(80);await mark('outside-release');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await shot('10-outside-release');await page.waitForTimeout(450);assert.deepEqual((await read()).attempt.board,missBefore.attempt.board);assert.deepEqual((await read()).attempt.streak,missBefore.attempt.streak);
  await transfer('lights_1',{kind:'foundation',index:1},0);
  if(width===360&&!reduced){
    const beforeError=await read(),{g,point}=await geometry(),a=point(g.poses.find(p=>p.id===beforeError.attempt.board.tableau[2].at(-1))!),b=point(g.targets.find(t=>t.location.kind==='foundation'&&t.location.index===1)!);
    await page.touchscreen.tap(a.x,a.y);await page.touchscreen.tap(b.x,b.y);
    await page.waitForFunction(()=>Boolean(document.querySelector('#message')?.textContent?.includes('категории')));
    const feedback=await page.evaluate(()=>({message:document.querySelector('#message')!.textContent,visibility:getComputedStyle(document.querySelector('#message')!).visibility,praiseHidden:(document.querySelector('#praise') as HTMLElement).hidden}));
    assert.deepEqual((await read()).attempt.board,beforeError.attempt.board);await mark('error-feedback-during-completion',feedback);await shot('15-error-during-completion');
  }
  await page.waitForTimeout(1000);
  // All stock operations below are real taps; no card or Phaser state injection.
  async function stock(){const before=await read(),{g,point}=await geometry(),a=point(g.stock),cmd:BoardCommand={type:before.attempt.board.stock.length?'draw':'recycle'},expected=dispatch(before,cmd,deal);assert.equal(expected.accepted,true);await page.touchscreen.tap(a.x,a.y);await page.waitForFunction(rev=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!).revision>rev,before.revision);assert.deepEqual((await read()).attempt.board,expected.next.attempt.board);await page.waitForTimeout(400);}
  await mark('stock-start');for(let n=0;n<3;n++)await stock();await shot('11-waste-three');while((await read()).attempt.board.stock.length)await stock();await shot('12-stock-empty');await mark('recycle');await stock();await shot('13-recycle-settled');
  await page.locator('#hint').tap();await page.waitForTimeout(700);await shot('14-hint');
  await page.locator('#menu').tap();await page.waitForTimeout(250);await page.locator('#settings-done').tap();await page.waitForTimeout(300);
  await mark('end');const video=page.video()!;await cdp.detach();await ctx.close();await video.saveAs(`${out}/actual-touch.webm`);await Promise.all(writes);
  const result={width,height,reduced,deal:deal.id,rulesVersion:3,profile:'isolated ordinary campaign replay; tutorial and helper unlock flags prepared before entry',actualInput:true,domainCompared:true,finalCardHeldWithoutCommit:true,outsideReleasePreservesBoardAndStreak:true,completionAndUndo:true,stockAndRecycle:true,completionStart,events,frames};records.push(result);await writeFile(`${out}/events.json`,JSON.stringify(result,null,2)+'\n');
 }
 assert.deepEqual(errors,[]);await writeFile(`${dir}/checks.json`,JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),productionBundleNotInstrumented:true,dist:process.env.ASOC_QA_DIST??'dist',records,errors},null,2)+'\n');console.info(JSON.stringify({recordings:records.length,errors}));
}finally{await browser.close();await new Promise<void>(r=>server.httpServer.close(()=>r()));}
