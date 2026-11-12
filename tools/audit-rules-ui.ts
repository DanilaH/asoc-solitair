/** Production input audit, no runtime test bridge. Saves are seeded only at initial published deals. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { freshSave } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
import type { Deal, Location, Save } from '../src/domain/types';

const dir='.recording/rules-ui';await mkdir(dir,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:4197,strictPort:true}}),browser=await chromium.launch();
const evidence:object[]=[],errors:string[]=[];
try {
  for(const [width,height]of [[360,780],[320,568]]) {
    const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:dir+'/video',size:{width,height}}});
    const p=await ctx.newPage(),cdp=await ctx.newCDPSession(p);p.on('pageerror',e=>errors.push(e.message));
    const read=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
    async function load(d:Deal,reduced=false) {
      await p.goto('http://127.0.0.1:4197');await p.locator('#app[data-ready=true]').waitFor();
      const s=freshSave(d,'rules-audit-ui');s.settings.sfx=false;s.settings.reducedMotion=reduced;
      s.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:campaignDeals.slice(0,26).map(d=>d.id)};
      s.campaign={version:1,tutorials:['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used']};
      await p.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),s);await p.reload();await p.locator('#app[data-ready=true]').waitFor();await p.locator('#home-play').tap();await p.waitForTimeout(250);
    }
    async function geometry(d:Deal) {
      const s=await read(),r=(await p.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height,s.settings.deckPosition,d),g=layout(s.attempt.board,d,f.height,s.settings.deckSide,s.settings.deckPosition);
      return {s,g,point:(v:{x:number;y:number})=>({x:r.x+f.offsetX+v.x*f.unit,y:r.y+v.y*f.unit})};
    }
    async function action(d:Deal,id:string,to:Location,drag=false) {
      const q=await geometry(d),a=q.point(q.g.poses.find(v=>v.id===id)!),b=q.point(q.g.targets.find(t=>t.location.kind===to.kind&&t.location.index===to.index)!);
      if(drag) {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
        for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/12,y:a.y+(b.y-a.y)*i/12}]});await p.waitForTimeout(20);}
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }else{await p.touchscreen.tap(a.x,a.y);await p.touchscreen.tap(b.x,b.y);}
      await p.waitForTimeout(q.s.settings.reducedMotion?18:350);return read();
    }
    const d=campaignDeals[5];await load(d);const start=await read();
    await p.screenshot({path:`${dir}/${width}-before.png`});
    const merged=await action(d,'lights_3',{kind:'tableau',index:1},true);
    assert.deepEqual(merged.attempt.board.tableau[1],['lights_1','lights_2','lights_3','lights']);
    assert.equal(merged.attempt.board.movesLeft,start.attempt.board.movesLeft!-1);
    await p.screenshot({path:`${dir}/${width}-member-on-lower-theme.png`});
    await p.locator('#undo').tap();await p.waitForTimeout(300);const undone=await read();assert.deepEqual(undone.attempt.board,start.attempt.board);assert.equal(undone.profile.undos,start.profile.undos-1);
    const upper=await action(d,'lights',{kind:'foundation',index:1});assert.deepEqual(upper.attempt.board.foundations[1],['lights']);
    const wrongEmpty=await action(d,'lights_3',{kind:'foundation',index:0});assert.deepEqual(wrongEmpty.attempt.board,upper.attempt.board);assert.deepEqual(wrongEmpty.profile,upper.profile);
    assert.match(await p.locator('#message').innerText(),/Сначала нужна карта категории/);
    const correct=await action(d,'lights_3',{kind:'foundation',index:1});assert.deepEqual(correct.attempt.board.foundations[1],['lights_3','lights']);
    const wrongTheme=await action(d,'kitchen_2',{kind:'foundation',index:1});assert.deepEqual(wrongTheme.attempt.board,correct.attempt.board);assert.deepEqual(wrongTheme.profile,correct.profile);
    assert.match(await p.locator('#message').innerText(),/другая категория/);
    // Trying to drag a foundation card does not create a source command.
    const noReturn=await action(d,'lights',{kind:'tableau',index:1},true);assert.deepEqual(noReturn.attempt.board,correct.attempt.board);
    evidence.push({width,height,deal:d.id,disputed:{accepted:true,before:start.attempt.board,after:merged.attempt.board},undoRestores:true,emptyUpperRejectsMember:true,matchingUpperAccepts:true,wrongCategoryRejects:true,upperSourceUnavailable:true});

    // Every one of these 301 commands is actually tapped on the production board.
    const first=campaignDeals[0];await load(first,true);
    for(const a of first.winningPath.slice(0,5)) {
      if(a.type!=='transfer')throw Error('Unexpected opening');const s=await read(),id=s.attempt.board.tableau[a.from.index].at(-1)!;
      await action(first,id,a.to);
    }
    for(let i=0;i<296;i++) {
      const before=await read(),next=await action(first,'birds_2',{kind:'tableau',index:i%2===0?0:1});
      assert.equal(next.attempt.undo.length,before.attempt.undo.length+1,`Real command ${i+6}`);
    }
    const long=await read();assert.equal(long.attempt.undo.length,301);assert.equal(long.attempt.board.phase,'playing');
    await p.screenshot({path:`${dir}/${width}-301-before-reload.png`});await p.reload();
    await p.getByText('Повреждена история',{exact:false}).waitFor();
    await p.screenshot({path:`${dir}/${width}-301-reload-error.png`});
    assert.equal((await read()).attempt.undo.length,301,'Original data retained after refused load');
    evidence.push({width,height,deal:first.id,realAcceptedCommands:301,history:301,reloadError:'Повреждена история',originalRetained:true});
    const video=p.video()!;await cdp.detach();await ctx.close();await video.saveAs(`${dir}/${width}-rules.webm`);
  }
  assert.deepEqual(errors,[]);await mkdir('docs/qa/rules-audit-2026-11-12',{recursive:true});
  await writeFile('docs/qa/rules-audit-2026-11-12/ui.json',JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),surface:'production browser, actual CDP touch / touchscreen taps; initial published deals only',evidence,errors},null,2)+'\n');
  console.info(JSON.stringify({cases:evidence.length,errors}));
}finally{await browser.close();await new Promise<void>(r=>server.httpServer.close(()=>r()));}
