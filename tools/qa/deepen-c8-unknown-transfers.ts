/**
 * Research-only Q1b follow-up. Do not infer NO_WIN from a bounded unknown.
 * Rebuilds exact Q1 pivot from active Deal and certifies newly found wins through
 * both production Rules3 and an independent transition model.
 */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { campaignDeals } from '../../src/content/campaign';
import { applyBoard, freshAttempt, sourceCards } from '../../src/domain/engine';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { knownContinuation } from '../../src/domain/solver';
import { advance, search } from './gameplay-oracle';
import { CONTENT8_PREVIEW, type Board, type BoardCommand, type Deal, type Location } from '../../src/domain/types';

type Kind = 'other-leader' | 'other-transfer' | 'other-target' | 'transfer-vs-stock';
type Probe = { kind:string;phase:string;step:number;budget:number|null;action:string;witness:string;
  moved?:string[];prefix:string;outcome:string;route?:string;movesLeft?:number|null };
type Row = { bank:string;level:number;dealId:string;slots:string[];budget:number|null;witnessLength:number;probes:Probe[] };
const transferKinds:Kind[]=['transfer-vs-stock','other-transfer','other-leader','other-target'];
const focusLevels=[15,26,31,45,70,16,38,78,80];
const input='.authoring/content8/campaign-decisions.json';
const output='.authoring/content8/campaign-unknown-transfer-deep.json';
const maxSelected=18;
const visitCap=3200;
const ordinaryCap=1200;
const originSha=(s:string)=>createHash('sha256').update(s).digest('hex');
const encodeLocation=(loc:Location)=>loc.kind[0]+loc.index;
const encode=(a:BoardCommand)=>a.type==='transfer'?encodeLocation(a.from)+'>'+encodeLocation(a.to):a.type==='draw'?'d':'r';
function decode(s:string):BoardCommand {
  if(s==='d')return {type:'draw'};
  if(s==='r')return {type:'recycle'};
  const match=/^([twf])(\d+)>([tf])(\d+)$/.exec(s);
  if(!match)throw Error('Invalid action encoding '+s);
  const loc=(kind:string,index:string):Location=>({
    kind:kind==='t'?'tableau':kind==='w'?'waste':'foundation', index:Number(index),
  });
  return {type:'transfer',from:loc(match[1],match[2]),to:loc(match[3],match[4])};
}
function step(board:Board,action:BoardCommand,deal:Deal):Board {
  const next=applyBoard(board,action,deal);
  if(typeof next==='string')throw Error('Rules3 rejected '+deal.id+' '+encode(action)+': '+next);
  assert.deepEqual(advance(board,action,deal),next.board,'oracle transition '+deal.id+' '+encode(action));
  return next.board;
}
const line=(value:string)=>value.trim()?value.trim().split(/\s+/).map(decode):[];
function replay(board:Board,actions:BoardCommand[],deal:Deal) {
  for(const action of actions)board=step(board,action,deal);
  return board;
}
function position(deal:Deal,p:Probe) {
  assert.equal(encode(deal.winningPath[p.step-1]),p.witness,'Q1 original witness consistency');
  let board=freshAttempt(deal,'q1b-deep').board;
  board=replay(board,deal.winningPath.slice(0,p.step-1),deal);
  assert.equal(board.movesLeft,p.budget,'original pivot move budget');
  board=replay(board,line(p.prefix),deal);
  const action=decode(p.action);
  assert.equal(action.type,'transfer','deep-search target must be transfer');
  if(action.type==='transfer' && p.moved)assert.deepEqual(sourceCards(board,action.from,deal),p.moved);
  return step(board,action,deal);
}
function selectedUnknown(rows:Row[]) {
  const all=rows.filter(r=>r.bank==='campaign').flatMap(row=>row.probes.filter(p=>
    p.outcome==='UNKNOWN' && transferKinds.includes(p.kind as Kind)).map(probe=>({row,probe})));
  const key=(x:typeof all[number])=>x.row.dealId+'|'+x.probe.step+'|'+x.probe.action+'|'+x.probe.kind;
  const picked:typeof all=[];const used=new Set<string>();const choose=(fn:(x:typeof all[number])=>boolean)=>{
    const item=all.find(x=>fn(x)&&!used.has(key(x)));
    if(item && picked.length<maxSelected){picked.push(item);used.add(key(item));}
  };
  // The difficult or representative actual game positions get first access.
  for(const level of focusLevels)choose(x=>x.row.level===level);
  // Then give each distinct action class / witness phase its own opportunity.
  for(const kind of transferKinds)for(const phase of ['early','middle','late'])
    choose(x=>x.probe.kind===kind&&x.probe.phase===phase);
  // Fill across levels, not with dozens of probes from one scenario.
  for(const item of all) {
    if(picked.length===maxSelected)break;
    choose(x=>x===item&&!picked.some(prev=>prev.row.level===x.row.level));
  }
  return {population:all.length,selected:picked};
}
assert(CONTENT8_PREVIEW,'Q1b requires VITE_CONTENT8_PREVIEW=1');
const raw=await readFile(input,'utf8'),source=JSON.parse(raw) as {schema:number;rows:Row[]};
assert.equal(source.schema,1);
assert.equal(source.rows.filter(x=>x.bank==='campaign').length,80);
const {population,selected}=selectedUnknown(source.rows);
assert.equal(population,203,'Q1b active-campaign UNKNOWN transfer denominator changed');
const records=[];
for(const {row,probe} of selected) {
  const deal=campaignDeals[row.level-1];
  assert.equal(deal.id,row.dealId,'active published deal identity');
  const board=position(deal,probe);
  let route=knownContinuation(board,deal);
  let visited=0;
  let proof=route?'knownContinuation':null;
  if(!route && !deal.lock && !board.joker && !Object.values(deal.cards).some(card=>card.ordered)) {
    const result=findReferenceRoute(deal,board,ordinaryCap);
    if(result.status==='FOUND'){route=result.path;proof='ordinary-search';}
  }
  if(!route) {
    const result=search(board,deal,visitCap);
    visited=result.visited;
    if(result.status==='SOLVED'){route=result.path;proof='independent-oracle';}
  }
  let movesLeft:null|number=null,extraMovesVsWitness:null|number=null;
  if(route) {
    const terminal=replay(board,route,deal);
    assert.equal(terminal.phase,'won','new independently confirmed full win');
    movesLeft=terminal.movesLeft;
    extraMovesVsWitness=row.budget===null?null:row.budget-row.witnessLength-movesLeft!;
  }
  const record={level:row.level,dealId:row.dealId,step:probe.step,kind:probe.kind,
    phase:probe.phase,action:probe.action,originalOutcome:probe.outcome,
    result:route?'VERIFIED_WIN':'UNKNOWN_LIMIT',proof,visited,
    ...route?{path:route.map(encode).join(' '),movesLeft,extraMovesVsWitness}:{},
  };
  records.push(record);
  console.log('Q1B_DEEP_POSITION '+JSON.stringify({level:record.level,step:record.step,
    kind:record.kind,result:record.result,visited:record.visited,
    extraMovesVsWitness:route?extraMovesVsWitness:undefined}));
}
const summary={
  schema:'c8-q1b-stratified-deep-v1',
  sourceSha256:originSha(raw),originalUnknownTransfers:population,
  selected:records.length,visitCap,ordinaryCap,
  newlyVerifiedWins:records.filter(x=>x.result==='VERIFIED_WIN').length,
  stillUnknown:records.filter(x=>x.result==='UNKNOWN_LIMIT').length,
  records,
  caution:'Selected subset of 203 UNKNOWN; no bounded miss proves impossible. Alternative route cost is vs authored witness, not minimum regret. No human/device/original-game runtime evidence.',
};
await mkdir('.authoring/content8',{recursive:true});
await writeFile(output,JSON.stringify(summary)+'\n');
console.log('C8_Q1B_DEEP '+JSON.stringify({...summary,records:summary.records.filter(x=>x.result==='VERIFIED_WIN').slice(0,8)}));
