/** Release gate against the separate oracle, including forbidden commands and v2 compatibility. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { campaignDeals, legacyCampaignDeals, content6CampaignDeals } from '../src/content/campaign';
import { dailyPool } from '../src/content/daily';
import { applyBoard } from '../src/domain/engine';
import { advance } from './qa/gameplay-oracle';
import { CONTENT_VERSION } from '../src/domain/types';
import type { Board, BoardCommand, Location } from '../src/domain/types';

const records:object[]=[];let states=0,accepted=0,rejected=0;
const allDeals=[...legacyCampaignDeals,...content6CampaignDeals.filter(d=>d.id.startsWith('campaign-c6-')),...campaignDeals,...dailyPool];
for(const d of allDeals)for(const version of (d.legacyWinningPath?[2,3]:[3]) as (2|3)[]) {
  let b:Board={...structuredClone(d.initial),rulesVersion:version};const path=version===2?d.legacyWinningPath!:d.winningPath;
  for(const action of path) {
    const original=JSON.stringify(b),locs:Location[]=[...b.tableau.map((_,index)=>({kind:'tableau' as const,index})),...b.foundations.map((_,index)=>({kind:'foundation' as const,index})),{kind:'waste',index:0}];
    const candidates:BoardCommand[]=[...locs.flatMap(from=>locs.map(to=>({type:'transfer' as const,from,to}))),{type:'draw'},{type:'recycle'}];
    states++;
    for(const command of candidates) {
      const p=applyBoard(b,command,d),q=advance(b,command,d);assert.equal(typeof p==='string',q===null,d.id+' '+version+' acceptance');
      if(typeof p==='string')rejected++;else{accepted++;assert.deepEqual(p.board,q,d.id+' '+version+' transition');}
    }
    assert.equal(JSON.stringify(b),original);const p=applyBoard(b,action,d);if(typeof p==='string')throw Error(d.id+': '+p);b=p.board;
  }
  assert.equal(b.phase,'won');records.push({id:d.id,rulesVersion:version,moves:path.length,budget:d.initial.movesLeft,remaining:b.movesLeft,oracle:'PASS'});
  console.info(d.id+' v'+version+' verified');
}
const summary={versions:{rules:3,content:CONTENT_VERSION,balance:3},deals:allDeals.length,paths:records.length,states,accepted,rejected,comparisons:accepted+rejected,note:'Checks rule implementation and both witnesses; not human enjoyment or exhaustive state-space proof.'};
await mkdir('docs/qa/content-v7',{recursive:true});
await writeFile('docs/qa/content-v7/full-rules.json','{\n"summary":'+JSON.stringify(summary)+',\n"records":[\n'+records.map(r=>JSON.stringify(r)).join(',\n')+'\n]}\n');
console.info(JSON.stringify(summary));
