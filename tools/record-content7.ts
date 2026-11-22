/** Real production-input recordings of the frozen C7 bank; not a human playtest. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium,expect,type Page} from '@playwright/test';
import {preview} from 'vite';
import {campaignDeals} from '../src/content/campaign';
import {freshSave,applyBoard,sourceCards} from '../src/domain/engine';
import {campaignId} from '../src/domain/progression';
import {boardFrame,layout} from '../src/game/layout';
import type {Save,Deal,BoardCommand} from '../src/domain/types';
const root=process.env.C7_RECORD_OUTPUT??'.recording/content7-recordings',read=(p:Page)=>p.evaluate(()=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!)as Save);
await mkdir(root,{recursive:true});
async function move(p:Page,d:Deal,a:BoardCommand,drag:boolean){const before=await read(p),r=(await p.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height,before.settings.deckPosition,d),g=layout(before.attempt.board,d,f,before.settings.deckSide,before.settings.deckPosition),point=(x:{x:number;y:number})=>({x:r.x+f.offsetX+x.x*f.unit,y:r.y+x.y*f.unit});
 if(a.type==='transfer'){const id=sourceCards(before.attempt.board,a.from,d).at(-1),from=point(g.poses.find(x=>x.id===id)!),to=point(g.targets.find(x=>x.location.kind===a.to.kind&&x.location.index===a.to.index)!);
  if(drag){await p.mouse.move(from.x,from.y);await p.mouse.down();await p.mouse.move(to.x,to.y,{steps:18});await p.waitForTimeout(120);await p.mouse.up();}else{await p.touchscreen.tap(from.x,from.y);await p.touchscreen.tap(to.x,to.y);}
 }else{const t=point(g.stock);await p.touchscreen.tap(t.x,t.y);}
 const expected=applyBoard(before.attempt.board,a,d);if(typeof expected==='string')throw Error(expected);await expect.poll(async()=>(await read(p)).attempt.board,{timeout:4000}).toEqual(expected.board);await p.waitForTimeout(450);
}
const server=await preview({preview:{host:'127.0.0.1',port:4196,strictPort:true}}),browser=await chromium.launch();
const records=[];const runtimeHTMLSHA=createHash('sha256').update(await readFile('dist/index.html')).digest('hex');
try{for(const [name,levels]of [['peak-rest',[6,7]],['space-ordered',[29,30]],['keys',[49]],['middle-wave',[20,21,22]],['final-peak-rest',[76,77]]]as const){
 const context=await browser.newContext({baseURL:'http://127.0.0.1:4196',viewport:{width:360,height:780},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:root+'/raw',size:{width:360,height:780}}}),page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('#app[data-ready=true]').waitFor();
 const first=campaignDeals[levels[0]-1],s=freshSave(first,'record-c7-'+name);s.settings.sfx=true;s.settings.deckSide=name==='keys'?'left':'right';s.settings.deckPosition=name==='keys'?'bottom':'top';s.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:Array.from({length:levels[0]-1},(_,i)=>campaignId(i+1))};s.campaign={version:1,tutorials:['learn:category','learn:match','learn:stock','hint-demo','undo-used']};
 await page.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),s);await page.reload();await page.locator('#app[data-ready=true]').waitFor();await page.locator('#home-play').tap();
 let dragged=false;
 for(const [index,level]of levels.entries()){
  const d=campaignDeals[level-1];await expect(page.locator('#app')).toHaveAttribute('data-presented-deal',d.id);
  if(await page.locator('#learn-rule').isVisible()){await page.screenshot({path:`${root}/level-${level}-intro.png`,scale:'css'});await page.waitForTimeout(700);await page.locator('#learn-rule .primary').tap();}
  await page.waitForTimeout(800);await page.screenshot({path:`${root}/level-${level}-start.png`,scale:'css'});
  for(const a of d.winningPath){const b=(await read(page)).attempt.board,drag=!dragged&&a.type==='transfer'&&sourceCards(b,a.from,d).length>=2;await move(page,d,a,drag);if(drag)dragged=true;}
  await page.locator('#result[open]').waitFor();await page.waitForTimeout(900);await page.screenshot({path:`${root}/level-${level}-result.png`,scale:'css'});records.push({level,id:d.id,initialSHA:createHash('sha256').update(JSON.stringify(d.initial)).digest('hex'),actions:d.winningPath.length,phase:(await read(page)).attempt.board.phase,normalMotion:true,dragged,source:'Production mouse drag + touchscreen taps; no runtime test bridge',humanPlaytest:false});
  if(index<levels.length-1){await page.locator('#next-level').tap();await page.waitForTimeout(500);}
 }
 if(errors.length)throw Error(errors.join('\n'));
 const v=page.video()!;await context.close();await v.saveAs(`${root}/${name}.webm`);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`${root}/${name}.webm`,'-vf','fps=6,scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',`${root}/${name}.gif`]);console.log(name+' recorded');
}}finally{await browser.close();server.httpServer.close();}
await writeFile(`${root}/manifest.json`,JSON.stringify({contentVersion:7,runtimeHTMLSHA,records,limitations:'Automated known routes with real UI input. WebM/GIF does not capture browser audio. No human difficulty, physical-device performance or native ad claim.'},null,2)+'\n');
