import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { campaignDeals } from '../src/content/campaign';
import { freshSave, dispatch, packet } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import { cardArtwork } from '../src/game/art';
import type { BoardCommand, Deal, Save } from '../src/domain/types';

const dir = '.recording/board-094'; await mkdir(dir, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4198, strictPort: true } }), browser = await chromium.launch();
const results: object[] = [], errors: string[] = [];
try {
  for (const [width,height] of [[360,780],[320,568]]) {
    const ctx = await browser.newContext({ viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:dir+'/video',size:{width,height}} }),p = await ctx.newPage(),c = await ctx.newCDPSession(p);
    p.on('pageerror',e=>errors.push(e.message));
    const read = () => p.evaluate(()=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
    const gameplay = (s:Save) => JSON.stringify({board:s.attempt.board,undo:s.attempt.undo,profile:s.profile,streak:s.attempt.streak,id:s.attempt.id});
    async function load(d:Deal,side:'left'|'right'='right',row:'top'|'bottom'='top') {
      await p.goto('http://127.0.0.1:4198');await p.locator('#app[data-ready=true]').waitFor();
      const s=freshSave(d,'board-refinement-recording');s.settings.sfx=false;s.settings.deckSide=side;s.settings.deckPosition=row;
      s.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:campaignDeals.slice(0,26).map(d=>d.id)};
      s.campaign={version:1,tutorials:['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used']};
      await p.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),s);await p.reload();await p.locator('#app[data-ready=true]').waitFor();await p.locator('#home-play').tap();await p.waitForTimeout(350);
    }
    async function geo(d:Deal) {const s=await read(),r=(await p.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height,s.settings.deckPosition,d),g=layout(s.attempt.board,d,f.height,s.settings.deckSide,s.settings.deckPosition);return {s,g,pt:(v:{x:number;y:number})=>({x:r.x+f.offsetX+v.x*f.unit,y:r.y+v.y*f.unit})};}
    async function drag(a:{x:number;y:number},b:{x:number;y:number}) {await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});for(let i=1;i<=16;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/16,y:a.y+(b.y-a.y)*i/16}]});await p.waitForTimeout(22);}await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(320);}
    async function command(d:Deal,a:BoardCommand) {
      const q=await geo(d);
      if(a.type==='transfer') {const id=a.from.kind==='waste'?q.s.attempt.board.waste.at(-1):packet(q.s.attempt.board,a.from.index,d).at(-1);await drag(q.pt(q.g.poses.find(p=>p.id===id)!),q.pt(q.g.targets.find(t=>t.location.kind===a.to.kind&&t.location.index===a.to.index)!));}
      else {const v=q.pt(q.g.stock);await p.touchscreen.tap(v.x,v.y);await p.waitForTimeout(400);}
      if(JSON.stringify((await read()).attempt.board)!==JSON.stringify(dispatch(q.s,a,d).next.attempt.board))throw Error('Refused recording action '+JSON.stringify(a));
    }
    const d=campaignDeals[5];await load(d);await p.screenshot({path:`${dir}/${width}-slots.png`});await p.waitForTimeout(550);
    for(const a of d.winningPath.slice(0,4))await command(d,a);
    const positions=new Map<string,number>();
    for(let i=1;i<=3;i++) {
      await command(d,{type:'draw'});const q=await geo(d);
      for(const [id,x]of positions)if(q.g.poses.find(p=>p.id===id)!.x!==x)throw Error('Existing card moved while opening fan');
      const id=q.s.attempt.board.waste.at(-1)!;positions.set(id,q.g.poses.find(p=>p.id===id)!.x);
      await p.screenshot({path:`${dir}/${width}-draw-${i}.png`});await p.waitForTimeout(500);
    }
    let q=await geo(d);const zone=(await p.locator('#inspect').boundingBox())!,id=q.s.attempt.board.waste.at(-1)!,before=q.s;
    await drag(q.pt(q.g.poses.find(p=>p.id===id)!),{x:zone.x+zone.width/2,y:zone.y+zone.height/2});
    if(gameplay(await read())!==gameplay(before))throw Error('Reading changed gameplay');
    await p.screenshot({path:`${dir}/${width}-reading.png`});await p.waitForTimeout(700);
    await load(d,'left','bottom');for(let i=0;i<3;i++)await command(d,{type:'draw'});
    await p.screenshot({path:`${dir}/${width}-bottom-left.png`});await p.waitForTimeout(900);
    // An ordinary early replay, with words in one topic and pictures in another.
    const mixed=campaignDeals[1];await load(mixed);for(const a of mixed.winningPath.slice(0,2))await command(mixed,a);
    await p.screenshot({path:`${dir}/${width}-words-and-pictures.png`});await p.waitForTimeout(1100);
    const modes=[...new Set(Object.values(mixed.cards).map(c=>c.category))].map(category=>({category,picture:Object.values(mixed.cards).some(c=>c.category===category&&cardArtwork(c,mixed))}));
    if(!modes.some(m=>m.picture)||!modes.some(m=>!m.picture))throw Error('Both formats must be demonstrated');
    const video=p.video()!;await c.detach();await ctx.close();await video.saveAs(`${dir}/${width}-board.webm`);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`${dir}/${width}-board.webm`,'-vf',`fps=15,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[x];[b][x]paletteuse=dither=none:diff_mode=rectangle`,`${dir}/${width}-board.gif`]);
    results.push({width,height,ordinaryDeal:d.id,firstThreeKeepEarlierPositions:true,readingFree:true,bottomLeft:true,mixedDeal:mixed.id,modes});
  }
  if(errors.length)throw Error(errors.join('\n'));await writeFile(dir+'/checks.json',JSON.stringify({results,errors},null,2)+'\n');console.info(JSON.stringify({recordings:results.length,errors}));
}finally{await browser.close();await new Promise<void>(r=>server.httpServer.close(()=>r()));}
