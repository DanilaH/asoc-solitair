import { writeFile } from 'node:fs/promises';
import { advance, options, identity } from '../qa/gameplay-oracle';
import data from './deals.json' with { type:'json' };
import type { Prototype } from './build';
const deals:Prototype[]=(data as unknown as Prototype[]).map(d=>({...d,initial:{...d.initial,rulesVersion:2 as const}})),runs:unknown[]=[];
for(const d of deals)for(const policy of ['foundation','reveal','slots','explore'])for(let seed=1;seed<=4;seed++){
 let b=d.initial,steps=0,rng=seed*7919;const seen=new Map<string,number>();
 const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
 const hidden=(b:typeof d.initial)=>b.tableau.flat().filter(id=>!b.faceUp.includes(id)).length;
 while(b.phase==='playing'&&steps<100){const choices=options(b,d,true).map(x=>{const n=x.board,a=x.action;let score=policy==='explore'?random()*30:(n.collected.length-b.collected.length)*10+(hidden(b)-hidden(n))*(policy==='reveal'?20:6)+(a.type==='transfer'&&a.to.kind==='foundation'?(policy==='foundation'?15:7):0)+(a.type==='draw'?1:0);if(policy==='slots')score-=12*(n.foundations.filter(c=>c.length).length-b.foundations.filter(c=>c.length).length);score-=(seen.get(identity(n,d))??0)*40;return {...x,score:score+random()*.1}}).sort((a,b)=>b.score-a.score);if(!choices.length)break;b=choices[0].board;seen.set(identity(b,d),(seen.get(identity(b,d))??0)+1);steps++;}
 runs.push({id:d.id,policy,seed,outcome:b.phase,steps});
 let replay=d.initial;for(const a of d.winningPath){const n=advance(replay,a,d);if(!n)throw Error('Invalid route');replay=n;}if(replay.phase!=='won')throw Error('Not solved');
}
await writeFile('docs/qa/prototypes-2026-11-12/agents.json',JSON.stringify({note:'96 simulated runs; visible recognition assumed perfect. No human enjoyment evidence.',runs},null,2)+'\n');
console.info(JSON.stringify(deals.map(d=>({id:d.id,wins:runs.filter((r:any)=>r.id===d.id&&r.outcome==='won').length,attempts:16}))));
