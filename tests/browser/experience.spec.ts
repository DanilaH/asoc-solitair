import { pauseOptions } from '../../tools/qa/navigation';
import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { dailyPool } from '../../src/content/daily';
import { freshSave, dispatch, packet } from '../../src/domain/engine';
import { categoryCaption } from '../../src/game/captions';
import { boardFrame, layout } from '../../src/game/layout';
import type { Save } from '../../src/domain/types';
const read=(p:Page)=>p.evaluate(()=>JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function load(p:Page,index:number,change?:(s:Save)=>void) {
  await p.goto('/');await p.locator('#app[data-ready=true]').waitFor();
  let s=freshSave(campaignDeals[index],'experience-test');s.settings.reducedMotion=true;
  s.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:campaignDeals.slice(0,index).map(d=>d.id)};
  change?.(s);await p.evaluate(s=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(s)),s);
  await p.reload();await p.locator('#app[data-ready=true]').waitFor();await p.locator('#home-play').tap();
}
test('all published category names stay distinct and fit the readable title floor',async({page})=>{
  await page.goto('/');await page.locator('#app[data-ready=true]').waitFor();await page.evaluate(()=>document.fonts.ready);
  const names=[];
  for(const d of [...campaignDeals,...dailyPool]){const leaders=Object.values(d.cards).filter(c=>c.leader).map(c=>categoryCaption(c.text));expect(new Set(leaders).size).toBe(leaders.length);names.push(...leaders.map(text=>({text,width:d.initial.tableau.length>=4?106:120})));}
  const overflowing=await page.evaluate(names=>{const c=document.createElement('canvas').getContext('2d')!;c.font='bold 24px Nunito';return names.filter(n=>c.measureText(n.text).width*.74>n.width+.5)},names);
  expect(overflowing).toEqual([]);
});
test('a picture opens a real preview and closing it ends the mode without a charge',async({page})=>{
  await load(page,10);const before=await read(page),deal=campaignDeals[10],r=(await page.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height),g=layout(before.attempt.board,deal,f.height);
  const id=deal.initial.tableau.map(c=>c.at(-1)!).find(id=>deal.cards[id].image)!,pose=g.poses.find(p=>p.id===id)!;
  await page.locator('#inspect').tap();await page.touchscreen.tap(r.x+pose.x*f.unit,r.y+pose.y*f.unit);
  await expect(page.locator('#word-image')).toBeVisible();expect(await page.locator('#word-image').evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#word-description')).toBeHidden();await page.locator('#inspect-dialog .primary').tap();await expect(page.locator('#inspect')).toHaveAttribute('aria-pressed','false');
  expect((await read(page)).attempt.board).toEqual(before.attempt.board);expect((await read(page)).profile).toEqual(before.profile);
});
test('empty Undo opens only Undo, purchase returns to the same board without applying it',async({page})=>{
  await load(page,16,s=>{Object.assign(s,dispatch(s,campaignDeals[16].winningPath[0],campaignDeals[16]).next);s.profile.undos=0;});const before=await read(page);
  await page.locator('#undo').tap();await expect(page.locator('#helper-title')).toHaveText('Отмена');await expect(page.locator('#hint-offer')).toBeHidden();await expect(page.locator('#undo-offer')).toBeVisible();
  await page.locator('#buy-undo').tap();await expect(page.locator('#helpers')).toBeHidden();const after=await read(page);expect(after.profile.undos).toBe(1);expect(after.profile.coins).toBe(before.profile.coins-60);expect(after.attempt.board).toEqual(before.attempt.board);expect(after.attempt.id).toBe(before.attempt.id);
});
test('failure promotes available Undo, and a stored continue credit takes priority without a video',async({page})=>{
  await load(page,16,s=>{while(s.attempt.board.phase==='playing')Object.assign(s,dispatch(s,{type:s.attempt.board.stock.length?'draw':'recycle'},campaignDeals[16]).next)});
  await expect(page.locator('#result')).toBeVisible();await expect(page.locator('#result-continue')).toBeHidden();await expect(page.locator('#result-undo')).toHaveClass('primary');
  await load(page,16,s=>{while(s.attempt.board.phase==='playing')Object.assign(s,dispatch(s,{type:s.attempt.board.stock.length?'draw':'recycle'},campaignDeals[16]).next);s.platform!.continueCredits=1;});
  await expect(page.locator('#result-continue')).toBeVisible();await expect(page.locator('#result-continue')).toHaveClass('primary');await expect(page.locator('#result-continue')).toBeEnabled();const before=await read(page);await page.locator('#result-continue').tap();await expect(page.locator('#result')).toBeHidden();expect((await read(page)).attempt.board.movesLeft).toBe(before.attempt.board.movesLeft!+10);
});

test('an isolated near drop is accepted, a distant miss is cancelled, and repeated Hint is free',async({page,context})=>{
  for(const near of [true,false]){
    await load(page,16);const before=await read(page),deal=campaignDeals[16],r=(await page.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height),g=layout(before.attempt.board,deal,f.height),cmd=deal.winningPath[0];if(cmd.type!=='transfer')throw Error('changed witness');
    const id=cmd.from.kind==='waste'?before.attempt.board.waste.at(-1):packet(before.attempt.board,cmd.from.index,deal).at(-1),from=g.poses.find(p=>p.id===id)!,to=g.targets.find(t=>t.location.kind===cmd.to.kind&&t.location.index===cmd.to.index)!,a={x:r.x+from.x*f.unit,y:r.y+from.y*f.unit},b={x:r.x+to.x*f.unit,y:r.y+(to.y+to.height/2)*f.unit+(near?8:155)};
    const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/10,y:a.y+(b.y-a.y)*i/10}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    if(near)await expect.poll(async()=>(await read(page)).attempt.board).toEqual(dispatch(before,cmd,deal).next.attempt.board);
    else {await page.waitForTimeout(350);expect((await read(page)).attempt.board).toEqual(before.attempt.board);expect((await read(page)).profile).toEqual(before.profile);}
  }
  await load(page,16,s=>{s.profile.hints=1});await page.locator('#hint').tap();await expect(page.locator('#hint-label')).toHaveText('Повторить');const before=await read(page);expect(before.profile.hints).toBe(0);await page.locator('#hint').tap();await expect(page.locator('#helpers')).toBeHidden();expect((await read(page)).profile).toEqual(before.profile);expect((await read(page)).attempt.board).toEqual(before.attempt.board);
});

test('a brand new profile starts in the first deal and daily appears after the basics',async({page})=>{
  await page.goto('/');await page.locator('#app[data-ready=true]').waitFor();await expect(page.locator('#app')).toHaveAttribute('data-screen','game');await expect(page.locator('#level-number')).toHaveText('УРОВЕНЬ 1');
  await page.locator('#menu').tap();await page.locator('#levels-open').tap();await expect(page.locator('#daily-play')).toBeHidden();
  await load(page,2);await page.locator('#menu').tap();await page.locator('#levels-open').tap();await expect(page.locator('#daily-play')).toBeVisible();
});
test('first modifier lessons can be dismissed without spending and stay dismissed after reload',async({page})=>{
  for(const [index,rule] of [[20,'joker'],[22,'ordered'],[25,'keys']] as const){
    await load(page,index);await expect(page.locator('#learn-rule')).toBeVisible();await expect(page.locator('#learn-rule')).toHaveAttribute('data-rule',rule);const before=await read(page);
    await page.locator('#learn-rule .primary').tap();await expect(page.locator('#learn-rule')).toBeHidden();const after=await read(page);expect(after.campaign!.tutorials).toContain(`intro:${rule}`);expect(after.profile).toEqual(before.profile);expect(after.attempt.board).toEqual(before.attempt.board);
    await page.reload();await page.locator('#app[data-ready=true]').waitFor();await page.locator('#home-play').tap();await expect(page.locator('#learn-rule')).toBeHidden();
  }
});

test('a milestone previews its real cosmetic and applying it grants no extra reward',async({page})=>{
  await load(page,9,s=>{s.meta!.winCycle=4;for(const cmd of campaignDeals[9].winningPath)Object.assign(s,dispatch(s,cmd,campaignDeals[9]).next)});
  await expect(page.locator('#unlock-reward')).toBeVisible();await expect(page.locator('#unlock-title')).toContainText('Чернила');const before=await read(page);
  await expect(page.locator('#result-total')).toHaveText('+'+(before.attempt.payout!.reduce((n,r)=>n+r.coins,0)+before.attempt.streak.coins));
  await expect(page.getByText('Подробнее о награде')).toHaveCount(0);await page.locator('#apply-unlock').tap();await expect(page.locator('#apply-unlock')).toBeDisabled();expect((await read(page)).settings.palette).toBe('ink');expect((await read(page)).profile).toEqual(before.profile);expect((await read(page)).attempt.board).toEqual(before.attempt.board);
  await page.reload();await page.locator('#app[data-ready=true]').waitFor();await page.locator('#home-play').tap();await expect(page.locator('#apply-unlock')).toHaveText('Применено');expect((await read(page)).profile).toEqual(before.profile);
});
test('pause exposes three game actions, preferences expand, and the saved replay is marked separately',async({page})=>{
  await load(page,16,s=>{s.platform!.completedCampaign=campaignDeals.slice(0,25).map(d=>d.id)});
  const wallet=(await page.locator('#wallet-open').boundingBox())!;expect(wallet.height).toBeGreaterThanOrEqual(44);
  await page.locator('#menu').tap();await expect(page.locator('#appearance-settings')).toBeHidden();await expect(page.locator('#settings-done')).toBeVisible();await expect(page.locator('#restart')).toBeVisible();await expect(page.locator('#levels-open')).toBeVisible();
  await pauseOptions(page);await expect(page.locator('#appearance-settings')).toBeVisible();await expect(page.locator('#haptics')).toBeVisible();await page.locator('#pause-options summary').tap();await page.locator('#levels-open').tap();await page.locator('#level-picker-open').tap();await expect(page.locator('#level-17')).toHaveAttribute('data-active','true');await page.locator('#chapter-next').tap();await expect(page.locator('#level-26')).toHaveAttribute('data-next','true');
});
