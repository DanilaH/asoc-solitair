import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { freshSave, dispatch, packet } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import type { Board, BoardCommand, Deal, Save } from '../../src/domain/types';
const read=(p:Page)=>p.evaluate(()=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
function saveFor(d:Deal) {
  const s=freshSave(d,'rules-browser');s.settings.reducedMotion=true;
  s.platform={receipts:['earned'],continuedAttempts:[],continueCredits:0,winsSinceInterstitial:0,lastFullscreenAt:0,completedCampaign:campaignDeals.slice(0,26).map(d=>d.id)};
  s.campaign={version:1,tutorials:['intro:joker','intro:ordered','intro:keys','learn:category','learn:match','learn:stock','hint-demo','undo-used']};return s;
}
async function open(p:Page,s:Save) {
  await p.goto('/');await p.locator('#app[data-ready=true]').waitFor();
  await p.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),s);
  await resume(p);
}
async function resume(p:Page) {await p.reload();await p.locator('#app[data-ready=true]').waitFor();await p.locator('#home-play').tap();await p.waitForTimeout(100);}
async function move(p:Page,context:BrowserContext,d:Deal,a:BoardCommand,drag=false) {
  if(a.type!=='transfer')throw Error('Transfer expected');
  const s=await read(p),r=(await p.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height,s.settings.deckPosition,d),g=layout(s.attempt.board,d,f.height,s.settings.deckSide,s.settings.deckPosition);
  const id=a.from.kind==='waste'?s.attempt.board.waste.at(-1):packet(s.attempt.board,a.from.index,d).at(-1);
  const pt=(v:{x:number;y:number})=>({x:r.x+f.offsetX+v.x*f.unit,y:r.y+v.y*f.unit});
  const from=pt(g.poses.find(v=>v.id===id)!),to=pt(g.targets.find(t=>t.location.kind===a.to.kind&&t.location.index===a.to.index)!);
  if(!drag){await p.touchscreen.tap(from.x,from.y);await p.touchscreen.tap(to.x,to.y);}
  else {const c=await context.newCDPSession(p);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});for(let i=1;i<=12;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
}
const transfer=(from:number,to:number,kind:'tableau'|'foundation'='tableau'):BoardCommand=>({type:'transfer',from:{kind:'tableau',index:from},to:{kind,index:to}});
test('new flashlight drop refuses by drag and tap; upper collection and Undo still work',async({page,context})=>{
  const d=campaignDeals[5];await open(page,saveFor(d));const initial=await read(page);
  for(const drag of [true,false]) {
    await move(page,context,d,transfer(0,1),drag);await expect(page.locator('#message')).toHaveText('Сначала перенесите тему в верхний слот');
    expect((await read(page)).attempt.board).toEqual(initial.attempt.board);expect((await read(page)).profile).toEqual(initial.profile);expect((await read(page)).attempt.undo).toEqual([]);
  }
  await page.screenshot({path:test.info().outputPath('lower-theme-refused.png')});
  await move(page,context,d,transfer(1,1,'foundation'));await expect.poll(async()=>(await read(page)).attempt.board.foundations[1]).toEqual(['lights']);
  await move(page,context,d,transfer(0,1,'foundation'),true);await expect.poll(async()=>(await read(page)).attempt.board.foundations[1]).toEqual(['lights_3','lights']);
  expect((await read(page)).attempt.board.movesLeft).toBe(30);await page.locator('#undo').tap();
  await expect.poll(async()=>(await read(page)).attempt.board.foundations[1]).toEqual(['lights']);expect((await read(page)).attempt.board.rulesVersion).toBe(3);
});
test('old saved attempt keeps its legal move and Undo; confirmed restart changes to new rules',async({page,context})=>{
  const d=campaignDeals[5],s=saveFor(d);s.rulesVersion=2;delete s.attempt.board.rulesVersion;
  await open(page,s);const old=await read(page);expect(old.attempt.board.rulesVersion).toBe(2);
  await move(page,context,d,transfer(0,1),true);await expect.poll(async()=>(await read(page)).attempt.board.movesLeft).toBe(31);
  const moved=await read(page);await resume(page);expect((await read(page)).attempt.board).toEqual(moved.attempt.board);
  await page.locator('#undo').tap();await expect.poll(async()=>(await read(page)).attempt.board).toEqual(old.attempt.board);const before=await read(page);
  await page.locator('#menu').tap();await page.locator('#restart').tap();await expect(page.locator('#restart-confirm-copy')).toContainText('тему сначала нужно перенести в верхний слот');
  await page.locator('#restart-confirm [data-close]').tap();expect((await read(page)).attempt).toEqual(before.attempt);
  await page.locator('#menu').tap();await page.locator('#restart').tap();await page.locator('#restart-confirm-yes').tap();
  await expect.poll(async()=>(await read(page)).attempt.board.rulesVersion).toBe(3);
  const after=await read(page);expect(after.attempt.id).not.toBe(before.attempt.id);expect(after.profile).toEqual(before.profile);expect(after.platform?.receipts).toEqual(['earned']);
  await move(page,context,d,transfer(0,1));await expect(page.locator('#message')).toContainText('Сначала перенесите тему');expect((await read(page)).attempt.board.movesLeft).toBe(32);
});
test('a valid old 301-command save recovers; one more real move and reload keep the bounded history',async({page,context})=>{
  const d=campaignDeals[0];let s=saveFor(d);const all:Board[]=[];
  const step=(a:BoardCommand)=>{all.push(structuredClone(s.attempt.board));const r=dispatch(s,a,d);if(!r.accepted)throw Error(r.reason);s=r.next;};
  d.winningPath.slice(0,5).forEach(step);for(let i=0;i<296;i++)step(transfer(i%2===0?1:0,i%2===0?0:1));
  s.rulesVersion=2;s.attempt.undo=all;for(const b of [s.attempt.board,...s.attempt.undo])delete b.rulesVersion;
  const board=structuredClone(s.attempt.board),profile=structuredClone(s.profile);await open(page,s);
  expect((await read(page)).attempt.undo).toHaveLength(300);expect((await read(page)).attempt.board.tableau).toEqual(board.tableau);expect((await read(page)).profile).toEqual(profile);
  const from=board.tableau.findIndex(c=>c.length>0),to=1-from;await move(page,context,d,transfer(from,to));
  await expect.poll(async()=>(await read(page)).attempt.board.tableau[to]).toEqual(['birds_2']);const after=await read(page);
  await resume(page);expect((await read(page)).attempt.board).toEqual(after.attempt.board);expect((await read(page)).attempt.undo).toHaveLength(300);
  await page.screenshot({path:test.info().outputPath('long-history-resumed.png')});
});
