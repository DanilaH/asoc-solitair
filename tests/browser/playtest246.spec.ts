import { expect,test,type Page } from '@playwright/test';
import { playtestCore,playtestSet,playtestKey } from '../../src/content/campaign-playtest';
import { applyBoard,freshSave,sourceCards } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { boardFrame,cardMetrics,layout } from '../../src/game/layout';
import type { BoardCommand,Deal,Save } from '../../src/domain/types';
import { read } from './wallet-fixture';

const mode=process.env.VITE_ASOC_CAMPAIGN_PLAYTEST;
test.skip(mode!=='azur21-v1'&&mode!=='hybrid21-v1','Separate candidate application');
if(process.env.ASOC_PLAYTEST_RECORD==='1')test.use({video:'on'});
function dealAt(level:number){const bank=playtestCore(level,mode as 'azur21-v1'|'hybrid21-v1',25)!;
  const entry=bank.byLevel.get(level)!.find(e=>e.penalty===0)!;return bank.byId.get(entry.deal.id+'-m1')!.deal;}
function saved(deal:Deal,prefix=0){const save=freshSave(deal,'candidate-ui');save.profile.coins=2000;save.profile.hints=2;
  save.settings.reducedMotion=true;save.campaign={version:1,tutorials:['intro:ordered','intro:keys','intro:joker','learn:category','learn:match','learn:stock','hint-demo','undo-used']};
  save.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,
    completedCampaign:Array.from({length:deal.campaignLevel!-1},(_,i)=>campaignId(i+1))};
  for(const action of deal.winningPath.slice(0,prefix)){const r=applyBoard(save.attempt.board,action,deal);if(typeof r==='string')throw Error(r);save.attempt.board=r.board;}
  return save;
}
async function seed(page:Page,save:Save){await page.addInitScript(value=>{if(!localStorage.getItem('asoc-solitaire.save.v1'))localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(value));},save);
  await page.goto('/');await expect(page.locator('#app')).toHaveAttribute('data-ready','true');await page.locator('#home-play').tap();
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing','0');}
async function touch(page:Page,deal:Deal,action:BoardCommand){
  const save=await read(page),board=save.attempt.board,rect=(await page.locator('#game-root').boundingBox())!;
  const frame=boardFrame(rect.width,rect.height,save.settings.deckPosition,deal),grid=layout(board,deal,frame,save.settings.deckSide,save.settings.deckPosition);
  const tap=(x:number,y:number)=>page.touchscreen.tap(rect.x+frame.offsetX+x*frame.unit,rect.y+y*frame.unit);
  if(action.type!=='transfer')await tap(grid.stock.x,grid.stock.y);
  else if(action.scissors==='unbind'||action.scissors==='discard')await page.getByRole('button',{name:action.scissors==='unbind'?'Снять связь':'Убрать ножницы',exact:false}).first().tap();
  else{
    const cards=sourceCards(board,action.from,deal,action.root),id=action.scissors?board.tableau[action.from.index].at(-1)!:cards[0];
    const source=grid.poses.find(p=>p.id===id)!,below=grid.poses.find(p=>p.id===cards[1]);
    const y=below?(source.y+below.y)/2-cardMetrics(deal).height/2:source.y;
    const target=grid.targets.find(t=>t.location.kind===action.to.kind&&t.location.index===action.to.index)!;
    await tap(source.x,y);await tap(target.x,target.y);
  }
  const result=applyBoard(board,action,deal);if(typeof result==='string')throw Error(result);
  await expect.poll(async()=>(await read(page)).attempt.board).toEqual(result.board);
}
test('separate fresh checkpoint, real initial input and reopen',async({page},info)=>{
  const started=Date.now();await page.goto('/');await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  const cold=Date.now()-started,save=await read(page);expect(save.profile.coins).toBe(100);
  expect(save.attempt.issuance?.admission?.profile).toBe(mode);expect(save.platform?.completedCampaign).toHaveLength(80);
  await expect(page.locator('#home-progress')).toContainText('81–101');
  if(await page.locator('#home-play').isVisible())await page.locator('#home-play').tap();
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing','0');
  const current=await read(page),bank=playtestCore(81,mode as 'azur21-v1'|'hybrid21-v1',25)!;
  const deal=bank.byId.get(current.attempt.dealId)!.deal;await touch(page,deal,deal.winningPath[0]);
  await page.screenshot({path:info.outputPath('initial-board.png')});
  const after=await read(page);await page.reload();await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  expect((await read(page)).attempt.board).toEqual(after.attempt.board);
  await info.attach('browser-cold-start.json',{body:JSON.stringify({ms:cold,nativeDevice:false}),contentType:'application/json'});
});
test('unused Hint survives repeat and reload, then spends on the recommended action',async({page},info)=>{
  const deal=dealAt(81),save=saved(deal);await seed(page,save);
  await page.locator('#hint').tap();await expect.poll(async()=>(await read(page)).attempt.stagedHint?.version).toBe(1);
  expect((await read(page)).profile.hints).toBe(2);await page.locator('#hint').tap();expect((await read(page)).profile.hints).toBe(2);
  await page.screenshot({path:info.outputPath('hint-offered.png')});await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready','true');await page.locator('#home-play').tap();
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing','0');
  const action=(await read(page)).attempt.stagedHint!.action;await touch(page,deal,action);
  expect((await read(page)).profile.hints).toBe(1);expect((await read(page)).attempt.stagedHint).toBeUndefined();
  await page.screenshot({path:info.outputPath('hint-applied.png')});
});
for(const feature of ['ordered','ice','lock','bound','puzzle','magnet','hammer','gold'])test(`actual ${feature} effect on an admitted field`,async({page},info)=>{
  const level=Array.from({length:21},(_,i)=>81+i).find(level=>playtestSet(playtestKey(level,mode as 'azur21-v1'|'hybrid21-v1'))?.recipe.feature===feature)!;
  const deal=dealAt(level);let board=deal.initial,at=-1;
  for(let i=0;i<deal.winningPath.length;i++){
    const action=deal.winningPath[i],r=applyBoard(board,action,deal);if(typeof r==='string')throw Error(r);
    const qualifies=feature==='ordered'?action.type==='transfer'&&r.events.some(e=>e.cards?.some(id=>(board.hitapps?.cards[id]?.order??0)>0)):
      r.events.some(e=>feature==='lock'?e.type==='unlock':feature==='puzzle'?e.type==='assemble':feature==='bound'?e.type==='cut':
        feature==='gold'?e.type==='gold'&&e.reason==='activated':feature==='magnet'||feature==='hammer'?e.cause===feature||e.reason==='booster-break':e.type==='ice');
    if(qualifies){at=i;break;}board=r.board;
  }
  expect(at).toBeGreaterThanOrEqual(0);await seed(page,saved(deal,at));
  await page.screenshot({path:info.outputPath(feature+'-before.png')});await touch(page,deal,deal.winningPath[at]);
  await page.screenshot({path:info.outputPath(feature+'-effect.png')});
});
test('final candidate field settles once and continues into retained ordinary L102',async({page},info)=>{
  const deal=dealAt(101),at=deal.winningPath.length-3;await seed(page,saved(deal,at));
  for(const action of deal.winningPath.slice(at))await touch(page,deal,action);
  await expect(page.locator('#result')).toBeVisible();const coins=(await read(page)).profile.coins;
  await page.screenshot({path:info.outputPath('chapter-result.png')});await page.locator('#next-level').tap();
  await expect(page.locator('#level-number')).toHaveText('УРОВЕНЬ 102');
  expect((await read(page)).attempt.dealId).not.toContain('-pt246-');expect((await read(page)).profile.coins).toBe(coins);
  await page.screenshot({path:info.outputPath('ordinary-102.png')});
});
