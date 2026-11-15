/** Independent acceptance for one fixed content batch; bots are diagnostics, not people. */
import assert from'node:assert/strict';import{readFile,writeFile,mkdir}from'node:fs/promises';
import reference from'../tests/fixtures/opening-audit-baseline.json'with{type:'json'};
import{campaignDeals,legacyCampaignDeals}from'../src/content/campaign';
import{applyBoard,legalCommands,placeJoker}from'../src/domain/engine';
import{advance,group}from'./qa/gameplay-oracle';import{oracleRoute}from'./qa/opening-oracle-search';
import{directOnly}from'./qa/direct-only-policy';import{searchOpening}from'./content/opening-search';
import type{Board,BoardCommand,Deal}from'../src/domain/types';
let transitions=0;function check(d:Deal,input:Board,path:BoardCommand[]){let b=structuredClone(input);for(const a of path){const p=applyBoard(b,a,d),q=advance(b,a,d);assert.notEqual(typeof p,'string',d.id);assert(q,d.id);if(typeof p==='string')throw Error(p);assert.deepEqual(p.board,q,d.id);b=q;transitions++;}return b;}
const trim=(r:ReturnType<typeof directOnly>)=>{const{path,...rest}=r;return rest;};
const baseline=[];for(let i=0;i<20;i++){const d=legacyCampaignDeals[i],runs=Array.from({length:17},(_,seed)=>directOnly(d,seed));assert.deepEqual(runs.map(trim),reference.expected[i].runs,`provided policy baseline level${i+1}`);for(const r of runs)check(d,d.initial,r.path);baseline.push({level:i+1,wins:runs.filter(r=>r.outcome==='won').length,runs:runs.map(trim)});}
console.info('Supplied policy reproduced20x17 exact; independent transitions '+transitions);
const design=JSON.parse(await readFile('docs/qa/opening-v6/design.json','utf8')),levels=[];
for(const d of campaignDeals.slice(0,15)){
 assert.equal(check(d,d.initial,d.winningPath).phase,'won');const independent=oracleRoute(d,d.initial,'no-lower');const authored=design.notes.find((n:any)=>n.id===d.id);assert.equal(independent.status,authored.structural.withoutLower.status,d.id+' restricted independent status');
 const runs=Array.from({length:17},(_,seed)=>directOnly(d,seed));for(const r of runs)check(d,d.initial,r.path);
 const row:any={level:d.campaignLevel,id:d.id,cards:Object.keys(d.cards).length,columns:d.initial.tableau.length,slots:d.initial.foundations.length,moves:d.winningPath.length,budget:d.initial.movesLeft,withoutLowerOracle:{status:independent.status,visited:independent.visited,winningMoves:independent.status==='FOUND'?independent.path.length:null},directPolicy:{wins:runs.filter(r=>r.outcome==='won').length,ties:17,runSummaries:runs.map(trim),leftToRightPath:runs[0].path}};
 if(d.campaignLevel===4){const r=oracleRoute(d,d.initial,'no-empty');assert.equal(r.status,'UNSOLVABLE');row.withoutEmptyOracle={status:r.status,visited:r.visited};}
 if(d.tutorialPath){const first=d.tutorialPath[0];assert.equal(first.type,'place-joker');if(first.type!=='place-joker')throw Error('No support');const placed=placeJoker(d.initial,first.column,d);assert.notEqual(typeof placed,'string');const expected={...structuredClone(d.initial),joker:{column:first.column,boundary:d.initial.tableau[first.column].length}};assert.deepEqual(placed,expected);const path=d.tutorialPath.slice(1)as BoardCommand[];assert.equal(check(d,expected,path).phase,'won');const plain=oracleRoute(d),supported=oracleRoute(d,expected);assert.equal(plain.status,'FOUND');assert.equal(supported.status,'FOUND');assert.equal(plain.path.length,d.winningPath.length);assert.equal(supported.path.length,path.length);row.joker={optional:true,column:first.column,helperlessShortest:plain.path.length,supportedShortest:supported.path.length,placementCostsMoves:0,placementCostsCharges:1,oracleStates:plain.visited+supported.visited};}
 levels.push(row);console.info(JSON.stringify({level:d.campaignLevel,policyWins:row.directPolicy.wins,noLower:independent.status,oracleStates:independent.visited,...(row.joker?{joker:row.joker}:{})}));
}
const counterfactuals=[];
for(const level of [6,13,15]){
 const d=campaignDeals[level-1];let board=structuredClone(d.initial),found:any;
 for(let i=0;i<d.winningPath.length&&!found;i++){
  const best=d.winningPath[i],commands=legalCommands(board,d);
  const primary=commands.filter(a=>a.type==='transfer'&&a.to.kind==='foundation'&&a.from.kind==='tableau'&&group(board,a.from.index,d).some(id=>d.cards[id].leader));
  const secondary=commands.filter(a=>a.type==='transfer'&&a.to.kind==='tableau'&&!board.tableau[a.to.index].length&&commands.some(q=>q.type==='transfer'&&q.to.kind==='foundation'&&q.from.kind===a.from.kind&&q.from.index===a.from.index));
  for(const action of [...primary,...secondary]){
   if(JSON.stringify(action)===JSON.stringify(best))continue;const r=applyBoard(board,action,d);if(typeof r==='string')continue;const suffix=searchOpening(d,{board:r.board,limit:40000});if(suffix.status!=='FOUND')continue;
   const total=i+1+suffix.path.length,extra=total-d.winningPath.length;if(extra<1||total>d.initial.movesLeft!)continue;
   assert.equal(check(d,r.board,suffix.path).phase,'won');found={level,prefix:d.winningPath.slice(0,i),choice:action,type:primary.includes(action)?'upper-category-priority':'unnecessary-parking',extraMoves:extra,totalMoves:total,budget:d.initial.movesLeft,remaining:d.initial.movesLeft!-total,correction:suffix.path,needsUndo:false,needsPaidHelper:false,note:'A legal less efficient plan with a verified recovery, not a predicted human mistake rate.'};break;
  }
  const r=applyBoard(board,best,d);if(typeof r==='string')throw Error(r);board=r.board;
 }
 assert(found,`missing recoverable choice ${level}`);counterfactuals.push(found);console.info(JSON.stringify({counterfactual:level,extra:found.extraMoves,remaining:found.remaining,type:found.type}));
}
const count=(rows:any[],n:number)=>rows.slice(0,n).filter(r=>(r.wins??r.directPolicy.wins)>0).length;
const summary={baseline:reference.source,contentVersion:6,archiveSHA256:reference.archiveSHA256,referenceRunsMatched:340,currentRuns:255,oracleReplayedTransitions:transitions,firstTen:{baselineAnyRecordedDirectWin:count(baseline,10),revisedAnyRecordedDirectWin:count(levels,10)},firstFifteen:{baselineAnyRecordedDirectWin:count(baseline,15),revisedAnyRecordedDirectWin:count(levels,15)},requiredPreparationLevels:levels.filter(r=>r.withoutLowerOracle.status==='UNSOLVABLE').map(r=>r.level),humanEnjoyment:'NOT MEASURED',limits:'Perfect semantic recognition;17tie orders are not exhaustive and seeds1..16 are correlated. Negative policy runs are not proofs. Restricted independent oracle BFS reports UNKNOWN on cap; only exhausted graphs establish the stated structural necessities. No human success probability or native performance claim.'};
await mkdir('docs/qa/opening-v6',{recursive:true});await writeFile('docs/qa/opening-v6/analysis.json',JSON.stringify({summary,levels,baseline,counterfactuals},null,2)+'\n');console.info(JSON.stringify(summary));
