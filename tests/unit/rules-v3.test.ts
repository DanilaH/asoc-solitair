import { describe, expect, it } from 'vitest';
import { campaignDeals, findDeal } from '../../src/content/campaign';
import { dailyForDay, dailyPool } from '../../src/content/daily';
import { beginDeal } from '../../src/domain/campaign';
import { switchMode } from '../../src/domain/sessions';
import { applyBoard, assertBoard, boardKey, dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import { MAX_UNDO_HISTORY } from '../../src/domain/history';
import { knownContinuation } from '../../src/domain/solver';
import { resolveHint } from '../../src/domain/hint';
import { decodeSave, SaveStore } from '../../src/platform/storage';
import type { Board, BoardCommand, Deal, Save } from '../../src/domain/types';

const transfer=(from:number,to:number,kind:'tableau'|'foundation'='tableau'):BoardCommand=>({type:'transfer',from:{kind:'tableau',index:from},to:{kind,index:to}});
const unlock=(s:Save)=>{s.platform={receipts:['earned'],continuedAttempts:[],continueCredits:0,winsSinceInterstitial:0,lastFullscreenAt:0,completedCampaign:campaignDeals.slice(0,26).map(d=>d.id)};return s;};
function step(s:Save,a:BoardCommand,d:Deal) {const r=dispatch(s,a,d);expect(r.accepted,r.reason).toBe(true);return r.next;}
function legacy(s:Save):Save {
  s=structuredClone(s);s.rulesVersion=2;
  for(const a of [s.attempt,...Object.values(s.parked??{})])for(const b of [a.board,...a.undo])delete b.rulesVersion;
  return s;
}

describe('rules v3 destinations and compatibility',()=>{
  const d=campaignDeals[5],bad=transfer(0,1);
  it('rejects the actual flashlight-to-lower-theme move without a turn, charge or Undo',()=>{
    const s=unlock(freshSave(d,'new-rules'));s.attempt.streak.progress=2;
    const r=dispatch(s,bad,d);expect(r.accepted).toBe(false);expect(r.reason).toBe('Сначала перенесите тему в верхний слот');
    expect(r.next.attempt.board).toEqual(s.attempt.board);expect(r.next.profile).toEqual(s.profile);expect(r.next.attempt.undo).toEqual([]);expect(r.next.attempt.streak.progress).toBe(0);
    expect(legalCommands(s.attempt.board,d)).not.toContainEqual(bad);
  });
  it('allows upper collection after moving the theme; Undo retains the attempt rules',()=>{
    let s=unlock(freshSave(d,'upper'));
    s=step(s,transfer(1,1,'foundation'),d);const before=structuredClone(s);
    s=step(s,transfer(0,1,'foundation'),d);expect(s.attempt.board.foundations[1]).toEqual(['lights_3','lights']);
    s=dispatch(s,{type:'undo'},d).next;expect(s.attempt.board).toEqual(before.attempt.board);expect(s.attempt.board.rulesVersion).toBe(3);
    expect(dispatch(s,transfer(0,0,'foundation'),d).accepted).toBe(false);
  });
  it('loads the unchanged old attempt under v2, including its old winning continuation',()=>{
    const original=legacy(unlock(freshSave(d,'old-rules'))),raw=JSON.stringify(original);
    const s=decodeSave(raw,findDeal);expect(s.rulesVersion).toBe(3);expect(s.attempt.board.rulesVersion).toBe(2);
    expect(s.profile).toEqual(original.profile);expect(s.attempt.board.tableau).toEqual(original.attempt.board.tableau);
    expect(knownContinuation(s.attempt.board,d)).toEqual(d.legacyWinningPath);
    expect(dispatch(s,bad,d).accepted).toBe(true);
    expect(boardKey(s.attempt.board)).not.toBe(boardKey(d.initial));
    expect(decodeSave(JSON.stringify(s),findDeal)).toEqual(s);
  });
  it('preserves mixed old daily / new campaign ownership across mode switches, reload and restart',()=>{
    const day=dailyForDay('2026-11-12');let s=decodeSave(JSON.stringify(legacy(unlock(freshSave(day,'old-daily')))),findDeal);
    const old=structuredClone(s.attempt);switchMode(s,'campaign',d,'new-campaign');expect(s.attempt.board.rulesVersion).toBe(3);
    expect(s.parked?.daily).toEqual(old);s=decodeSave(JSON.stringify(s),findDeal);
    switchMode(s,'daily',day,'resume-id');expect(s.attempt).toEqual(old);expect(s.parked?.campaign?.board.rulesVersion).toBe(3);
    s=dispatch(s,{type:'restart',attemptId:'daily-restart'},day).next;
    expect(s.attempt.board.rulesVersion).toBe(3);expect(s.profile.coins).toBe(100);expect(s.platform?.receipts).toEqual(['earned']);
    expect(s.parked?.campaign?.board.rulesVersion).toBe(3);expect(decodeSave(JSON.stringify(s),findDeal)).toEqual(s);
    switchMode(s,'campaign',d,'resume-campaign');beginDeal(s,campaignDeals[6],'next-campaign');expect(s.attempt.board.rulesVersion).toBe(3);
  });
  it('uses a legal current continuation for Hint and keeps rejected lower-theme hints free',()=>{
    const s=unlock(freshSave(d,'hints')),hint=resolveHint(s.attempt.board,d);
    expect(hint.status).toBe('SOLVED');if(hint.status==='SOLVED')expect(hint.action).toEqual(transfer(1,1,'foundation'));
    const r=dispatch(s,{type:'hint',revision:s.revision,action:bad},d);expect(r.accepted).toBe(false);expect(r.next.profile.hints).toBe(3);
  });
  it('rejects an Undo snapshot from different rules instead of changing rules through Undo',()=>{
    const s=step(unlock(freshSave(d,'bad-history')),transfer(1,1,'foundation'),d);s.attempt.undo[0].rulesVersion=2;
    expect(()=>decodeSave(JSON.stringify(s),findDeal)).toThrow('Отмена меняет правила');
  });
  it('keeps every frozen legacy witness and its fast Hint continuation playable',()=>{
    for(const deal of [...campaignDeals,...dailyPool]) {
      let b:Board={...structuredClone(deal.initial),rulesVersion:2};const path=deal.legacyWinningPath!;
      expect(knownContinuation(b,deal),deal.id).toEqual(path);
      for(const a of path){const r=applyBoard(b,a,deal);if(typeof r==='string')throw Error(deal.id+': '+r);b=r.board;assertBoard(b,deal);}
      expect(b.phase,deal.id).toBe('won');
    }
  });
});

function longAttempt(count:number) {
  const d=campaignDeals[0];let s=unlock(freshSave(d,'long-attempt'));const all:Board[]=[];
  for(const a of d.winningPath.slice(0,5)){all.push(structuredClone(s.attempt.board));s=step(s,a,d);}
  for(let i=0;i<count-5;i++){all.push(structuredClone(s.attempt.board));s=step(s,transfer(i%2===0?1:0,i%2===0?0:1),d);expect(s.attempt.undo.length).toBe(Math.min(i+6,MAX_UNDO_HISTORY));}
  return{s,all};
}
describe('bounded Undo and recoverable long historical attempts',()=>{
  it('accepts 1000 ordinary commands, caps at 300, reloads, and can Undo the final move',()=>{
    const {s,all}=longAttempt(1000);expect(s.attempt.board.phase).toBe('playing');expect(s.attempt.board.movesLeft).toBeNull();
    const restored=decodeSave(JSON.stringify(s),findDeal);expect(restored).toEqual(s);expect(restored.attempt.undo).toEqual(all.slice(-300));
    const undone=dispatch(restored,{type:'undo'},campaignDeals[0]);expect(undone.accepted).toBe(true);expect(undone.next.attempt.board).toEqual(all.at(-1));
    expect(undone.next.profile.undos).toBe(s.profile.undos-1);expect(undone.next.profile.coins).toBe(s.profile.coins);expect(undone.next.attempt.streak).toEqual(s.attempt.streak);
  },15000);
  it.each([299,300,301,1000])('loads a valid historical %i-snapshot history without resetting board or resources',count=>{
    const {s,all}=longAttempt(count);s.attempt.undo=all;const old=legacy(s),r=decodeSave(JSON.stringify(old),findDeal);
    expect(r.attempt.undo.length).toBe(Math.min(count,300));expect(r.attempt.board.tableau).toEqual(old.attempt.board.tableau);expect(r.attempt.board.rulesVersion).toBe(2);
    expect(r.profile).toEqual(old.profile);expect(r.platform).toEqual(old.platform);expect(r.attempt.streak).toEqual(old.attempt.streak);
    expect(decodeSave(JSON.stringify(r),findDeal)).toEqual(r);
  },15000);
  it('normalizes an overlong parked history, and rejects corrupted discarded snapshots without overwriting storage',async()=>{
    const {s,all}=longAttempt(301);s.attempt.undo=all;const old=legacy(s),day=dailyForDay('2026-11-12');switchMode(old,'daily',day,'other-mode');
    // Emulate an old envelope; the new daily was created by current code only for this fixture.
    delete old.attempt.board.rulesVersion;
    const restored=decodeSave(JSON.stringify(old),findDeal);expect(restored.parked?.campaign?.undo.length).toBe(300);expect(restored.parked?.campaign?.board.rulesVersion).toBe(2);
    old.parked!.campaign!.undo[0].stock.push('corrupt');const original=JSON.stringify(old);let stored=original;
    const store=new SaveStore({async getItem(){return stored;},async setItem(_k,v){stored=v;},async removeItem(){}},findDeal,()=>freshSave(campaignDeals[0],'fresh'));
    await expect(store.open()).rejects.toThrow();expect(stored).toBe(original);
  },15000);
});

describe('semantic save invariants',()=>{
  it('rejects leaderless upper, mixed upper, partial collected and hidden accessible zones',()=>{
    const d=campaignDeals[0];
    for(const mutate of [
      (b:Board)=>{b.tableau[0].pop();b.foundations[0]=['fruit'];b.faceUp=b.faceUp.filter(id=>id!=='fruit');},
      (b:Board)=>{b.tableau[0].splice(1,1);b.foundations[0]=['birds_1'];b.faceUp.push('birds_1');},
      (b:Board)=>{b.tableau[0].pop();b.tableau[1].pop();b.foundations[0]=['fruit','birds'];},
      (b:Board)=>{b.tableau[0].pop();b.collected=['fruit'];},
    ]) {const s=freshSave(d,'malformed');mutate(s.attempt.board);expect(()=>assertBoard(s.attempt.board,d)).toThrow();expect(()=>decodeSave(JSON.stringify(s),findDeal)).toThrow();}
  });
  it('retains leader-onto-members as a distinct allowed direction and refuses adding onto that lower leader',()=>{
    const d=structuredClone(campaignDeals[0]);d.cards.fruit_3={id:'fruit_3',category:'fruit',text:'test fruit',explanation:'test'};d.initial.stock=['fruit_3'];
    d.initial.tableau=[['fruit'],['fruit_1','fruit_2'],['birds_1','birds_2','birds']];d.initial.faceUp=d.initial.tableau.flat();
    const r=applyBoard(d.initial,transfer(0,1),d);expect(typeof r).not.toBe('string');
    if(typeof r!=='string'){
      expect(r.board.tableau[1]).toEqual(['fruit_1','fruit_2','fruit']);expect(r.board.collected).toEqual([]);
      const draw=applyBoard(r.board,{type:'draw'},d);if(typeof draw==='string')throw Error(draw);
      expect(applyBoard(draw.board,{type:'transfer',from:{kind:'waste',index:0},to:{kind:'tableau',index:1}},d)).toBe('Сначала перенесите тему в верхний слот');
    }
  });
});
