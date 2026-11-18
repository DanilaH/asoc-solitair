import {describe,it,expect} from 'vitest';
import {campaignDeals,content6CampaignDeals,legacyCampaignDeals,findDeal} from '../../src/content/campaign';
import {dailyForDay,dailyPool} from '../../src/content/daily';
import {freshSave,dispatch,applyBoard} from '../../src/domain/engine';
import {CONTENT_VERSION,RULES_VERSION,BALANCE_VERSION,type Save,type Deal} from '../../src/domain/types';
import {decodeSave,SaveStore} from '../../src/platform/storage';
import {campaignId} from '../../src/domain/progression';
import {beginDeal} from '../../src/domain/campaign';
import {switchMode} from '../../src/domain/sessions';
import {ruleIntroduction,lesson} from '../../src/app/tutorial';
import {resolveHint} from '../../src/domain/hint';
import plan from '../../docs/content/CONTENT_V7_LEVEL_PLAN.json' with {type:'json'};
const unlock=(s:Save,n=80)=>{s.platform={receipts:['before-upgrade'],continuedAttempts:['continued-old'],continueCredits:1,lastFullscreenAt:9,winsSinceInterstitial:2,completedCampaign:Array.from({length:n},(_,i)=>campaignId(i+1))};return s;};
function play(s:Save,d:Deal,n=d.winningPath.length){for(const cmd of d.winningPath.slice(0,n)){const r=dispatch(s,cmd,d);expect(r.accepted,r.reason).toBe(true);s=r.next;}return s;}
describe('Content7 frozen catalog and ownership',()=>{
 it('selects exactly eighty separate identities with the exact approved pace and feature schedule',()=>{
  expect([RULES_VERSION,CONTENT_VERSION,BALANCE_VERSION]).toEqual([3,7,3]);expect(campaignDeals).toHaveLength(80);
  for(const [i,d]of campaignDeals.entries()){
   const p=plan.levels[i],cats=Object.values(d.cards).filter(c=>c.leader).length,n=Object.keys(d.cards).length;
   expect(d.id).toBe(`campaign-c7-${String(i+1).padStart(3,'0')}`);expect(d.campaignLevel).toBe(i+1);expect(d.version).toBe(1);expect(findDeal(d.id)).toBe(d);
   expect(cats).toBeGreaterThanOrEqual(p.categoryBand[0]);expect(cats).toBeLessThanOrEqual(p.categoryBand[1]);expect(n).toBeGreaterThanOrEqual(p.cardBand[0]);expect(n).toBeLessThanOrEqual(p.cardBand[1]);
   expect(d.initial.tableau.length).toBeLessThanOrEqual(4);expect(d.initial.foundations.length).toBeLessThanOrEqual(3);
   expect(Boolean(d.lock)).toBe(p.mechanic.startsWith('keys:'));expect(d.tags?.includes('ordered')).toBe(p.mechanic.startsWith('ordered:'));
   if(i<2)expect(d.initial.movesLeft).toBeNull();else expect(d.initial.movesLeft!-d.winningPath.length).toBeGreaterThanOrEqual(4);
   if(p.paceRole==='REST'){expect(n).toBeLessThanOrEqual(Object.keys(campaignDeals[i-1].cards).length*.75);expect(d.winningPath.length).toBeLessThanOrEqual(campaignDeals[i-1].winningPath.length*.75);}
  }
  for(const d of [...legacyCampaignDeals,...content6CampaignDeals])expect(findDeal(d.id)).toBe(d);
  expect(dailyPool).toHaveLength(28);
 });
 it.each(campaignDeals)('keeps $id helper-free and returns a legal hint from every saved witness prefix',d=>{
  {let s=unlock(freshSave(d,'c7-witness')),b=s.attempt.board;
   for(const cmd of d.winningPath){const before=JSON.stringify(b),hint=resolveHint(b,d,0);expect(hint.status,d.id).toBe('SOLVED');expect(JSON.stringify(b)).toBe(before);if(hint.status==='SOLVED')expect(typeof applyBoard(b,hint.action,d)).not.toBe('string');s=play(s,{...d,winningPath:[cmd]});b=s.attempt.board;}
   expect(b.phase,d.id).toBe('won');expect(s.profile.jokers).toBe(1);expect(s.profile.undos).toBe(5);expect(s.attempt.jokerUsed).toBeUndefined();
  }
 });
 it.each(['campaign','daily'] as const)('preserves a C6 Joker attempt, exact Undo, spent resources, receipts and parked %s state',mode=>{
  const d=content6CampaignDeals[7],day=dailyForDay('2026-11-18');let s=unlock(freshSave(d,'old-c6-joker'),12);s.contentVersion=6;
  const placement=d.tutorialPath![0];s=dispatch(s,placement,d).next;s=play(s,d,1);const daily=play(unlock(freshSave(day,'old-c6-daily')),day,2).attempt;s.parked={daily};
  if(mode==='campaign'){const campaign=s.attempt;s.attempt=daily;s.parked={campaign};}
  s.profile.coins=37;s.profile.hints=0;s.profile.undos=2;s.settings.deckSide='left';s.settings.deckPosition='bottom';s.attempt.telemetry={started:true,finished:false,activeMs:1234};
  const old=structuredClone(s),r=decodeSave(JSON.stringify(s),findDeal);expect({...r,contentVersion:6}).toEqual(old);expect(decodeSave(JSON.stringify(r),findDeal)).toEqual(r);
  switchMode(r,'campaign',campaignDeals[7],'ignored-new-definition');expect(r.attempt.dealId).toBe(d.id);expect(r.attempt.jokerUsed).toBe(true);
  const restart=dispatch(r,{type:'restart',attemptId:'old-c6-restart'},d).next;expect(restart.attempt.board).toEqual(d.initial);expect(restart.profile.jokers).toBe(0);
 });
 it('retains the C6 keys/ordered board, Undo and hint ownership when it is parked behind daily',()=>{
  const d=content6CampaignDeals[14];let s=play(unlock(freshSave(d,'old-combined')),d,6);s.contentVersion=6;
  const attempt=structuredClone(s.attempt);s.parked={campaign:s.attempt};s.attempt=freshSave(dailyForDay('2026-11-17'),'daily-active').attempt;
  const r=decodeSave(JSON.stringify(s),findDeal);expect(r.parked?.campaign).toEqual(attempt);switchMode(r,'campaign',campaignDeals[14],'no-replace');expect(r.attempt).toEqual(attempt);
  expect(resolveHint(r.attempt.board,d,0).status).toBe('SOLVED');const undo=dispatch(r,{type:'undo'},d);expect(undo.accepted).toBe(true);expect(undo.next.attempt.board).toEqual(attempt.undo.at(-1));
 });
 it('keeps an old rules2 attempt pinned through reload and Undo; restart keeps the historical definition',()=>{
  const d=legacyCampaignDeals[5];let s=unlock(freshSave(d,'v2-in-c6'));s.contentVersion=6;s.attempt.board.rulesVersion=2;
  s=play(s,{...d,winningPath:d.legacyWinningPath!},3);const original=structuredClone(s.attempt),r=decodeSave(JSON.stringify(s),findDeal);expect(r.attempt).toEqual(original);
  const undo=dispatch(r,{type:'undo'},d);expect(undo.accepted).toBe(true);expect(undo.next.attempt.board.rulesVersion).toBe(2);
  const restarted=dispatch(undo.next,{type:'restart',attemptId:'v2-still-old'},d).next;expect(restarted.attempt.dealId).toBe(d.id);expect(restarted.attempt.board).toEqual(d.initial);
 });
 it('selects C7 on an explicit level change and keeps first-clear receipts canonical across revisions',()=>{
  const old=content6CampaignDeals[9];let s=unlock(freshSave(old,'old-complete'),9);s=play(s,old);const meta=structuredClone(s.meta),completed=structuredClone(s.platform!.completedCampaign),rewards=structuredClone(s.profile.rewards);
  beginDeal(s,campaignDeals[9],'c7-replay');s=play(s,campaignDeals[9]);expect(s.attempt.dealId).toBe('campaign-c7-010');expect(s.platform!.completedCampaign).toEqual(completed);expect(s.meta).toEqual(meta);expect(s.profile.rewards.filter(x=>x.startsWith('milestone:'))).toEqual(rewards.filter(x=>x.startsWith('milestone:')));
  beginDeal(s,campaignDeals[10],'c7-next');expect(s.attempt.board).toEqual(campaignDeals[10].initial);expect(s.platform!.receipts).toContain('before-upgrade');
 });
 it('refuses C7 identities in an older envelope, including parked identities, without overwriting bytes',async()=>{
  for(const parked of [false,true]){let s=freshSave(campaignDeals[2],'premature-c7');s.contentVersion=6;if(parked){s.parked={campaign:s.attempt};s.attempt=freshSave(dailyForDay('2026-11-18'),'old-daily-owner').attempt;}
   const original=JSON.stringify(s);let raw=original;const store=new SaveStore({getItem:async()=>raw,setItem:async(_k,v)=>{raw=v;},removeItem:async()=>{throw Error('no reset');}},findDeal,()=>freshSave(campaignDeals[0],'fresh'));
   await expect(store.open()).rejects.toThrow();expect(raw).toBe(original);
  }
 });
 it('introduces actual ordered/keys encounters once even for veterans, without teaching Joker automatically at8',()=>{
  for(const [i,kind]of [[29,'ordered'],[48,'keys']] as const){const d=campaignDeals[i],s=unlock(freshSave(d,'first-rule')),before=structuredClone(s);expect(ruleIntroduction(s,d)).toBe(kind);expect(s).toEqual(before);s.campaign={version:1,tutorials:[`intro:${kind}`]};expect(ruleIntroduction(s,d)).toBeUndefined();}
  const d=campaignDeals[7],s=unlock(freshSave(d,'joker-optional'));expect(ruleIntroduction(s,d)).toBeUndefined();expect(lesson(s,d)).toBeUndefined();expect(d.tutorialPath).toBeUndefined();
 });
});
