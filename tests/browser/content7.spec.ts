import {test,expect} from '@playwright/test';
import {campaignDeals,content6CampaignDeals} from '../../src/content/campaign';
import {freshSave,dispatch} from '../../src/domain/engine';
import {campaignId} from '../../src/domain/progression';
import {seed,read} from './wallet-fixture';
const profile=(i:number)=>{const s=freshSave(campaignDeals[i],'c7-browser');s.settings.reducedMotion=true;s.platform={receipts:['kept'],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:Array.from({length:80},(_,n)=>campaignId(n+1))};s.campaign={version:1,tutorials:['learn:category','learn:match','learn:stock','hint-demo','undo-used']};return s;};
for(const [index,title,marker]of [[29,'По порядку','ordered'],[48,'Три ключа','keys']]as const)test(`Content7 ${marker} starts on the actual encounter for veterans without spending`,async({page})=>{
 const s=profile(index);await seed(page,s);await expect(page.locator('#learn-title')).toHaveText(title);const before=await read(page);await page.locator('#learn-rule .primary').tap();await expect(page.locator('#learn-rule')).toBeHidden();const r=await read(page);expect(r.attempt).toEqual(before.attempt);expect(r.profile).toEqual(before.profile);expect(r.campaign!.tutorials).toContain('intro:'+marker);
 await page.reload();await page.locator('#app[data-ready=true]').waitFor();await page.locator('#home-play').tap();await expect(page.locator('#learn-rule')).toBeHidden();
});
test('Content7 Joker8 teaches on demand, remains optional and never spends or arms itself',async({page})=>{
 const s=profile(7);await seed(page,s);await expect(page.locator('#learn-rule')).toBeHidden();await page.locator('#joker').tap();await expect(page.locator('#learn-title')).toHaveText('Джокер');expect((await read(page)).attempt).toEqual(s.attempt);expect((await read(page)).profile.jokers).toBe(1);await expect(page.locator('#joker')).toHaveAttribute('aria-pressed','false');await page.locator('#learn-rule .primary').tap();await page.locator('#joker').tap();await expect(page.locator('#joker')).toHaveAttribute('aria-pressed','true');expect((await read(page)).profile.jokers).toBe(1);
});
test('Content6 resume and cancellation keep its exact board; confirmed selection opens Content7',async({page})=>{
 const old=content6CampaignDeals[14];let s=profile(14);s.attempt=freshSave(old,'c6-continued').attempt;s.contentVersion=6;s=dispatch(s,old.winningPath[0],old).next;s.campaign!.tutorials.push('intro:ordered','intro:keys');await seed(page,s);
 expect((await read(page)).attempt).toEqual(s.attempt);expect((await read(page)).contentVersion).toBe(7);await expect(page.locator('#app')).toHaveAttribute('data-presented-deal',old.id);
 await page.locator('#menu').tap();await page.locator('#levels-open').tap();await page.locator('#level-picker-open').tap();await page.locator('#level-15').tap();await expect(page.locator('#switch-level')).toBeVisible();await page.locator('#switch-level [data-close]').tap();expect((await read(page)).attempt).toEqual(s.attempt);
 await page.locator('#level-picker-open').tap();await page.locator('#level-15').tap();await page.locator('#switch-confirm').tap();await expect(page.locator('#app')).toHaveAttribute('data-presented-deal',campaignDeals[14].id);const r=await read(page);expect(r.attempt.board).toEqual(campaignDeals[14].initial);expect(r.profile).toEqual(s.profile);expect(r.platform!.receipts).toEqual(['kept']);
});
