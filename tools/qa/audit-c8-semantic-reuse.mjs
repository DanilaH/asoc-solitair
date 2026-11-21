/**
 * Content8 semantic/topic and geometry QA. This reads only OUR authored deals.
 * Comparison to source-original AZUR aggregated statistics belongs in the
 * separately sourced research report; this is not the original native dealer.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const files=[
  '../../src/content/campaign-v8-dealer.json',
  '../../src/content/campaign-v8-wave.json',
  '../../src/content/campaign-v8-late.json',
  '../../src/content/campaign-v8-special.json'
];
const read = name => readFileSync(new URL(name,import.meta.url),'utf8');
const hash = data => createHash('sha256').update(data).digest('hex');

export function loadPublishedC8() {
  const raw=files.map(read),parsed=raw.map(JSON.parse);
  const source=[...parsed[0],...parsed[1],...parsed[2]];
  assert.equal(source.length,80,'Expected 80 base Content8 levels');
  const byLevel=new Map(source.map(deal=>[deal.campaignLevel,deal]));
  assert.equal(byLevel.size,80,'Duplicate base campaignLevel');
  const special=parsed[3];
  assert.equal(special.length,5,'Unexpected special override count; review source mapping');
  for(const deal of special) {
    assert(byLevel.has(deal.campaignLevel),'Special override without previous level');
    byLevel.set(deal.campaignLevel,deal);
  }
  const selected=[...byLevel.values()].sort((a,b)=>a.campaignLevel-b.campaignLevel);
  const rows=selected.map(deal=>{
    const topics=Array.isArray(deal.topics)
      ? deal.topics.map(x=>x.id)
      : [...new Set(Object.values(deal.cards||{}).map(card=>card.category))];
    const board=deal.initial;
    assert(board && Array.isArray(board.tableau) && Array.isArray(board.foundations),
      'Invalid initial board at '+deal.campaignLevel);
    return {
      level:deal.campaignLevel,dealId:deal.id,topics,
      structure:{
        tableau:board.tableau.length,foundations:board.foundations.length,
        stock:board.stock.length,
        totalCards:board.stock.length+board.tableau.reduce((n,col)=>n+col.length,0)
          +board.foundations.reduce((n,col)=>n+col.length,0),
        budget:board.movesLeft,
      }
    };
  });
  return {rows,sourceDigest:hash(raw.join('\n')),sourceFiles:files.map((name,i)=>({
    path:name.replace('../../',''), sha256:hash(raw[i])
  }))};
}

function profile(rows) {
  const seen=new Map,repeatGaps=[],adjacentPairs=[];
  let refCount=0;
  const signature=new Map;
  for(const row of rows) {
    const ids=new Set(row.topics);
    refCount+=ids.size;
    const key=JSON.stringify(row.structure);
    signature.set(key,(signature.get(key)||0)+1);
    for(const id of ids) {
      if(seen.has(id))repeatGaps.push({topic:id,previous:seen.get(id),current:row.level,gap:row.level-seen.get(id)});
      seen.set(id,row.level);
    }
  }
  for(let i=1;i<rows.length;i++){
    if(rows[i].level!==rows[i-1].level+1)continue;
    const prev=new Set(rows[i-1].topics);
    const repeated=rows[i].topics.filter(id=>prev.has(id));
    if(repeated.length)adjacentPairs.push({from:rows[i-1].level,to:rows[i].level,topicCount:repeated.length});
  }
  const sortedGaps=repeatGaps.map(x=>x.gap).sort((a,b)=>a-b);
  return {
    levels:rows.length,range:[rows[0]?.level,rows.at(-1)?.level],
    uniqueThemeIds:seen.size,themeReferences:refCount,
    repeatOccurrences:repeatGaps.length,minimumReuseGap:sortedGaps[0]??null,
    medianReuseGap:sortedGaps.length?sortedGaps[Math.floor((sortedGaps.length-1)/2)]:null,
    repeatAtGap6:sortedGaps.filter(x=>x===6).length,
    adjacentLevelPairsWithOverlap:adjacentPairs.length,
    adjacentThemeOccurrences:adjacentPairs.reduce((n,x)=>n+x.topicCount,0),
    adjacentPairExamples:adjacentPairs.slice(0,12),
    sourceNumericGeometryProfiles:[...signature.entries()].map(([k,count])=>({
      structure:JSON.parse(k),levels:count
    })).sort((a,b)=>a.structure.totalCards-b.structure.totalCards)
  };
}

export function auditSemanticPacing(rows) {
  assert(Array.isArray(rows) && rows.length,'Nonempty rows required');
  const indexed=new Map;
  for(const row of rows){
    assert(Number.isSafeInteger(row.level)&&row.level>0,'Invalid level');
    assert(!indexed.has(row.level),'Duplicate campaign level '+row.level);
    assert(Array.isArray(row.topics)&&row.topics.length,'No topics on '+row.level);
    assert(row.topics.every(id=>typeof id==='string'&&id.length&&id.length<=100),
      'Invalid topic ID at '+row.level);
    assert(new Set(row.topics).size===row.topics.length,
      'Duplicated topic within level '+row.level);
    assert(typeof row.dealId==='string'&&row.dealId.length>0,'Missing immutable deal ID');
    assert(row.structure && row.structure.tableau>=1 && row.structure.foundations>=1
      && row.structure.stock>=0 && row.structure.totalCards>=row.topics.length,
      'Invalid geometry '+row.level);
    indexed.set(row.level,row);
  }
  const sorted=[...indexed.values()].sort((a,b)=>a.level-b.level);
  for(let i=1;i<sorted.length;i++)
    assert.equal(sorted[i].level,sorted[i-1].level+1,'Noncontiguous campaign catalog');
  const late=sorted.filter(x=>x.level>=32&&x.level<=80);
  let period7={comparedPairs:0,identicalStructurePairs:0};
  for(let i=0;i+7<late.length;i++){
    period7.comparedPairs++;
    if(JSON.stringify(late[i].structure)===JSON.stringify(late[i+7].structure))
      period7.identicalStructurePairs++;
  }
  return {
    schema:'c8-semantic-reuse-v1',
    evidence:'OUR_IMMUTABLE_DEALS_ONLY_NOT_VENDOR_NATIVE_OR_HUMAN_DIFFICULTY',
    caution:'Observed level-topic reuse is not proof of player boredom. Never auto-modify existing Deal IDs or infer original live RNG/locale from this audit.',
    full:profile(sorted),onboarding:profile(sorted.filter(x=>x.level<=3)),late:profile(late),latePeriod7:period7
  };
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const {rows,sourceDigest,sourceFiles}=loadPublishedC8();
  assert.equal(rows.length,80,'Full actual 80-level campaign required');
  const result=auditSemanticPacing(rows);
  console.log('C8_SEMANTIC_REUSE '+JSON.stringify({...result,sourceDigest,sourceFiles}));
}
