/** Audit only. Does not author deals, change runtime rules or write player saves. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { campaignDeals } from '../src/content/campaign';
import { dailyPool } from '../src/content/daily';
import { modifierDeals } from '../src/content/modifiers';
import { applyBoard, assertBoard, dispatch, freshSave, packet, placeJoker } from '../src/domain/engine';
import { decodeSave } from '../src/platform/storage';
import { advance, group, identity, options } from './qa/gameplay-oracle';
import type { Board, BoardCommand, Deal, Location } from '../src/domain/types';

const dir = 'docs/qa/rules-audit-2026-11-12';
const deals = [...campaignDeals, ...dailyPool];
const move = (from: number, to: number, kind: 'tableau'|'foundation' = 'tableau'): BoardCommand => ({type:'transfer',from:{kind:'tableau',index:from},to:{kind,index:to}});
const memberOntoLowerLeader = (b: Board, a: BoardCommand, d: Deal) => a.type === 'transfer' && a.to.kind === 'tableau' &&
  group(b,a.to.index,d).some(id=>d.cards[id].leader) &&
  !(a.from.kind === 'tableau' ? group(b,a.from.index,d) : a.from.kind === 'waste' ? b.waste.slice(-1) : []).some(id=>d.cards[id].leader);

// Exhausts destinations and source zones, including forbidden foundations/waste destinations.
// Does not enumerate candidates through production legalCommands/applyBoard.
function candidates(b: Board): BoardCommand[] {
  const locs: Location[] = [...b.tableau.map((_,index)=>({kind:'tableau' as const,index})),
    ...b.foundations.map((_,index)=>({kind:'foundation' as const,index})),{kind:'waste',index:0}];
  return [...locs.flatMap(from=>locs.map(to=>({type:'transfer' as const,from,to}))),{type:'draw'},{type:'recycle'}];
}
function invariants(b: Board,d: Deal) {
  const ids=[...b.tableau.flat(),...b.foundations.flat(),...b.stock,...b.waste,...b.collected];
  assert.deepEqual([...ids].sort(),Object.keys(d.cards).sort()); assert.equal(new Set(ids).size,ids.length);
  for(const f of b.foundations) if(f.length) {
    assert.equal(new Set(f.map(id=>d.cards[id].category)).size,1);
    assert.equal(f.filter(id=>d.cards[id].leader).length,1);
    assert.ok(f.every(id=>b.faceUp.includes(id)));
    assert.equal(f.at(-1),f.find(id=>d.cards[id].leader));
  }
  assert.ok(b.waste.every(id=>b.faceUp.includes(id)));
  assert.ok(b.stock.every(id=>!b.faceUp.includes(id)));
  for(const id of b.collected) {
    const cat=d.cards[id].category;
    assert.ok(Object.values(d.cards).filter(c=>c.category===cat).every(c=>b.collected.includes(c.id)));
  }
  assert.equal(b.phase==='won',b.collected.length===Object.keys(d.cards).length);
}

// Explicit decision table: expectations do not come from the solver/oracle.
const fixture: Deal={id:'audit-fixture',version:1,title:'Audit only',editorialStatus:'Not campaign',winningPath:[],cards:Object.fromEntries(
  ['a','b'].flatMap(category=>[0,1,2,3].map(n=>{const id=n?category+n:category;return[id,{id,category,text:id,leader:n===0,explanation:id}]}))),
  initial:{tableau:[[],[],[],[]],foundations:[[],[]],stock:[],waste:[],faceUp:[],collected:[],movesLeft:20,phase:'playing'}};
function position(tableau: string[][], foundations: string[][]=[[],[]], waste: string[]=[], hidden: string[]=[]): Board {
  const assigned=[...tableau.flat(),...foundations.flat(),...waste];
  return {...structuredClone(fixture.initial),tableau,foundations,waste,stock:Object.keys(fixture.cards).filter(id=>!assigned.includes(id)),faceUp:assigned.filter(id=>!hidden.includes(id))};
}
const table: {name:string;accepted:boolean;reason?:string;observed?:unknown}[]=[];
function check(name:string,b:Board,a:BoardCommand,accepted:boolean,d:Deal=fixture) {
  const before=JSON.stringify(b),r=applyBoard(b,a,d); assert.equal(typeof r!=='string',accepted,name); assert.equal(JSON.stringify(b),before,name+' input mutation');
  if(typeof r!=='string'){invariants(r.board,d); assert.equal(r.board.movesLeft,b.movesLeft===null?null:b.movesLeft-1);}
  table.push({name,accepted,...(typeof r==='string'?{reason:r}:{observed:r.board})});return typeof r==='string'?null:r.board;
}
check('member onto same-category member',position([['a1'],['a2'],[],[]]),move(0,1),true);
check('member onto other-category member',position([['a1'],['b1'],[],[]]),move(0,1),false);
check('member onto lower leader: CURRENT authored rule, disputed by owner',position([['a1'],['a'],[],[]]),move(0,1),true);
check('leader onto same-category member',position([['a'],['a1'],[],[]]),move(0,1),true);
check('leader onto other-category member',position([['a'],['b1'],[],[]]),move(0,1),false);
check('whole member packet onto member',position([['a1','a2'],['a3'],[],[]]),move(0,1),true);
check('packet with leader starts upper collection and immediately clears complete category',position([['a1','a2','a3','a'],[],[],[]]),move(0,0,'foundation'),true);
check('ordinary member cannot start empty upper slot',position([['a1'],[],[],[]]),move(0,0,'foundation'),false);
check('leader starts upper slot',position([['a'],[],[],[]]),move(0,0,'foundation'),true);
check('ordinary member adds to matching upper slot',position([['a1'],[],[],[]],[['a'],[]]),move(0,0,'foundation'),true);
check('ordinary member cannot add to other upper category',position([['b1'],[],[],[]],[['a'],[]]),move(0,0,'foundation'),false);
check('upper cards cannot be moved back',position([[],[],[],[]],[['a'],[]]),{type:'transfer',from:{kind:'foundation',index:0},to:{kind:'tableau',index:0}},false);
check('empty lower column accepts ordinary member',position([['a1'],[],[],[]]),move(0,1),true);
check('same column is free rejection',position([['a1'],[],[],[]]),move(0,0),false);
check('face-down source unavailable',position([['a1'],[],[],[]],[[],[]],[],['a1']),move(0,1),false);
check('transfer cannot target waste',position([['a1'],[],[],[]]),{type:'transfer',from:{kind:'tableau',index:0},to:{kind:'waste',index:0}},false);
check('only last waste card is accessible',position([[],[],[],[]],[['a'],[]],['a1','b1']),{type:'transfer',from:{kind:'waste',index:0},to:{kind:'foundation',index:0}},false);
check('last waste member adds to matching upper collection',position([[],[],[],[]],[['a'],[]],['b1','a1']),{type:'transfer',from:{kind:'waste',index:0},to:{kind:'foundation',index:0}},true);
check('recycle forbidden before stock empty',position([['a1'],[],[],[]],[[],[]],['a2']),{type:'recycle'},false);
const allWaste=position([[],[],[],[]],[[],[]],Object.keys(fixture.cards));
const recycled=check('recycle preserves remaining order and closes every card',allWaste,{type:'recycle'},true)!;
assert.deepEqual(recycled.stock,allWaste.waste);assert.deepEqual(recycled.faceUp,[]);
check('draw forbidden from empty stock',allWaste,{type:'draw'},false);
check('no board command after exhaustion',{...position([['a'],[],[],[]]),movesLeft:0,phase:'exhausted'},move(0,0,'foundation'),false);
const last=position([['a3'],[],[],[]],[['a1','a2','a'],[]]);last.stock=[];last.collected=['b','b1','b2','b3'];last.faceUp.push(...last.collected);last.movesLeft=1;
const won=check('last allowed move wins instead of exhaustion',last,move(0,0,'foundation'),true)!;assert.equal(won.phase,'won');
const completeBelow=position([['a1','a2','a3'],['a'],[],[]]);
const lower=check('complete category below remains movable, no automatic clearing',completeBelow,move(0,1),true)!;assert.deepEqual(lower.collected,[]);
const hidden=position([['b1','a1','a2'],['a3'],[],[]],[[],[]],[],['b1']);
const exposed=check('whole packet moves, underlying card flips in same turn',hidden,move(0,1),true)!;assert.deepEqual(exposed.tableau[0],['b1']);assert.ok(exposed.faceUp.includes('b1'));
const ordered=modifierDeals[2], lock=modifierDeals[4], joker=modifierDeals[0];
let ob=check('ordered leader starts collection',ordered.initial,move(0,0,'foundation'),true,ordered)!;
check('ordered skip refuses and names first missing rank',ob,move(2,0,'foundation'),false,ordered);
ob=check('ordered next rank accepted',ob,move(1,0,'foundation'),true,ordered)!;
check('ordered next gap refused',ob,move(1,0,'foundation'),false,ordered);
check('locked source refused',lock.initial,move(3,0,'foundation'),false,lock);
check('locked destination refused',lock.initial,move(0,3),false,lock);
let jb=placeJoker(joker.initial,0,joker);assert.notEqual(typeof jb,'string');jb=jb as Board;
check('Joker blocks original packet',jb,move(0,0,'foundation'),false,joker);
jb=check('Joker accepts first packet from any category',jb,move(2,0),true,joker)!;
check('occupied Joker rejects second packet',jb,move(2,0),false,joker);

let states=0,comparisons=0,accepted=0,rejected=0,economyChecks=0;
const impact: object[]=[];
function auditState(b:Board,d:Deal) {
  states++;invariants(b,d);
  for(const a of candidates(b)) {
    const snap=JSON.stringify(b),p=applyBoard(b,a,d),q=advance(b,a,d);comparisons++;
    assert.equal(JSON.stringify(b),snap,'transition mutated input');
    assert.equal(typeof p==='string',q===null,d.id+' acceptance mismatch '+JSON.stringify(a));
    if(q){accepted++;assert.deepEqual((p as {board:Board}).board,q);invariants(q,d);}
    else rejected++;
    if(states%31===0) {
      const save=freshSave(d,'audit-resources');save.attempt.board=structuredClone(b);
      save.campaign={version:1,tutorials:['hint-demo']};save.platform={receipts:[],continuedAttempts:[],continueCredits:0,winsSinceInterstitial:0,lastFullscreenAt:0,completedCampaign:campaignDeals.slice(0,26).map(d=>d.id)};
      save.attempt.streak.progress=2;
      const original=JSON.stringify(save),r=dispatch(save,a,d);assert.equal(JSON.stringify(save),original);economyChecks++;
      if(!q) {
        assert.equal(r.accepted,false);assert.deepEqual(r.next.attempt.board,b);assert.deepEqual(r.next.attempt.undo,[]);assert.deepEqual(r.next.profile,save.profile);
        assert.equal(r.next.attempt.streak.progress,a.type==='transfer'&&b.phase==='playing'?0:2);
      }else {
        assert.equal(r.accepted,true);assert.deepEqual(r.next.attempt.board,q);assert.equal(r.next.attempt.undo.length,1);
        if(q.phase!=='won') {
          const undone=dispatch(r.next,{type:'undo'},d);assert.equal(undone.accepted,true);assert.deepEqual(undone.next.attempt.board,b);
          assert.equal(undone.next.profile.undos,save.profile.undos-1);assert.equal(undone.next.profile.coins,r.next.profile.coins);
          assert.deepEqual(undone.next.attempt.streak,r.next.attempt.streak);
        }
      }
    }
  }
}
for(const d of deals) {
  let b=structuredClone(d.initial);const forbidden:object[]=[];
  for(const [i,a]of d.winningPath.entries()) {
    auditState(b,d);
    if(memberOntoLowerLeader(b,a,d))forbidden.push({step:i+1,action:a,moving:a.type==='transfer'?(a.from.kind==='tableau'?group(b,a.from.index,d):b.waste.slice(-1)):[],target:a.type==='transfer'?group(b,a.to.index,d):[]});
    b=advance(b,a,d)!;assert.ok(b);
  }
  auditState(b,d);assert.equal(b.phase,'won');impact.push({id:d.id,level:d.campaignLevel??null,steps:d.winningPath.length,affected:forbidden.length>0,forbidden});
  // Alternate reachable states: two deterministic walks, no witness/solver selection.
  for(let seed=1;seed<=2;seed++) {
    b=structuredClone(d.initial);let rng=seed*193+(d.campaignLevel??deals.indexOf(d))*977;
    for(let i=0;i<18&&b.phase==='playing';i++) {
      rng=(Math.imul(rng,1664525)+1013904223)>>>0;const opts=options(b,d,true);if(!opts.length)break;
      b=opts[rng%opts.length].board;auditState(b,d);
    }
  }
  console.info('checked '+d.id);
}

// Audit-only alternate rule. A bounded search failure is UNKNOWN, never proof a deal breaks.
function strictSearch(d:Deal,limit:number) {
  const q=[{board:d.initial,path:[] as BoardCommand[]}],seen=new Map([[identity(d.initial,d),d.initial.movesLeft??Infinity]]);let at=0;
  while(at<q.length&&at<limit) {
    const n=q[at++];if(n.board.phase==='won')return{status:'SOLVED',visited:at,path:n.path};
    for(const x of options(n.board,d,true)) {
      if(memberOntoLowerLeader(n.board,x.action,d))continue;
      const key=identity(x.board,d),budget=x.board.movesLeft??Infinity;if((seen.get(key)??-1)>=budget)continue;
      seen.set(key,budget);q.push({board:x.board,path:[...n.path,x.action]});
    }
  }
  return{status:at<q.length?'UNKNOWN':'UNSOLVABLE',visited:at};
}
const searches=[];
for(const level of [1,2,3,6,10,19,21,22,23,24,25,26,35,64,80]) {
  const d=campaignDeals[level-1],result=strictSearch(d,8000); searches.push({id:d.id,...result});console.info('strict '+d.id+' '+result.status);
}

// Explicit counterexample to interpreting UNKNOWN / an invalid old witness as an impossible deal.
// Same three opening moves, reordered through the upper slots; no lower leader is a destination.
const six=campaignDeals[5],sixPath=[move(1,1,'foundation'),move(0,1,'foundation'),move(0,0,'foundation'),...six.winningPath.slice(3)];
let sixBoard=six.initial;
for(const a of sixPath){assert.equal(memberOntoLowerLeader(sixBoard,a,six),false);sixBoard=advance(sixBoard,a,six)!;assert.ok(sixBoard);}
assert.equal(sixBoard.phase,'won');
const manualStrictWitness={id:six.id,originalLength:six.winningPath.length,newLength:sixPath.length,remaining:sixBoard.movesLeft,path:sixPath,note:'Audit evidence only; published winningPath not replaced.'};

// Defensive load validation is a separate question from reachability through normal moves.
// A real, legal unlimited opening can exceed the loader's history limit.
let longSave=freshSave(campaignDeals[0],'audit-long-attempt');
for(const a of campaignDeals[0].winningPath.slice(0,5)) { const r=dispatch(longSave,a,campaignDeals[0]);assert.ok(r.accepted);longSave=r.next; }
const prefix=longSave.attempt.undo.length;
for(let i=0;i<301-prefix;i++) {const r=dispatch(longSave,move(i%2===0?1:0,i%2===0?0:1),campaignDeals[0]);assert.ok(r.accepted);longSave=r.next;}
assert.equal(longSave.attempt.undo.length,301);assert.equal(longSave.attempt.board.phase,'playing');assertBoard(longSave.attempt.board,campaignDeals[0]);
let longLoadError='';try{decodeSave(JSON.stringify(longSave),campaignDeals[0]);}catch(e){longLoadError=String(e);}
assert.ok(longLoadError.includes('Повреждена история'));
const historyOverflow={dealId:campaignDeals[0].id,prefixMoves:5,loopMoves:296,acceptedCommands:301,historyLength:longSave.attempt.undo.length,phase:longSave.attempt.board.phase,movesLeft:longSave.attempt.board.movesLeft,loadError:longLoadError};

const malformed=[];
for(const [name,mutate]of [
  ['mixed upper categories',(b:Board)=>{b.foundations[0]=['a','b1'];b.stock=b.stock.filter(id=>!['a','b1'].includes(id));b.faceUp.push('a','b1');}],
  ['upper collection without leader',(b:Board)=>{b.foundations[0]=['a1'];b.stock=b.stock.filter(id=>id!=='a1');b.faceUp.push('a1');}],
  ['partially collected category',(b:Board)=>{b.collected=['a1'];b.stock=b.stock.filter(id=>id!=='a1');b.faceUp.push('a1');}],
] as const) {
  const s=freshSave(fixture,'audit-corrupt');s.attempt.board=position([[],[],[],[]]);mutate(s.attempt.board);
  let loaded=false;try{decodeSave(JSON.stringify(s),fixture);loaded=true;}catch{}
  malformed.push({name,acceptedByLoader:loaded,reachableByLegalMoves:false});
}
await mkdir(dir,{recursive:true});
const affected=impact.filter(x=>(x as {affected:boolean}).affected);
const summary={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),versions:{app:'0.9.4',rules:2,content:5,balance:3},decisionTableCases:table.length,deals:deals.length,states,comparisons,accepted,rejected,economyChecks,affectedWitnesses:affected.length,affectedCampaign:affected.filter(x=>(x as {level:number|null}).level!==null).length,affectedDaily:affected.filter(x=>(x as {level:number|null}).level===null).length,strictSearchLimit:8000,strictSearches:searches.map(({id,status,visited})=>({id,status,visited})),historyOverflow,malformed,note:'Oracle matches our written rules, not independent proof of the disputed design. Strict-rule witness rejection does not prove deal unsolvability. No runtime, bank or saves changed.'};
// Keep each evidence record on one line rather than thousands of indentation-only lines.
const encode=(data:Record<string,unknown>)=>'{\n'+Object.entries(data).map(([key,value])=>JSON.stringify(key)+':'+(Array.isArray(value)?'[\n'+value.map(x=>JSON.stringify(x)).join(',\n')+'\n]':JSON.stringify(value))).join(',\n')+'\n}\n';
await writeFile(dir+'/results.json',encode({summary,decisionTable:table,impact,strictSearches:searches,manualStrictWitness}));console.info(JSON.stringify(summary));
