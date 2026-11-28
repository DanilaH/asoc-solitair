/**
 * Issue #238, pilot 2. Research only; not imported by the app or authoring bank.
 * The bots never read a winningPath except through the player's verified Hint.
 */
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { E4_M1, M1 } from '../../src/config/economy';
import { releaseProfile } from '../../src/config/profile';
import { campaignDeals, selectCampaignDeal } from '../../src/content/campaign';
import { cardsFor, type TopicId } from '../../src/content/topics';
import { applyBoard, assertBoard, dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import { Kind, sourceCard } from '../../src/domain/hitapps-rules';
import { resolveHintRoute } from '../../src/domain/hint';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { advance } from './gameplay-oracle';
import { dealAzur } from '../content/azur-dealer';
import { campaignId, helperUnlocked } from '../../src/domain/progression';
import { clearUndo } from '../../src/domain/history';
import { buyContinue, platformState, purchaseHelper } from '../../src/domain/services';
import { findContinue } from '../../src/domain/continuation';
import { restoreCampaignStock, restoreQuote } from '../../src/domain/campaign-recovery';
import type { Board, BoardCommand, Deal, Save } from '../../src/domain/types';

assert(E4_M1 && releaseProfile?.id === 'c8-release-v1', 'Run on ordinary M1, not archive');
assert.equal(campaignDeals.length, 200);
const started = performance.now();
const OUT = '.recording/study238';
mkdirSync(OUT, { recursive: true });

type Policy = 'foundation' | 'reveal';
type Spec = { family: 'current' | 'hitapps-donor' | 'azur-shape'; key: string; margin: string; deal: Deal; displayTier?: number };
const metrics = (b: Board) => ({
  collected: b.collected.length,
  home: b.foundations.flat().length,
  hidden: b.tableau.flat().filter(id => !b.faceUp.includes(id)).length,
  columns: b.tableau.filter(c => c.length).length,
});
function signature(b: Board) {
  // Only visible card IDs, pile sizes, and observed special changes. No hidden order or stored solution.
  return JSON.stringify([b.tableau.map(c => c.map(id => b.faceUp.includes(id) ? id : '?')),
    b.foundations, b.stock.length, b.waste, [...b.collected].sort(), b.recyclesLeft,
    b.joker, b.keys, b.hitapps?.spent, Object.entries(b.hitapps?.cards ?? {})
      .filter(([id]) => b.faceUp.includes(id)).map(([id,c])=>[id,c.ice,c.bound,c.lock?.collected,c.gold?.health])]);
}
function replay(b: Board, path: readonly BoardCommand[], d: Deal) {
  for (const a of path) {
    const next = advance(b, a, d);
    if (!next) return undefined;
    b = next;
  }
  return b;
}
function certify(d: Deal) {
  assertBoard(d.initial,d);
  const b=replay(d.initial,d.winningPath,d);
  assert.equal(b?.phase,'won',d.id);
  return (d.initial.movesLeft ?? 0) - (b?.movesLeft ?? 0);
}
function fixture(d: Deal, id: string, wallet = 900) {
  const s=freshSave(d,id), level=d.campaignLevel!;
  platformState(s).completedCampaign=Array.from({length:level-1},(_,i)=>campaignId(i+1));
  s.profile.coins=wallet; s.profile.hints=0; s.profile.undos=0; s.profile.jokers=0;
  // Avoid backfilling previously earned milestone rewards into the controlled fixture.
  s.profile.rewards=Array.from({length:Math.floor((level-1)/10)},(_,i)=>'milestone:'+10*(i+1));
  return s;
}
const all=campaignDeals.map(base=>{
  const s=fixture(base,'select-'+base.campaignLevel);
  s.difficultyPenalty=-5;
  return selectCampaignDeal(s,base);
});
const groupCount=(d:Deal)=>Object.values(d.cards).filter(c=>c.leader).length;
const physicalCount=(d:Deal)=>d.initial.stock.length+d.initial.tableau.flat().length;
const specs: Spec[]=[];
for(const level of [16,23,30,32,39,46,53,60,67,74,80,81,95,110,125,140,155,170,185,200]){
  const d=all[level-1]; if(d.initial.movesLeft===null) continue;
  specs.push({family:'current',key:'L'+level,margin:'published',deal:d});
}
// Same original fields as donor experiment; target group/card counts are source observations,
// not an assertion that the old own layout equals an authenticated Hitapps layout.
const donorTargets=[[6,36],[10,65],[12,81],[15,99]];
for(const [groups,cards] of donorTargets){
  const pool=all.slice(15,80).filter(d=>d.initial.movesLeft!==null && groupCount(d)===groups)
    .sort((a,b)=>Math.abs(physicalCount(a)-cards)-Math.abs(physicalCount(b)-cards)||a.campaignLevel!-b.campaignLevel!);
  for(const d of pool.slice(0,2)){
    const cost=certify(d);
    for(const percent of [15,25]){
      const budget=cost+Math.max(percent===15?12:18,Math.ceil(cost*percent/100));
      const variant={...d,id:d.id+'-study'+percent,initial:{...structuredClone(d.initial),movesLeft:budget}};
      certify(variant);
      specs.push({family:'hitapps-donor',key:'G'+groups+'-L'+d.campaignLevel,margin:String(percent),deal:variant});
    }
  }
  console.log('STUDY238_DONOR '+JSON.stringify({groups,targetCards:cards,available:pool.length,chosen:pool.slice(0,2).map(d=>({id:d.id,cards:physicalCount(d)}))}));
}
const topics:TopicId[]=['fruit','vegetables','birds','tools','flowers','trees','insects','fish'];
const shapes=[[3,3,3,1],[3,4,3,2],[4,4,4,3],[5,5,5,4]];
const authored: unknown[]=[];
for(const seed of [23801,23802]){
  const cards=cardsFor(topics.map(id=>({id,count:5})));
  for(const [foundations,columns,depth,tier] of shapes){
    let x=seed;
    const layout=dealAzur(Object.keys(cards),columns,depth,(min,max)=>{
      x=(Math.imul(x,1664525)+1013904223)>>>0;
      return min+Math.floor(x/4294967296*(max-min));
    });
    const key='A'+tier+'-'+seed;
    // Own Russian words, source-shaped AZUR dealer and dimensions; product Rules4.
    // Identical population, seed and tierBase across all shapes to isolate layout.
    const draft:Deal={
      id:'study238-'+key,version:1,title:'Исследовательская раздача',campaignLevel:81,
      difficultyTier:'normal',editorialStatus:'research-only',cards,winningPath:[],
      initial:{rulesVersion:4,tableau:layout.tableau,faceUp:layout.faceUp,
        foundations:Array.from({length:foundations},()=>[]),stock:layout.deckInput.slice().reverse(),
        waste:[],collected:[],movesLeft:300,phase:'playing',
        hitapps:{move:0,cards:Object.fromEntries(Object.values(cards).map(c=>[c.id,sourceCard(c.leader?Kind.category:Kind.word)])),spent:[],generatedGold:0}},
      hitapps:{policy:'hitapps-rules4-v1',assemblies:[]},
    };
    assertBoard(draft.initial,draft);
    const search=findReferenceRoute(draft,draft.initial,6000,true,performance.now()+6000,'verified-specials');
    if(search.status!=='FOUND'){
      authored.push({key,seed,foundations,columns,depth,tier,status:search.status,visited:search.visited});
      continue; // preserve unknown denominator; do not replace a failed seed
    }
    draft.winningPath=search.path;
    const cost=certify(draft);
    authored.push({key,seed,foundations,columns,depth,tier,status:'CERTIFIED',cost,visited:search.visited,
      cards:physicalCount(draft),stock:draft.initial.stock.length});
    for(const percent of [15,25]){
      const d={...draft,id:draft.id+'-study'+percent,initial:{...structuredClone(draft.initial),
        movesLeft:cost+Math.max(percent===15?12:18,Math.ceil(cost*percent/100))}};
      certify(d); specs.push({family:'azur-shape',key,margin:String(percent),deal:d,displayTier:tier});
    }
  }
}
console.log('STUDY238_AUTHOR '+JSON.stringify(authored));
writeFileSync(OUT+'/authoring.json',JSON.stringify(authored,null,2));

function choose(b:Board,d:Deal,policy:Policy,visits:Map<string,number>){
  const before=metrics(b);
  const options=legalCommands(b,d).flatMap(a=>{
    const r=applyBoard(b,a,d);
    if(typeof r==='string') return [];
    const after=metrics(r.board);
    const visit=visits.get(signature(r.board))??0;
    const gain=after.collected-before.collected;
    const home=after.home+after.collected-before.home-before.collected;
    const reveal=before.hidden-after.hidden;
    const column=before.columns-after.columns;
    const merged=a.type==='transfer'&&a.to.kind==='tableau'&&b.tableau[a.to.index].length>0?1:0;
    const value=r.board.phase==='won'?1e9:
      gain*100+home*(policy==='foundation'?12:5)+reveal*(policy==='reveal'?20:8)+column*2+merged*1
      +(a.type==='draw'?0:a.type==='recycle'?-1:1)-visit*1000;
    return [{a,value}];
  });
  options.sort((a,b)=>b.value-a.value||JSON.stringify(a.a).localeCompare(JSON.stringify(b.a)));
  return options[0]?.a;
}
type Episode={save:Save; actions:number; requested:number; solved:number; used:number; different:number;
  hintSpent:number; hintDenied:number; unknown:number; hintMs:number[]; stockSpent:number; stop:string;
  firstHintAt:number|null; finalCoins:number; victoryBase:number; movesBonus:number; spare:number; firstCollect:number|null; status:Board['phase']};
function run(spec:Spec,policy:Policy,help:boolean):Episode{
  const d=spec.deal;let save=fixture(d,'study-'+spec.key+'-'+policy+'-'+Number(help));
  const visits=new Map<string,number>();
  let actions=0,stall=0,requested=0,solved=0,used=0,different=0,hintSpent=0,hintDenied=0,unknown=0,stockSpent=0;
  let firstHintAt:number|null=null,firstCollect:number|null=null, lastHint=-100;
  const hintMs:number[]=[];let stop='bound';
  while(save.attempt.board.phase==='playing'&&actions<400){
    const b=save.attempt.board,key=signature(b); visits.set(key,(visits.get(key)??0)+1);
    let action=choose(b,d,policy,visits);
    const canAsk=help&&requested<2&&actions-lastHint>=10&&helperUnlocked(save,'hint',d)&&
      (stall>=8 || ((b.movesLeft??999)<=10 && b.collected.length<physicalCount(d)));
    if(canAsk){
      requested++;lastHint=actions;firstHintAt??=actions;
      const t=performance.now(), answer=resolveHintRoute(b,d);hintMs.push(Math.round(performance.now()-t));
      if(answer.status==='SOLVED'&&answer.path.length){
        const oracle=replay(b,answer.path,d);assert.equal(oracle?.phase,'won','Hint oracle: '+d.id);
        solved++;
        const oldCoins=save.profile.coins;
        if(save.profile.hints>0||purchaseHelper(save,'hint')){
          hintSpent+=oldCoins-save.profile.coins;
          const h=dispatch(save,{type:'hint',revision:save.revision,action:answer.path[0]},d);
          assert(h.accepted,h.reason ?? 'Hint rejected');
          assert.equal(h.next.profile.hints,save.profile.hints-1);
          save=h.next;used++;
          if(JSON.stringify(action)!==JSON.stringify(answer.path[0])) different++;
          action=answer.path[0]; // one step, never follow the stored tail for free
        }else hintDenied++;
      }else unknown++;
    }
    const before=metrics(b);
    if(!action){
      const cost=restoreQuote(save.attempt,d);
      if(cost===undefined){stop='no-legal';break;}
      const oracle=advance({...b,recyclesLeft:1},{type:'recycle'},d);
      if(!restoreCampaignStock(save,d,{attemptId:save.attempt.id,revision:save.revision,cost})){stop='restore-unaffordable';break;}
      assert(isDeepStrictEqual(save.attempt.board,oracle),'restore oracle');
      stockSpent+=cost;
    }else{
      const oracle=advance(b,action,d), result=dispatch(save,action,d,'2026-11-28');
      assert(result.accepted,result.reason ?? 'Legal command rejected');
      assert(isDeepStrictEqual(result.next.attempt.board,oracle),'move oracle '+d.id);
      save=result.next;
    }
    actions++;assertBoard(save.attempt.board,d);
    clearUndo(save.attempt);
    const after=metrics(save.attempt.board);
    if(after.collected>0&&firstCollect===null)firstCollect=actions;
    stall=after.collected>before.collected||after.home+after.collected>before.home+before.collected||after.hidden<before.hidden?0:stall+1;
  }
  if(save.attempt.board.phase!=='playing')stop=save.attempt.board.phase;
  return {save,actions,requested,solved,used,different,hintSpent,hintDenied,unknown,hintMs,stockSpent,stop,firstHintAt,
    finalCoins:save.profile.coins,victoryBase:save.attempt.victory?.tierBase??0,
    movesBonus:save.attempt.victory?.movesBonus??0,spare:save.attempt.board.movesLeft??0,
    firstCollect,status:save.attempt.board.phase};
}
type RecoveryRow={key:string;family:string;policy:Policy;remaining:number;actual:string;actualBuy:boolean;
  probes:{moves:number;status:string;proofCost:number|null}[]};
const recovery:RecoveryRow[]=[];
const rows:Record<string,unknown>[]=[];
const exhaustedCounts:Record<string,number>={};
for(const spec of specs){
  const {deal:d}=spec;
  for(const policy of ['foundation','reveal'] as const){
    const control=run(spec,policy,false), assisted=run(spec,policy,true);
    for(const [help,e] of [[false,control],[true,assisted]] as const){
      const {save,...out}=e;
      rows.push({family:spec.family,key:spec.key,margin:spec.margin,displayTier:spec.displayTier,
        deal:d.id,policy,help,cards:physicalCount(d),groups:groupCount(d),
        stock:d.initial.stock.length,tableau:d.initial.tableau.map(c=>c.length),
        slots:d.initial.foundations.length,budget:d.initial.movesLeft,witness:certify(d),
        ...out});
    }
    if(control.status==='exhausted'&&(exhaustedCounts[spec.family]??0)<4){
      exhaustedCounts[spec.family]=(exhaustedCounts[spec.family]??0)+1;
      const s=structuredClone(control.save), remaining=physicalCount(d)-s.attempt.board.collected.length;
      const actual=findContinue(s.attempt,d,3000,performance.now()+3200);
      let actualBuy=false;
      if(actual.status==='PROVEN_RECOVERABLE'){
        const b={...s.attempt.board,movesLeft:10,phase:'playing' as const};
        assert.equal(replay(b,actual.path,d)?.phase,'won','Continue oracle');
        actualBuy=buyContinue(s,{attemptId:s.attempt.id,deal:d,path:actual.path});
      }
      const adaptive=Math.max(5,Math.min(30,5*Math.ceil(0.5*remaining/5)));
      const probes=[];
      for(const moves of [...new Set([10,20,adaptive])]){
        const board={...control.save.attempt.board,movesLeft:moves,phase:'playing' as const};
        const answer=resolveHintRoute(board,d);
        const last=answer.status==='SOLVED'?replay(board,answer.path,d):undefined;
        if(answer.status==='SOLVED')assert.equal(last?.phase,'won','counterfactual recovery oracle');
        probes.push({moves,status:answer.status,proofCost:last?moves-(last.movesLeft??0):null});
      }
      recovery.push({key:spec.key,family:spec.family,policy,remaining,actual:actual.status,actualBuy,probes});
    }
  }
  writeFileSync(OUT+'/episodes.json',JSON.stringify(rows,null,2));
  writeFileSync(OUT+'/recovery.json',JSON.stringify(recovery,null,2));
  console.log('STUDY238_CASE '+JSON.stringify({family:spec.family,key:spec.key,margin:spec.margin,
    episodes:rows.slice(-4).map(r=>({policy:r.policy,help:r.help,status:r.status,actions:r.actions,requested:r.requested,solved:r.solved,used:r.used,spent:r.hintSpent}))}));
}
const summaries=[];
for(const family of ['current','hitapps-donor','azur-shape']){
  for(const margin of ['published','15','25']){
    for(const help of [false,true]){
      const rr=rows.filter(r=>r.family===family&&r.margin===margin&&r.help===help);
      if(!rr.length)continue;
      const sum=(k:string)=>rr.reduce((n,r)=>n+Number(r[k]??0),0);
      summaries.push({family,margin,help,n:rr.length,wins:rr.filter(r=>r.status==='won').length,
        exhausted:rr.filter(r=>r.status==='exhausted').length,requested:sum('requested'),solved:sum('solved'),
        used:sum('used'),changedAction:sum('different'),denied:sum('hintDenied'),hintSpent:sum('hintSpent'),
        stockSpent:sum('stockSpent'),actions:sum('actions'),remainingMoveCoins:sum('movesBonus'),
        // Counterfactual payout only; not a product rule or longitudinal balance.
        remainingMoveCoinsAt2:rr.filter(r=>r.status==='won').reduce((n,r)=>n+2*Number(r.spare),0)});
    }
  }
}
const report={head:process.env.GITHUB_SHA??'local',m1:M1,authoring:authored,
  summaries,recovery,episodes:rows.length,seconds:Math.round((performance.now()-started)/1000)};
writeFileSync(OUT+'/summary.json',JSON.stringify(report,null,2));
console.log('STUDY238_SUMMARY '+JSON.stringify(report));
