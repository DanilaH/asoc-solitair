import { mkdir,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { campaignDeals } from '../src/content/campaign';
import { dailyPool } from '../src/content/daily';
import { topics } from '../src/content/topics';
import { applyBoard,legalCommands } from '../src/domain/engine';
import { knownContinuation,solve } from '../src/domain/solver';
import { advance,options,group,identity,search } from './qa/gameplay-oracle';
import type { Board,Deal,BoardCommand } from '../src/domain/types';
const dir='docs/qa/gameplay-audit-2026-11-11';await mkdir(dir,{recursive:true});
const deals=[...campaignDeals,...dailyPool],records:any[]=[],runs:any[]=[],counterexamples:any[]=[];
let comparisons=0;const firstTopic=new Map<string,number>(),firstMember=new Map<string,number>();
const hidden=(b:Board)=>b.tableau.flat().filter(id=>!b.faceUp.includes(id)).length;
const policies=['foundation','reveal','slots','random'] as const;
for(const d of deals){
 let b=structuredClone(d.initial),lastReveal=0;const events:any[]=[];let newTopics=0,newMembers=0;
 for(const c of Object.values(d.cards)){if(c.leader&&!firstTopic.has(c.category)&&d.campaignLevel){firstTopic.set(c.category,d.campaignLevel);newTopics++;}if(!c.leader&&!firstMember.has(c.text)&&d.campaignLevel){firstMember.set(c.text,d.campaignLevel);newMembers++;}}
 for(const [i,a]of d.winningPath.entries()){
  const choices=options(b,d),prod=legalCommands(b,d);if(choices.length!==prod.length)throw Error('legal count mismatch '+d.id);
  for(const x of choices){const p=applyBoard(b,x.action,d);if(typeof p==='string'||JSON.stringify(p.board)!==JSON.stringify(x.board))throw Error('oracle mismatch '+d.id);comparisons++;}
  const n=advance(b,a,d);if(!n)throw Error('invalid witness');
  const exposed=hidden(b)-hidden(n);if(exposed>0||a.type==='draw')lastReveal=i+1;
  events.push({step:i+1,type:a.type,foundation:a.type==='transfer'&&a.to.kind==='foundation',packet:a.type==='transfer'&&a.from.kind==='tableau'?group(b,a.from.index,d).length:1,reveals:exposed,completes:n.collected.length>b.collected.length,choices:new Set(options(b,d,true).map(x=>identity(x.board,d))).size});b=n;
 }
 if(b.phase!=='won')throw Error('witness not won');
 records.push({id:d.id,level:d.campaignLevel??null,title:d.title,tags:d.tags,cards:Object.keys(d.cards).length,categories:Object.values(d.cards).filter(c=>c.leader).map(c=>({id:c.id,title:c.text,ordered:!!c.ordered,members:Object.values(d.cards).filter(x=>!x.leader&&x.category===c.category).map(x=>x.text)})),columns:d.initial.tableau.length,slots:d.initial.foundations.length,stock:d.initial.stock.length,budget:d.initial.movesLeft,witness:d.winningPath.length,witnessSlack:d.initial.movesLeft===null?null:d.initial.movesLeft-d.winningPath.length,newTopics,newMembers,lastInformationTail:events.length-lastReveal,events});
 for(const policy of policies)for(let seed=1;seed<=4;seed++){
  let rng=seed*7919+(d.campaignLevel??Number(d.id.match(/\d+/)?.[0])??1)*977;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
  let state=structuredClone(d.initial),step=0;const seen=new Map<string,number>(),trace:BoardCommand[]=[];
  while(state.phase==='playing'&&step<120){
   const opts=options(state,d,true);if(!opts.length)break;
   const scored=opts.map(x=>{const a=x.action,n=x.board,complete=n.collected.length-state.collected.length,flip=hidden(state)-hidden(n),foundation=a.type==='transfer'&&a.to.kind==='foundation',merge=a.type==='transfer'&&a.to.kind==='tableau'&&state.tableau[a.to.index].length>0,empty=n.tableau.filter(c=>!c.length).length-state.tableau.filter(c=>!c.length).length,slots=n.foundations.filter(c=>c.length).length-state.foundations.filter(c=>c.length).length;let score=policy==='random'?random()*30:complete*10+(policy==='reveal'?flip*20:flip*6)+(foundation?(policy==='foundation'?15:7):0)+(merge?3:0)+empty*3-(policy==='slots'?slots*12:0)+(a.type==='draw'?1:0);score-=(seen.get(identity(n,d))??0)*40;return{x,score:score+random()*.1}}).sort((a,b)=>b.score-a.score);
   const selected=scored[0].x;trace.push(selected.action);state=selected.board;seen.set(identity(state,d),(seen.get(identity(state,d))??0)+1);step++;
  }
  runs.push({id:d.id,policy,seed,outcome:state.phase,steps:step,remaining:state.movesLeft,collected:state.collected.length,...(state.phase!=='won'?{trace}:{})});
 }
 console.log(d.id+' complete');
}
// Exact small-state alternative-path checks, capped independently of production solver.
for(const level of [1,2,3,6,19,21,22,23,24,25,26,30,35,44,60,80]){
 const d=campaignDeals[level-1],r=search(d.initial,d,12000);const alternatives=[];
 for(const x of options(d.initial,d,true)){const s=search(x.board,d,4000);alternatives.push({action:x.action,status:s.status,visited:s.visited,solutionLength:s.status==='SOLVED'?s.path.length:null});}
 counterexamples.push({id:d.id,shortest:r.status==='SOLVED'?r.path.length:null,status:r.status,visited:r.visited,alternatives});
 console.log('search '+d.id+' '+r.status);
}
const helpCases:any[]=[];
for(const run of runs.filter(r=>r.outcome!=='won'&&r.policy==='foundation')){
 const d=deals.find(d=>d.id===run.id)!;let b=d.initial;
 for(const [i,a]of (run.trace as BoardCommand[]).entries()){
  if(i>=run.trace.length-12){const exact=search(b,d,5000),known=knownContinuation(b,d),production=known?{status:'SOLVED',path:known}:solve(b,d,4000),action='path'in production?production.path[0]:legalCommands(b,d)[0];helpCases.push({id:d.id,policy:run.policy,seed:run.seed,step:i,board:b,exact:{status:exact.status,visited:exact.visited,length:exact.status==='SOLVED'?exact.path.length:null},hint:{status:production.status,action,guaranteed:production.status==='SOLVED'}});}
  b=advance(b,a,d)!;
 }
}
const summary={gameHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),researchHead:'60af6eeab4532e7f165c8d46665688a457b171fa',versions:{app:'0.9.1',rules:2,content:5,balance:3},deals:deals.length,oracleTransitionComparisons:comparisons,policies:policies.map(policy=>({policy,...Object.fromEntries(['won','exhausted','playing'].map(outcome=>[outcome,runs.filter(r=>r.policy===policy&&r.outcome===outcome).length]))})),firstTopic:Object.fromEntries(firstTopic),firstMember:Object.fromEntries(firstMember),topicBank:Object.entries(topics).map(([id,[title,members]])=>({id,title,members:members.map(x=>x.split('|')[0])}))};
// One generated record per line keeps the evidence reviewable without 50k indentation lines.
const encode=(data:Record<string,unknown>)=>'{\n'+Object.entries(data).map(([k,v])=>JSON.stringify(k)+':'+(Array.isArray(v)?'[\n'+v.map(x=>JSON.stringify(x)).join(',\n')+'\n]':JSON.stringify(v))).join(',\n')+'\n}\n';
await writeFile(dir+'/bank.json',encode({summary,records,counterexamples,helpCases}));
await writeFile(dir+'/agents.json',encode({note:'Perfect visible semantic recognition. No hidden-card identity in score, no solver, Undo/Joker/continuation. Four reproducible tie seeds per policy. Not human outcomes.',runs}));
console.log(JSON.stringify(summary));
