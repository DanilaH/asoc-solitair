/** Failure injection uses the real SaveStore and UI; isolated browser data only. */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { freshSave } from '../src/domain/engine';
import { boardFrame, layout } from '../src/game/layout';
const output='.recording/all-screen-audit-2026-11-14/recovery';await mkdir(output,{recursive:true});
const browser=await chromium.launch(),server=await preview({preview:{host:'127.0.0.1',port:4198,strictPort:true}});const results:object[]=[];
try{
 const s=freshSave(campaignDeals[0],'recovery-audit');s.settings.sfx=false;s.campaign={version:1,tutorials:['learn:category','learn:match','learn:stock']};
 const ctx=await browser.newContext({viewport:{width:320,height:568},deviceScaleFactor:1,isMobile:true,hasTouch:true});const p=await ctx.newPage();
 await p.addInitScript(save=>{localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(save));const original=Storage.prototype.getItem;let fail=true;Storage.prototype.getItem=function(k){if(k==='asoc-solitaire.save.v1'&&fail){fail=false;throw Error('Simulated temporary storage read failure');}return original.call(this,k);};},s);
 await p.goto('http://127.0.0.1:4198');await p.locator('.fatal').waitFor();await p.screenshot({path:output+'/startup-read-error.png',scale:'css'});
 results.push({name:'startup-read-error',text:await p.locator('.fatal').innerText(),buttons:await p.locator('.fatal button').count(),durableUnchanged:await p.evaluate(original=>localStorage.getItem('asoc-solitaire.save.v1')===original,JSON.stringify(s))});await ctx.close();
 const ctx2=await browser.newContext({viewport:{width:320,height:568},deviceScaleFactor:1,isMobile:true,hasTouch:true});const q=await ctx2.newPage();
 await q.goto('http://127.0.0.1:4198');await q.locator('#app[data-ready=true]').waitFor();await q.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),s);await q.reload();await q.locator('#app[data-ready=true]').waitFor();await q.locator('#home-play').tap();await q.waitForTimeout(350);
 const before=await q.evaluate(()=>localStorage.getItem('asoc-solitaire.save.v1')!);
 await q.evaluate(()=>{const w=window as typeof window&{__readOriginal?:(k:string)=>string|null;__restoreStorage?:()=>void};const set=Storage.prototype.setItem,get=Storage.prototype.getItem;w.__readOriginal=k=>get.call(localStorage,k);Storage.prototype.setItem=function(k,v){if(k==='asoc-solitaire.save.v1')throw Error('Simulated write failure');set.call(this,k,v);};Storage.prototype.getItem=function(k){if(k==='asoc-solitaire.save.v1')throw Error('Simulated verification read failure');return get.call(this,k);};w.__restoreStorage=()=>{Storage.prototype.setItem=set;Storage.prototype.getItem=get;};});
 const r=(await q.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height,s.settings.deckPosition,campaignDeals[0]),g=layout(s.attempt.board,campaignDeals[0],f.height,s.settings.deckSide,s.settings.deckPosition);const cmd=campaignDeals[0].winningPath[0];if(cmd.type!=='transfer'||cmd.from.kind!=='tableau')throw Error('Teaching transfer changed');const a=g.poses.find(p=>p.id===s.attempt.board.tableau[cmd.from.kind==='tableau'?cmd.from.index:0].at(-1))!,b=g.targets.find(t=>t.location.kind===cmd.to.kind&&t.location.index===cmd.to.index)!;
 await q.touchscreen.tap(r.x+a.x*f.unit,r.y+a.y*f.unit);await q.touchscreen.tap(r.x+b.x*f.unit,r.y+b.y*f.unit);await q.locator('#save-retry').waitFor();await q.screenshot({path:output+'/save-retry.png',scale:'css'});const button=(await q.locator('#save-retry').boundingBox())!;
 const during={name:'save-retry',message:await q.locator('#message').innerText(),buttonRect:button,buttonVisible:button.y>=0&&button.y+button.height<=568,durableUnchanged:await q.evaluate(raw=>(window as typeof window&{__readOriginal:(k:string)=>string|null}).__readOriginal('asoc-solitaire.save.v1')===raw,before)};
 await q.evaluate(()=>(window as typeof window&{__restoreStorage:()=>void}).__restoreStorage());await q.locator('#save-retry').tap();await q.waitForTimeout(350);results.push({...during,retryHidden:!await q.locator('#save-retry').isVisible(),afterBoardUnchanged:await q.evaluate(raw=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!).attempt.board.movesLeft===JSON.parse(raw).attempt.board.movesLeft,before)});await q.screenshot({path:output+'/save-restored.png',scale:'css'});await ctx2.close();
}finally{await browser.close();await new Promise<void>(r=>server.httpServer.close(()=>r()));}
await writeFile(output+'/checks.json',JSON.stringify({source:'47c57b6d8d8c81d01c9a945e28b42ba6a37491ca',results},null,2)+'\n');console.info(JSON.stringify(results));
