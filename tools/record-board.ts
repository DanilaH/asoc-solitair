import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { introDeal } from '../src/content/intro';
import { campaignDeals } from '../src/content/campaign';
import { freshSave, dispatch, packet } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import type { Save, Deal } from '../src/domain/types';
const dir = '.recording/board-093'; await mkdir(dir, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4198, strictPort: true } }), browser = await chromium.launch(), results: object[] = [], errors: string[] = [];
try {
 for (const [width, height] of [[360,780],[320,568]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: dir + '/video', size: { width, height } } }), p = await context.newPage();
  p.on('pageerror', e => errors.push(e.message)); const c = await context.newCDPSession(p);
  const gameplay = (s: Save) => JSON.stringify({ board: s.attempt.board, profile: s.profile, undo: s.attempt.undo, streak: s.attempt.streak, id: s.attempt.id });
  const read = () => p.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
  async function load(deal: Deal, side: 'left'|'right' = 'right', row: 'top'|'bottom' = 'top') {
   await p.goto('http://127.0.0.1:4198'); await p.locator('#app[data-ready=true]').waitFor();
   const s = freshSave(deal, 'board-recording'); s.settings.sfx = false; s.settings.deckSide = side; s.settings.deckPosition = row;
   s.platform = { receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:campaignDeals.slice(0,26).map(d=>d.id) };
   s.campaign = { version:1,tutorials:['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock'] };
   await p.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),s); await p.reload();await p.locator('#app[data-ready=true]').waitFor();await p.locator('#home-play').tap();await p.waitForTimeout(450);
   // A QA touch marker follows actual native pointer events; it cannot move cards.
   await p.evaluate(()=>{const dot=document.createElement('div');dot.id='qa-touch';dot.style.cssText='position:fixed;width:20px;height:20px;border:2px solid #fff8;box-shadow:0 0 0 2px #163f4566;border-radius:50%;pointer-events:none;z-index:50;display:none;transform:translate(-50%,-50%)';document.body.append(dot);for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>{const q=e as PointerEvent;dot.style.left=q.clientX+'px';dot.style.top=q.clientY+'px';dot.style.display=q.buttons?'block':'none'},{capture:true});});
  }
  async function geometry(deal: Deal) { const s=await read(),r=(await p.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height,s.settings.deckPosition,deal),g=layout(s.attempt.board,deal,f.height,s.settings.deckSide,s.settings.deckPosition);return {s,r,f,g,pt:(v:{x:number;y:number})=>({x:r.x+f.offsetX+v.x*f.unit,y:r.y+v.y*f.unit})}; }
  const tap = async (v:{x:number;y:number})=>{await p.touchscreen.tap(v.x,v.y);await p.waitForTimeout(390)};
  const start = (v:{x:number;y:number})=>c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[v]});
  const end = ()=>c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  async function drag(a:{x:number;y:number},b:{x:number;y:number},ms=450){for(let i=1;i<=18;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/18,y:a.y+(b.y-a.y)*i/18}]});await p.waitForTimeout(ms/18)}}
  await load(introDeal); let q = await geometry(introDeal); await p.screenshot({path:`${dir}/${width}-stock-full.png`});
  for(let i=0;i<3;i++){q=await geometry(introDeal);await tap(q.pt(q.g.stock));}
  await p.screenshot({path:`${dir}/${width}-fan.png`});await p.waitForTimeout(750);
  q=await geometry(introDeal);const id=q.s.attempt.board.waste.at(-1)!,source=q.pt(q.g.poses.find(v=>v.id===id)!),zone=(await p.locator('#inspect').boundingBox())!,target={x:zone.x+zone.width/2,y:zone.y+zone.height/2},beforePeek=await read();
  await start(source);await drag(source,target);await p.waitForTimeout(650);await end();await p.waitForTimeout(300);await p.screenshot({path:`${dir}/${width}-reader.png`});
  if(gameplay(await read())!==gameplay(beforePeek))throw Error('Inspection changed save');await p.waitForTimeout(850);
  const command=introDeal.winningPath[0];if(command.type!=='transfer')throw Error('Expected transfer');q=await geometry(introDeal);const a=q.pt(q.g.poses.find(v=>v.id===packet(q.s.attempt.board,command.from.index,introDeal).at(-1))!),t=q.g.targets.find(t=>t.location.kind===command.to.kind&&t.location.index===command.to.index)!,b=q.pt(t);b.y+=80;
  await start(a);await drag(a,b);await p.waitForTimeout(300);await p.screenshot({path:`${dir}/${width}-card-anchor.png`});await end();await p.waitForTimeout(400);
  if(JSON.stringify((await read()).attempt.board)!==JSON.stringify(dispatch(q.s,command,introDeal).next.attempt.board))throw Error('Card-anchor drop failed');
  q=await geometry(introDeal);const held=q.pt(q.g.poses.find(v=>v.id==='bird')!),beforeEdges=await read();await start(held);let previous=held;
  for(const [edge,target]of [['left',{x:2,y:q.r.y+q.r.height*.6}],['right',{x:width-2,y:q.r.y+q.r.height*.6}],['bottom',{x:width*.45,y:height-4}],['top',{x:width*.45,y:4}]] as const){await drag(previous,target,420);previous=target;await p.waitForTimeout(250);await p.screenshot({path:`${dir}/${width}-${edge}.png`});}
  await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await p.waitForTimeout(400);if(gameplay(await read())!==gameplay(beforeEdges))throw Error('Cancelled viewport drag changed save');
  const second=introDeal.winningPath[1];if(second.type!=='transfer')throw Error('Expected second transfer');q=await geometry(introDeal);const secondSource=q.pt(q.g.poses.find(v=>v.id===packet(q.s.attempt.board,second.from.index,introDeal).at(-1))!),secondTarget=q.pt(q.g.targets.find(t=>t.location.kind===second.to.kind&&t.location.index===second.to.index)!);
  await start(secondSource);await drag(secondSource,secondTarget);await end();await p.waitForTimeout(450);if(JSON.stringify((await read()).attempt.board)!==JSON.stringify(dispatch(q.s,second,introDeal).next.attempt.board))throw Error('Second category transfer failed');await p.screenshot({path:`${dir}/${width}-occupied-foundations.png`});await p.waitForTimeout(650);
  while((await read()).attempt.board.stock.length){q=await geometry(introDeal);await tap(q.pt(q.g.stock));}
  const exhausted=await read();q=await geometry(introDeal);await tap(q.pt(q.g.stock));await p.waitForTimeout(250);const recycled=await read();if(JSON.stringify(recycled.attempt.board.stock)!==JSON.stringify(exhausted.attempt.board.waste))throw Error('Recycle order changed');
  await p.screenshot({path:`${dir}/${width}-recycled.png`});await p.locator('#menu').tap();await p.waitForTimeout(240);const panel=(await p.locator('#settings').boundingBox())!;await p.screenshot({path:`${dir}/${width}-pause.png`});await p.waitForTimeout(500);await p.locator('#pause-options summary').tap();await p.waitForTimeout(240);const expanded=(await p.locator('#settings').boundingBox())!;
  for(const key of ['x','y','width','height']as const)if(Math.abs(panel[key]-expanded[key])>.6)throw Error('Pause moved');await p.screenshot({path:`${dir}/${width}-preferences.png`});await p.waitForTimeout(700);await p.locator('#pause-options summary').tap();await p.waitForTimeout(240);await p.locator('#settings-done').tap();
  results.push({width,height,inspectionFree:true,cardAnchorTransfer:true,occupiedFoundations:true,viewportEdges:['left','right','top','bottom'],cancelFree:true,recycleExact:true,pauseBounds:panel});
  const video=p.video()!;await c.detach();await context.close();await video.saveAs(`${dir}/${width}-board.webm`);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`${dir}/${width}-board.webm`,'-vf',`fps=12,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[x];[b][x]paletteuse=dither=none:diff_mode=rectangle`,`${dir}/${width}-board.gif`]);
 }
 if(errors.length)throw Error(errors.join('\n'));await writeFile(dir+'/checks.json',JSON.stringify({results,errors},null,2)+'\n');console.info(JSON.stringify({cases:results.length,errors}));
}finally{await browser.close();server.httpServer.close();}
