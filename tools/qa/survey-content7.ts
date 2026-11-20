/** Survey every distinct legal alternative at the first2 authored peak decision states
 * (first1 in a BASE), rather than stopping at the first recoverable example. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {campaignDeals} from '../../src/content/campaign';
import {advance,identity,options} from './gameplay-oracle';
import {independentRoute} from './content7-search';
import plan from '../../docs/content/CONTENT_V7_LEVEL_PLAN.json' with {type:'json'};
import type {Board,BoardCommand} from '../../src/domain/types';
const analyses=JSON.parse(await readFile('docs/qa/content-v7/independent-analysis.json','utf8'));
const passports=plan.levels;
const records=[];
for(const [i,d]of campaignDeals.entries()){
 const meta=passports[i],a=analyses[i],states=[];let b=structuredClone(d.initial);
 const sampled=a.decisionPoints.slice(0,meta.paceRole==='PEAK'?2:1).map((p:any)=>p.atStep);
 for(let step=0;step<d.winningPath.length;step++){
  if(sampled.includes(step)){
   const seen=new Set<string>(),alternatives=[];
   for(const x of options(b,d,true)){
    if(JSON.stringify(x.action)===JSON.stringify(d.winningPath[step]))continue;
    const k=identity(x.board,d);if(seen.has(k))continue;seen.add(k);
    const limited=independentRoute(d,x.board,'none',4000);
    let withoutBudget:ReturnType<typeof independentRoute>|undefined;
    if(limited.status==='UNSOLVABLE')withoutBudget=independentRoute(d,{...structuredClone(x.board),movesLeft:null,phase:'playing'},'none',6000);
    const replay=(start:Board,path:BoardCommand[])=>{let n=start;for(const c of path){const next=advance(n,c,d);if(!next)throw Error('survey oracle refused route');n=next;}if(n.phase!=='won')throw Error('survey route did not win');};
    if(limited.status==='FOUND')replay(x.board,limited.path);
    if(withoutBudget?.status==='FOUND')replay({...structuredClone(x.board),movesLeft:null,phase:'playing'},withoutBudget.path);
    alternatives.push({action:x.action,status:limited.status,visited:limited.visited,...(limited.status==='FOUND'?{recoveryPath:limited.path,totalActions:step+1+limited.path.length}:{}),...(withoutBudget?{withoutBudget}:{}),information: d.initial.faceUp.length===d.initial.tableau.flat().length?'All tableau cards visible at start; no hidden-card guess':'Some cards closed; manual fairness review required for a confirmed deadlock'});
   }
   states.push({atStep:step,prefix:d.winningPath.slice(0,step),alternatives});
  }
  b=advance(b,d.winningPath[step],d)!;
 }
 const r={level:i+1,id:d.id,initialSHA:createHash('sha256').update(JSON.stringify(d.initial)).digest('hex'),states};records.push(r);
 await writeFile('docs/qa/content-v7/branch-survey.json','[\n'+records.map(r=>JSON.stringify(r)).join(',\n')+'\n]\n');
 console.log(`${i+1}: ${states.reduce((n,s)=>n+s.alternatives.length,0)} alternatives; failed-budget ${states.flatMap(s=>s.alternatives).filter(a=>a.status==='UNSOLVABLE').length}; unknown ${states.flatMap(s=>s.alternatives).filter(a=>a.status==='UNKNOWN').length}`);
}
