import{describe,it,expect}from'vitest';
import{campaignDeals,legacyCampaignDeals,findDeal}from'../../src/content/campaign';
import{dailyForDay}from'../../src/content/daily';
import{freshSave,dispatch,applyBoard}from'../../src/domain/engine';
import{beginDeal}from'../../src/domain/campaign';import{switchMode}from'../../src/domain/sessions';
import{campaignId,completedLevels}from'../../src/domain/progression';
import{decodeSave,SaveStore}from'../../src/platform/storage';import{ruleIntroduction}from'../../src/app/tutorial';
import type{Save,Deal}from'../../src/domain/types';
const previous=(s:Save,level:number)=>{s.platform={receipts:['kept-receipt'],continuedAttempts:['kept-attempt'],continueCredits:1,winsSinceInterstitial:2,lastFullscreenAt:7,completedCampaign:Array.from({length:level-1},(_,i)=>campaignId(i+1))};return s;};
function play(s:Save,d:Deal,n=d.winningPath.length){for(const a of d.winningPath.slice(0,n)){const r=dispatch(s,a,d);expect(r.accepted,r.reason).toBe(true);s=r.next;}return s;}
describe('revision6 opening and historical ownership',()=>{
 it('selects fifteen new identities while every original definition remains addressable',()=>{
  expect(campaignDeals).toHaveLength(80);expect(new Set(campaignDeals.map(d=>d.id)).size).toBe(80);
  for(let i=0;i<80;i++){expect(findDeal(legacyCampaignDeals[i].id)).toBe(legacyCampaignDeals[i]);if(i<15){expect(campaignDeals[i].id).toBe(`campaign-c6-${String(i+1).padStart(3,'0')}`);expect(campaignDeals[i].campaignLevel).toBe(i+1);}else expect(campaignDeals[i]).toBe(legacyCampaignDeals[i]);}
 });
 it.each(['campaign','daily']as const)('migrates a content5 save with active %s and the other parked without replacing either board',mode=>{
  const old=legacyCampaignDeals[5],day=dailyForDay('2026-11-14');let s=play(previous(freshSave(old,'old-campaign'),6),old,3);
  const daily=play(previous(freshSave(day,'old-daily'),6),day,2).attempt;s.parked={daily};
  if(mode==='daily'){const campaign=s.attempt;s.attempt=daily;s.parked={campaign};}
  s.contentVersion=5;s.profile.coins=17;s.profile.jokers=0;s.profile.hints=0;s.profile.undos=1;s.settings.deckSide='left';
  const original=structuredClone(s),r=decodeSave(JSON.stringify(s),findDeal);expect(r.contentVersion).toBe(6);expect({...r,contentVersion:5}).toEqual(original);
  expect(decodeSave(JSON.stringify(r),findDeal)).toEqual(r);switchMode(r,'campaign',old,'ignored-on-resume');expect(r.attempt.dealId).toBe(old.id);expect(findDeal(r.attempt.dealId)).toBe(old);
  const again=dispatch(r,{type:'restart',attemptId:'old-restart'},old).next;expect(again.attempt.board).toEqual(old.initial);expect(again.profile.jokers).toBe(0);expect(again.platform?.receipts).toEqual(['kept-receipt']);
 });
 it('retains old v2 rules, exact Undo and legal old continuation after the content6 envelope is saved',()=>{
  const d=legacyCampaignDeals[5];let s=previous(freshSave(d,'old-v2'),6);s.contentVersion=5;s.rulesVersion=2;s.attempt.board.rulesVersion=2;
  for(const a of d.legacyWinningPath!.slice(0,3)){const before=structuredClone(s.attempt.board),r=applyBoard(before,a,d);if(typeof r==='string')throw Error(r);s.attempt.undo.push(before);s.attempt.board=r.board;}
  const r=decodeSave(JSON.stringify(s),findDeal);expect(r.attempt).toEqual(s.attempt);expect(r.contentVersion).toBe(6);expect(r.attempt.board.rulesVersion).toBe(2);
  const undo=dispatch(r,{type:'undo'},d);expect(undo.accepted).toBe(true);expect(undo.next.attempt.board).toEqual(s.attempt.undo.at(-1));expect(decodeSave(JSON.stringify(undo.next),findDeal)).toEqual(undo.next);
 });
 it('does not award the same campaign milestone/cycle twice when a revised level replaces an already cleared original',()=>{
  let s=play(freshSave(legacyCampaignDeals[0],'old-win'),legacyCampaignDeals[0]);const meta=structuredClone(s.meta),receipts=[...s.platform!.completedCampaign];
  beginDeal(s,campaignDeals[0],'revised-replay');s=play(s,campaignDeals[0]);expect(s.platform!.completedCampaign).toEqual(receipts);expect(s.meta).toEqual(meta);expect(completedLevels(s)).toBe(1);expect(s.profile.wins).toBe(2);
 });
 it.each([[7,'joker'],[8,'ordered'],[11,'keys']]as const)('introduces the existing rule on revised index%i without spending or moving', (i,kind)=>{
  const d=campaignDeals[i],s=previous(freshSave(d,'intro-v6'),i+1),before=structuredClone(s);expect(ruleIntroduction(s,d)).toBe(kind);expect(s).toEqual(before);
  s.campaign={version:1,tutorials:[`intro:${kind}`]};expect(ruleIntroduction(s,d)).toBeUndefined();
 });
 it('keeps replay fixed for all fifteen levels and never replenishes spent Joker inventory',()=>{
  for(const d of campaignDeals.slice(0,15)){let s=previous(freshSave(d,'before-replay'),d.campaignLevel!);s.profile.jokers=0;s=play(s,d,1);s=dispatch(s,{type:'restart',attemptId:'fixed-replay'},d).next;expect(s.attempt.dealId).toBe(d.id);expect(s.attempt.board,d.id).toEqual(d.initial);expect(s.profile.jokers).toBe(0);}
 });
 it('refuses a revision6 identity in an old envelope and future content without overwriting the raw save',async()=>{
  for(const contentVersion of [5,7]){const s=freshSave(campaignDeals[2],'invalid-envelope');s.contentVersion=contentVersion;const raw=JSON.stringify(s);let stored=raw;
   const store=new SaveStore({async getItem(){return stored;},async setItem(_k,v){stored=v;},async removeItem(){throw Error('no reset');}},findDeal,()=>freshSave(campaignDeals[0],'fallback'));
   await expect(store.open()).rejects.toThrow();expect(stored).toBe(raw);
  }
 });
 it('offers each missing rule in a combined level even to an upgraded player who has already cleared its number',()=>{
  const d=campaignDeals[14],s=previous(freshSave(d,'combined-intro'),30);expect(ruleIntroduction(s,d)).toBe('ordered');s.campaign={version:1,tutorials:['intro:ordered']};expect(ruleIntroduction(s,d)).toBe('keys');s.campaign.tutorials.push('intro:keys');expect(ruleIntroduction(s,d)).toBeUndefined();
 });

});
