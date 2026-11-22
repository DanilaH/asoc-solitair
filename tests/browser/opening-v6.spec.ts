import{test,expect}from'@playwright/test';import{content6CampaignDeals as campaignDeals,legacyCampaignDeals,campaignDeals as currentCampaignDeals}from'../../src/content/campaign';
import{freshSave,dispatch}from'../../src/domain/engine';import{campaignId}from'../../src/domain/progression';import{dismissTeaching}from'../../tools/qa/navigation';
import{seed,move,read}from'./wallet-fixture';
for(let i=0;i<15;i++)test(`content6 level${i+1} wins through visible controls, reloads and preserves helper stock`,async({page})=>{
 const d=campaignDeals[i];let s=freshSave(d,'opening-ui-'+i);s.settings.reducedMotion=true;s.settings.sfx=false;
 s.platform={receipts:['retained'],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:Array.from({length:i},(_,j)=>campaignId(j+1))};
 s.campaign={version:1,tutorials:['learn:category','learn:match','learn:stock','hint-demo','undo-used',...(i>=8?['intro:joker']:[]),...(i>=9?['intro:ordered']:[]),...(i>=12?['intro:keys']:[])]};
 if(i%2){s.settings.deckSide='left';s.settings.deckPosition='bottom';}
 await seed(page,s);await dismissTeaching(page);const profile=structuredClone(s.profile);
 for(let j=0;j<d.winningPath.length;j++){
  await move(page,d,d.winningPath[j]);const r=dispatch(s,d.winningPath[j],d);expect(r.accepted).toBe(true);s=r.next;
  if(j===Math.floor(d.winningPath.length/2)&&s.attempt.board.phase==='playing'){await page.reload();await page.locator('#app[data-ready=true]').waitFor();await page.locator('#home-play').tap();await dismissTeaching(page);await expect.poll(async()=>(await read(page)).attempt.board).toEqual(s.attempt.board);}
 }
 await page.locator('#result[open]').waitFor();const actual=await read(page);expect(actual.attempt.board).toEqual(s.attempt.board);expect(actual.profile).toEqual(s.profile);expect(actual.profile.jokers).toBe(profile.jokers);expect(actual.profile.undos).toBe(profile.undos);expect(actual.platform?.receipts).toEqual(['retained']);expect(actual.platform?.completedCampaign).toContain(campaignId(i+1));
});
test('a revised Joker is optional, supports a real packet, survives reload and keeps its one charge spent',async({page})=>{
 const d=campaignDeals[7];let s=freshSave(d,'opening-joker');s.settings.reducedMotion=true;s.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:Array.from({length:7},(_,i)=>campaignId(i+1))};s.campaign={version:1,tutorials:['intro:joker','learn:category','learn:match','learn:stock']};await seed(page,s);
 const place=d.tutorialPath![0];if(place.type!=='place-joker')throw Error('Expected support');await page.locator('#joker').tap();
 const {boardFrame,layout}=await import('../../src/game/layout');const box=(await page.locator('#game-root').boundingBox())!,frame=boardFrame(box.width,box.height,s.settings.deckPosition,d),g=layout(s.attempt.board,d,frame);const target=g.targets.find(t=>t.location.kind==='tableau'&&t.location.index===place.column)!;await page.touchscreen.tap(box.x+frame.offsetX+target.x*frame.unit,box.y+target.y*frame.unit);await expect.poll(async()=>(await read(page)).profile.jokers).toBe(0);s=dispatch(s,place,d).next;
 for(const a of d.tutorialPath!.slice(1)){if(!['transfer','draw','recycle'].includes(a.type))throw Error('Expected board action');await move(page,d,a as import('../../src/domain/types').BoardCommand);s=dispatch(s,a,d).next;}
 await page.locator('#result[open]').waitFor();expect((await read(page)).attempt.board).toEqual(s.attempt.board);expect((await read(page)).profile.jokers).toBe(0);
 await page.reload();await page.locator('#app[data-ready=true]').waitFor();expect((await read(page)).profile.jokers).toBe(0);
});
test('content5 resume stays on its old level and selecting the revised same level preserves wallet and canonical progress',async({page})=>{
 const d=legacyCampaignDeals[5];let s=freshSave(d,'historical-owner');s.contentVersion=5;s.settings.reducedMotion=true;s.profile.coins=281;s.platform={receipts:['earned-before'],continuedAttempts:[],continueCredits:1,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:Array.from({length:10},(_,i)=>campaignId(i+1))};s.campaign={version:1,tutorials:['learn:category','learn:match','learn:stock','hint-demo','undo-used','intro:joker']};s=dispatch(s,d.winningPath[0],d).next;await seed(page,s);expect((await read(page)).attempt.dealId).toBe(d.id);expect((await read(page)).attempt.board).toEqual(s.attempt.board);
 await page.locator('#menu').tap();await page.locator('#levels-open').tap();await page.locator('#level-picker-open').tap();await page.locator('#level-6').tap();await page.locator('#switch-confirm').tap();await expect.poll(async()=>(await read(page)).attempt.dealId).toBe(currentCampaignDeals[5].id);const r=await read(page);expect(r.contentVersion).toBe(7);expect(r.profile).toEqual(s.profile);expect(r.platform?.completedCampaign).toEqual(s.platform?.completedCampaign);expect(r.platform?.receipts).toEqual(['earned-before']);
});

test('an upgraded player jumping to the combined finale receives both unfamiliar rules without a move or charge',async({page})=>{
 const d=campaignDeals[14],s=freshSave(d,'jump-finale');s.settings.reducedMotion=true;s.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:Array.from({length:14},(_,i)=>campaignId(i+1))};s.campaign={version:1,tutorials:['learn:category','learn:match','learn:stock']};await seed(page,s);
 await expect(page.locator('#learn-title')).toHaveText('По порядку');await page.locator('#learn-rule .primary').tap();await expect(page.locator('#learn-title')).toHaveText('Три ключа');await page.locator('#learn-rule .primary').tap();await expect(page.locator('#learn-rule')).toBeHidden();const r=await read(page);expect(r.profile).toEqual(s.profile);expect(r.attempt.board).toEqual(s.attempt.board);expect(r.campaign?.tutorials).toEqual(expect.arrayContaining(['intro:ordered','intro:keys']));
 await page.reload();await page.locator('#app[data-ready=true]').waitFor();await page.locator('#home-play').tap();await expect(page.locator('#learn-rule')).toBeHidden();
});
