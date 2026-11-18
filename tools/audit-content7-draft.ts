/** Bounded offline diagnostics. Structural choices are proxies, never enjoyment scores. */
import {readFile,writeFile} from 'node:fs/promises';
import {advance,group,identity,options} from './qa/gameplay-oracle';
import {independentRoute} from './qa/content7-search';
import {directOnly} from './qa/direct-only-policy';
import {applyBoard} from '../src/domain/engine';
import plan from '../docs/content/CONTENT_V7_LEVEL_PLAN.json' with {type:'json'};
import type {Board,BoardCommand,Deal} from '../src/domain/types';
const end=Number(process.env.C7_STAGE??15),records=JSON.parse(await readFile(`.authoring/content7/stage-${end}.json`,'utf8')) as {deal:Deal;author:unknown}[];
const all=[];
function check(d:Deal,input:Board,path:BoardCommand[]){let b=structuredClone(input);for(const a of path){const p=applyBoard(b,a,d),q=advance(b,a,d);if(typeof p==='string'||!q||JSON.stringify(p.board)!==JSON.stringify(q))throw Error(`${d.id}: replay disagreement`);b=q;}if(b.phase!=='won')throw Error(`${d.id}: recovery did not win`);}
function candidates(b:Board,d:Deal){const seen=new Set<string>();return options(b,d,true).filter(x=>{const k=identity(x.board,d);if(seen.has(k))return false;seen.add(k);return true;});}
for(const record of records){const d=record.deal,role=plan.levels[d.campaignLevel!-1].paceRole,probe=independentRoute(d,d.initial,'none',4000),noLower=independentRoute(d,d.initial,'no-lower',d.campaignLevel!<=15?5000:1500),noEmpty=independentRoute(d,d.initial,'no-empty',d.campaignLevel===4?5000:1000),branches=[],points=[];let b=structuredClone(d.initial),compared=0,forced=0,choiceStates=0;
 check(d,d.initial,d.winningPath);if(probe.status==='FOUND')check(d,d.initial,probe.path);
 for(let i=0;i<d.winningPath.length;i++){
  const opts=candidates(b,d),locs=[...b.tableau.map((_,index)=>({kind:'tableau' as const,index})),...b.foundations.map((_,index)=>({kind:'foundation' as const,index})),{kind:'waste' as const,index:0}];
  const commands:BoardCommand[]=[{type:'draw'},{type:'recycle'},...locs.flatMap(from=>locs.map(to=>({type:'transfer' as const,from,to})))];
  for(const a of commands){const p=applyBoard(b,a,d),q=advance(b,a,d);if((typeof p==='string')!==!q||typeof p!=='string'&&JSON.stringify(p.board)!==JSON.stringify(q))throw Error(`${d.id} step ${i}: oracle acceptance/state disagreement`);compared++;}
  const leaderMoves=opts.filter(x=>x.action.type==='transfer'&&x.action.to.kind==='foundation'&&!b.foundations[x.action.to.index].length);
  const lowerAccess=opts.filter(x=>{const a=x.action;if(a.type!=='transfer'||a.from.kind!=='tableau'||a.to.kind!=='tableau')return false;return b.tableau[a.from.index].length>group(b,a.from.index,d).length;});
  const wasteChoice=b.waste.length&&opts.some(x=>x.action.type==='draw')&&opts.some(x=>x.action.type==='transfer'&&x.action.from.kind==='waste');
  const visibleLeaders=b.tableau.filter((_,i)=>group(b,i,d).some(id=>d.cards[id].leader)).length;
  const meaningful=leaderMoves.length>1&&visibleLeaders>b.foundations.filter(c=>!c.length).length||lowerAccess.length>=2||Boolean(wasteChoice);
  if(meaningful)choiceStates++;else forced++;
  if(meaningful&&!['REST','TUTORIAL'].includes(role)&&points.length<(role==='PEAK'?3:2)){
   const different=opts.filter(x=>JSON.stringify(x.action)!==JSON.stringify(d.winningPath[i])).sort((x,y)=>(leaderMoves.includes(y)?3:lowerAccess.includes(y)?2:0)-(leaderMoves.includes(x)?3:lowerAccess.includes(x)?2:0)),alternatives=[];
   for(const x of different.slice(0,5)){
    const route=independentRoute(d,x.board,'none',1800);
    alternatives.push({action:x.action,status:route.status,visited:route.visited,...(route.status==='FOUND'?{recoveryPath:route.path,totalAcceptedActions:i+1+route.path.length}:{})});
    if(route.status==='FOUND'){
     check(d,x.board,route.path);
     if(branches.length<3)branches.push({atStep:i,action:x.action,recoveryPath:route.path,totalAcceptedActions:i+1+route.path.length,extraAgainstReference:i+1+route.path.length-d.winningPath.length,reason:x.action.type==='draw'?'Пропустить доступную текущую карту; вернуться к ней через колоду.':x.action.type==='transfer'&&x.action.to.kind==='foundation'?'Другой порядок занятости верхних тем.':'Другая нижняя подготовка меняет порядок доступа.'});
     break;
    }
   }
   if(alternatives.length)points.push({atStep:i,kind:leaderMoves.length>1?'limited-slot-priority':wasteChoice?'use-or-bury-waste':'lower-access-order',alternatives});
  }
  b=advance(b,d.winningPath[i],d)!;
 }
 const runs=Array.from({length:17},(_,i)=>directOnly(d,i));for(const run of runs){let b=structuredClone(d.initial);for(const a of run.path){const p=applyBoard(b,a,d),q=advance(b,a,d);if(typeof p==='string'||!q||JSON.stringify(p.board)!==JSON.stringify(q))throw Error('simple policy oracle mismatch');b=q;}}
 const result={level:d.campaignLevel,independentSearch:{status:probe.status,visited:probe.visited,actions:probe.path.length,...(probe.status==='FOUND'?{path:probe.path}:{})},simple:{wins:runs.filter(r=>r.outcome==='won').length,runs:runs.map(({path,...r})=>r)},noLower:{status:noLower.status,visited:noLower.visited,actions:noLower.path.length},noEmpty:{status:noEmpty.status,visited:noEmpty.visited,actions:noEmpty.path.length},decisionPoints:points,recoverableAlternatives:branches,structuralProxy:{choiceStates,otherStates:forced,note:'Distinct actionable leader priorities, at least two lower uncovering transfers, or use-vs-bury waste. Other states include routine and unclassified decisions; not human meaningful/forced ground truth.'},compared};all.push(result);
 await writeFile(`.authoring/content7/audit-${end}.json`,JSON.stringify(all,null,2)+'\n');console.log(`${d.campaignLevel}: independent=${probe.status}/${probe.path.length}; direct=${result.simple.wins}/17; noLower=${noLower.status}; noEmpty=${noEmpty.status}; points=${points.length} recoveries=${branches.length}`);
}
