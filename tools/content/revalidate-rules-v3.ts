/** Offline revalidation only: never regenerate orders, budgets, IDs or daily rotation. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { campaignDeals } from '../../src/content/campaign';
import { dailyPool } from '../../src/content/daily';
import { introDeal } from '../../src/content/intro';
import currentWitnesses from '../../src/content/rules-v3-paths.json' with { type: 'json' };
import { applyBoard } from '../../src/domain/engine';
import { advance } from '../qa/gameplay-oracle';
import { findWitness } from './search';
import type { BoardCommand, Deal } from '../../src/domain/types';

const paths: Record<string,BoardCommand[]>={}, records:object[]=[],failed:string[]=[];
const replay=(d:Deal,path:BoardCommand[])=>{
  let b=d.initial;
  for(const action of path){const r=applyBoard(b,action,d);if(typeof r==='string')return null;const other=advance(b,action,d);assert.deepEqual(r.board,other);b=r.board;}
  return b.phase==='won'?b:null;
};
for(const d of [introDeal,...campaignDeals,...dailyPool]) {
  if(process.env.ASOC_RULES_DEAL&&d.id!==process.env.ASOC_RULES_DEAL)continue;
  const original=d.legacyWinningPath??d.winningPath;
  let path=original,visited=0;
  if(!replay(d,path)) {
    // Preserve this independently checked same-budget opening instead of finding a gratuitously new route.
    if(d.id==='campaign-006')path=[
      {type:'transfer',from:{kind:'tableau',index:1},to:{kind:'foundation',index:1}},
      {type:'transfer',from:{kind:'tableau',index:0},to:{kind:'foundation',index:1}},
      {type:'transfer',from:{kind:'tableau',index:0},to:{kind:'foundation',index:0}},...original.slice(3)];
    else if(d.id==='campaign-019') {
      // Take baking_2 on its first draw, before burying it in waste. Completing baking
      // earlier frees a slot for sweets while dishes already collects in its own upper slot.
      const t=(from:number,to:number,kind:'foundation'|'tableau'='foundation'):BoardCommand=>({type:'transfer',from:{kind:'tableau',index:from},to:{kind,index:to}});
      const w=(to:number,kind:'foundation'|'tableau'='foundation'):BoardCommand=>({type:'transfer',from:{kind:'waste',index:0},to:{kind,index:to}});
      path=[...original.slice(0,4),w(3,'tableau'),...original.slice(4,24),t(1,1),t(3,1),t(3,2,'tableau'),t(3,2),t(2,2),
        ...original.slice(27,40).map(a=>a.type==='transfer'&&a.to.kind==='foundation'&&a.to.index===1?{...a,to:{...a.to,index:2}}:a),w(1),t(2,1)];
    }
    else if(replay(d,d.winningPath))path=d.winningPath;
    else {
      const result=findWitness(d,Number(process.env.ASOC_RULES_SEARCH_LIMIT??30000));
      if(!result){failed.push(d.id);console.info(d.id+' NOT FOUND');continue;}path=result.path;visited=result.visited;
    }
    const final=replay(d,path);assert.ok(final,d.id);paths[d.id]=path;
  }
  const final=replay(d,path)!;records.push({id:d.id,changed:JSON.stringify(path)!==JSON.stringify(original),oldMoves:original.length,newMoves:path.length,budget:d.initial.movesLeft,remaining:final.movesLeft,visited,independentReplay:true});
  console.info(`${d.id}: ${original.length} -> ${path.length}, slack ${final.movesLeft??'infinite'}`);
}
await mkdir('.recording',{recursive:true});
const suffix=process.env.ASOC_RULES_DEAL?'.selected':'';
await writeFile(`.recording/rules-v3-paths${suffix}.candidate.json`,JSON.stringify({rulesVersion:3,paths,tutorialPaths:currentWitnesses.tutorialPaths},null,2)+'\n');
await writeFile(`.recording/rules-v3-paths${suffix}.checks.json`,JSON.stringify({records,failed},null,2)+'\n');
console.info(JSON.stringify({validated:records.length,overrides:Object.keys(paths).length,failed}));
if(failed.length)process.exitCode=1;
