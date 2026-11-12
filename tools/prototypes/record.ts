import { mkdir,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { dispatch,freshSave,packet } from '../../src/domain/engine';
import { boardFrame,layout } from '../../src/game/layout';
import data from './deals.json' with {type:'json'};
import type { Prototype } from './build';
const deals=data as unknown as Prototype[],dir='.recording/prototypes-evidence';await mkdir(dir,{recursive:true});
const server=await preview({configFile:'vite.prototypes.config.ts',preview:{host:'127.0.0.1',port:4199,strictPort:true}}),browser=await chromium.launch();
const results:unknown[]=[],errors:string[]=[];
try{for(const width of [360,320]){
 const ctx=await browser.newContext({viewport:{width,height:width===360?780:568},isMobile:true,hasTouch:true,recordVideo:width===360?{dir:dir+'/videos',size:{width:360,height:780}}:undefined}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('asoc-solitaire.save.v1','QA isolation sentinel'));
 await p.goto('http://127.0.0.1:4199/tools/prototypes/index.html');await p.locator('#lab[data-ready=true]').waitFor();
 for(const [index,d]of deals.entries()){
  await p.locator('#choose').selectOption(String(index));await p.waitForTimeout(500);let s=freshSave(d,'record');await p.screenshot({path:`${dir}/${width}-${index+1}-start.png`});
  for(const [i,a]of d.winningPath.entries()){
   const r=(await p.locator('canvas').boundingBox())!,f=boardFrame(r.width,r.height,undefined,d),g=layout(s.attempt.board,d,f.height),tap=(q:{x:number;y:number})=>p.touchscreen.tap(r.x+f.offsetX+q.x*f.unit,r.y+q.y*f.unit);
   if(a.type==='transfer'){const id=a.from.kind==='waste'?s.attempt.board.waste.at(-1):packet(s.attempt.board,a.from.index,d).at(-1);await tap(g.poses.find(q=>q.id===id)!);await tap(g.targets.find(q=>q.location.kind===a.to.kind&&q.location.index===a.to.index)!);}else await tap(g.stock);
   s=dispatch(s,a,d).next;await p.waitForTimeout(260);await p.locator('#lab').evaluate((el,revision)=>{if(el.getAttribute('data-revision')!==String(revision))throw Error('Input was not accepted')},s.revision);
   if(i===2)await p.screenshot({path:`${dir}/${width}-${index+1}-middle.png`});
  }
  await p.locator('#lab[data-phase=won]').waitFor();await p.waitForTimeout(800);await p.screenshot({path:`${dir}/${width}-${index+1}-won.png`});results.push({id:d.id,width,moves:d.winningPath.length,phase:'won'});
 }
 if(await p.evaluate(()=>localStorage.getItem('asoc-solitaire.save.v1'))!=='QA isolation sentinel')throw Error('Ordinary save touched');
 const video=p.video();await ctx.close();if(video){await video.saveAs(dir+'/six-deals.webm');execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',dir+'/six-deals.webm','-t','22','-vf','fps=12,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none',dir+'/first-deal.gif']);}
}
if(errors.length)throw Error(errors.join('\n'));await writeFile('docs/qa/prototypes-2026-11-12/browser.json',JSON.stringify({results,errors,ordinarySaveUntouched:true},null,2)+'\n');console.info('PASS 12 full production-renderer touch routes');
}finally{await browser.close();await new Promise<void>(r=>server.httpServer.close(()=>r()));}
