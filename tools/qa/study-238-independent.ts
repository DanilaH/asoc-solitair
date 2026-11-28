/**
 * #238 pilot5: independent ordinary-layout authoring, decision diversity and recovery.
 * Own word bank, exact source numeric profiles where available, no product issuance.
 */
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { E4_M1 } from '../../src/config/economy';
import { releaseProfile } from '../../src/config/profile';
import { campaignDeals, selectCampaignDeal } from '../../src/content/campaign';
import { topics } from '../../src/content/topics';
import { lateTopics } from '../../src/content/content8-late-topics';
import { content8Cards, extraWords, type Content8TopicSelection } from '../../src/content/content8-words';
import { applyBoard, assertBoard, freshSave, legalCommands } from '../../src/domain/engine';
import { Kind, sourceCard } from '../../src/domain/hitapps-rules';
import { resolveHintRoute } from '../../src/domain/hint';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { advance } from './gameplay-oracle';
import { dealAzur } from '../content/azur-dealer';
import { dealOrdinary } from '../content/plain-dealer';
import { campaignId } from '../../src/domain/progression';
import { platformState } from '../../src/domain/services';
import { findContinue } from '../../src/domain/continuation';
import type { Board, BoardCommand, Card, Deal } from '../../src/domain/types';

assert(E4_M1 && releaseProfile?.id==='c8-release-v1');
const profile=process.argv[2]??'current', start=performance.now();
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const out='.recording/study238-independent';
mkdirSync(out,{recursive:true});
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rng=(seed:number)=>{let x=seed>>>0;return (n:number)=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return Math.floor(x/4294967296*n);};};
function shuffle<T>(v:readonly T[],seed:number){const a=v.slice(),r=rng(seed);for(let i=a.length-1;i>0;i--){const j=r(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
const normalize=(s:string)=>s.normalize('NFC').toLocaleLowerCase('ru').replaceAll('ё','е').trim();
const topicIds=[...Object.keys(topics),...Object.keys(lateTopics)] as Content8TopicSelection['id'][];
function population(groups:number,total:number,seed:number){
  const extras=total-6*groups;
  assert(extras>=0&&extras<=groups);
  const chosen:Content8TopicSelection[]=[],labels=new Set<string>(),used=new Set<string>();
  const ranked=shuffle(topicIds,seed+731);
  for(let i=0;i<groups;i++){
    const count=i<extras?6:5;
    let found=false;
    for(const topic of ranked){
      if(used.has(topic))continue;
      if(count===6&&!Object.hasOwn(lateTopics,topic)&&!Object.hasOwn(extraWords,topic))continue;
      const row=Object.values(content8Cards([{id:topic,count}]));
      if(row.length!==count+1)continue;
      const names=row.map(c=>normalize(c.text));
      if(new Set(names).size!==names.length||names.some(n=>labels.has(n)))continue;
      chosen.push({id:topic,count});used.add(topic);names.forEach(n=>labels.add(n));found=true;break;
    }
    assert(found,'not enough noncolliding own topics');
  }
  const cards=content8Cards(chosen);assert.equal(Object.keys(cards).length,total);
  return {cards,chosen};
}
type Shape={kind:'hitapps'|'azur';groups:number;total:number;foundations:number;columns:number[];stock:number;sourceBudget?:number;numericRef:string};
const hitapps:Record<string,Shape>={
  H6:{kind:'hitapps',groups:6,total:36,foundations:3,columns:[3,4,5],stock:24,sourceBudget:62,numericRef:'web L7132,7137,7312,8452,8652; assumed F3'},
  H10:{kind:'hitapps',groups:10,total:64,foundations:4,columns:[4,5,6,7],stock:42,sourceBudget:123,numericRef:'web L7135,7163 etc; assumed F4, source range115–130'},
  H12:{kind:'hitapps',groups:12,total:82,foundations:4,columns:[5,6,7,8],stock:56,sourceBudget:168,numericRef:'web L476,7036,7156 etc; assumed F4, source range162–175'},
  H15a:{kind:'hitapps',groups:15,total:100,foundations:4,columns:[5,6,7,8],stock:74,sourceBudget:249,numericRef:'web L7131,7931; assumed F4; midpoint247/251'},
  H15b:{kind:'hitapps',groups:15,total:98,foundations:5,columns:[5,6,7,8,9],stock:63,sourceBudget:197,numericRef:'web L8651; assumed F5'}
};
const azur:Record<string,[number,number,number]>={A1:[3,3,3],A2:[3,4,3],A3:[4,4,4],A4:[5,5,5]};
assert(profile==='current'||Object.hasOwn(hitapps,profile)||Object.hasOwn(azur,profile),'unknown profile');
function shapeFor(i:number):Shape{
  if(hitapps[profile])return hitapps[profile];
  const [f,c,d]=azur[profile],groups=i<4?8:10,total=groups*6,columns=Array.from({length:c},(_,j)=>d+j);
  return {kind:'azur',groups,total,foundations:f,columns,stock:total-columns.reduce((a,b)=>a+b,0),numericRef:'AZUR exact static late shape; own group count and word population'};
}
function draft(shape:Shape,seed:number){
  const {cards,chosen}=population(shape.groups,shape.total,seed);
  const ids=Object.keys(cards);
  const r=rng(seed);
  const layout=shape.kind==='azur'?dealAzur(ids,shape.columns.length,shape.columns[0],(lo,hi)=>lo+r(hi-lo))
    :undefined;
  const ordinary=layout?undefined:dealOrdinary(ids,shape.stock,shape.columns,seed);
  const tableau=layout?.tableau??ordinary!.tableau;
  const stock=layout?layout.deckInput.slice().reverse():ordinary!.stock;
  assert.equal(stock.length,shape.stock);
  const d:Deal={id:'study5-'+profile+'-'+seed,version:1,campaignLevel:81,title:'Research control',difficultyTier:'normal',
    editorialStatus:'research-only',cards,winningPath:[],initial:{rulesVersion:4,tableau,faceUp:layout?.faceUp??tableau.flatMap(p=>p.slice(-1)),
      foundations:Array.from({length:shape.foundations},()=>[]),stock,waste:[],collected:[],movesLeft:450,phase:'playing',
      hitapps:{move:0,cards:Object.fromEntries(Object.values(cards).map(c=>[c.id,sourceCard(c.leader?Kind.category:Kind.word)])),spent:[],generatedGold:0}},
    hitapps:{policy:'hitapps-rules4-v1',assemblies:[]}};
  assertBoard(d.initial,d);
  return {deal:d,chosen};
}
function fixture(level:number){
  const base=campaignDeals[level-1],s=freshSave(base,'study5-select-'+level);
  platformState(s).completedCampaign=Array.from({length:level-1},(_,i)=>campaignId(i+1));
  s.difficultyPenalty=-5;
  return selectCampaignDeal(s,base);
}
function step(b:Board,a:BoardCommand,d:Deal){
  const t=applyBoard(b,a,d),o=advance(b,a,d);
  assert(typeof t!=='string','rejected selected command '+d.id);
  assert(isDeepStrictEqual(t.board,o),'oracle '+d.id);
  assertBoard(t.board,d);
  return t.board;
}
function replay(b:Board,path:readonly BoardCommand[],d:Deal){for(const a of path)b=step(b,a,d);return b;}
function cost(d:Deal){const last=replay(d.initial,d.winningPath,d);assert.equal(last.phase,'won',d.id);return d.initial.movesLeft!-last.movesLeft!;}
function variant(d:Deal,budget:number){return {...d,id:d.id+'-m'+budget,initial:{...structuredClone(d.initial),movesLeft:budget}};}
const hidden=(b:Board)=>b.tableau.flat().filter(id=>!b.faceUp.includes(id)).length;
const home=(b:Board)=>b.foundations.flat().length+b.collected.length;
const remaining=(b:Board)=>b.stock.length+b.waste.length+b.tableau.flat().length+b.foundations.flat().length;
function visible(b:Board,d:Deal){
  const up=new Set(b.faceUp);
  const special=Boolean(b.joker||d.lock||d.frozen||d.bound||Object.values(b.hitapps?.cards??{}).some(c=>c.lock||c.ice||c.bound));
  const columns=b.tableau.map(p=>p.map(id=>up.has(id)?id:'?').join(','));
  return JSON.stringify([special?columns:columns.sort(),b.foundations.map(p=>p.join(',')).sort(),b.stock.length,b.waste,b.collected.slice().sort(),
    b.recyclesLeft,b.joker,b.keys,Object.entries(b.hitapps?.cards??{}).filter(([id])=>up.has(id)).map(([id,c])=>[id,c.ice,c.bound,c.lock?.collected,c.gold?.health]),b.hitapps?.spent]);
}
type Policy='foundation'|'reveal';
function actionClass(a:BoardCommand){return a.type!=='transfer'?'stock':a.to.kind==='foundation'?'foundation':'tableau';}
function options(b:Board,d:Deal){
  const seen=new Set<string>();
  return legalCommands(b,d).flatMap(a=>{
    const t=applyBoard(b,a,d);if(typeof t==='string')return [];
    const key=visible(t.board,d);
    if(seen.has(key)||key===visible(b,d))return [];
    seen.add(key);
    return [{a,board:t.board,events:t.events,key}];
  });
}
function choose(b:Board,d:Deal,policy:Policy,seen:Set<string>,random:(n:number)=>number){
  const list=options(b,d).flatMap(o=>{
    if(seen.has(o.key))return [];
    const a=o.a,next=o.board,completed=next.collected.length-b.collected.length,progress=home(next)-home(b),reveal=hidden(b)-hidden(next),
      empty=next.tableau.filter(p=>!p.length).length-b.tableau.filter(p=>!p.length).length;
    const merge=a.type==='transfer'&&a.from.kind==='tableau'&&a.to.kind==='tableau'&&b.tableau[a.to.index].length>0&&empty>0;
    const special=o.events.filter(e=>['key','unlock','ice','cut','unbind','assemble'].includes(e.type)).length;
    const v=next.phase==='won'?1e6:completed*100+progress*(policy==='foundation'?35:8)+reveal*(policy==='reveal'?48:12)+special*18+empty*7+(merge?10:0)
      +(a.type==='draw'?4:a.type==='recycle'?1:a.type==='transfer'&&a.from.kind==='waste'?2:-5);
    return [{...o,v,tie:random(1000000)}];
  });
  list.sort((a,b)=>b.v-a.v||a.tie-b.tie);
  return list[0];
}
type Bot={policy:Policy;status:string;actions:number;left:number|null;firstCollect:number|null;draws:number;recycles:number;classes:Record<string,number>;board:Board};
function run(d:Deal,policy:Policy,seed:number):Bot{
  let b=structuredClone(d.initial),actions=0,draws=0,recycles=0,firstCollect:number|null=null;
  const seen=new Set<string>(),classes:Record<string,number>={},random=rng(seed+(policy==='foundation'?107:293));
  let status='bound';
  while(b.phase==='playing'&&actions<500){
    seen.add(visible(b,d));const pick=choose(b,d,policy,seen,random);
    if(!pick){status=legalCommands(b,d).length?'policy-stuck':'no-legal';break;}
    const a=pick.a,cl=actionClass(a);classes[cl]=(classes[cl]??0)+1;
    if(a.type==='draw')draws++;if(a.type==='recycle')recycles++;
    b=step(b,a,d);actions++;
    if(b.collected.length&&firstCollect===null)firstCollect=actions;
  }
  if(b.phase!=='playing')status=b.phase;
  return {policy,status,actions,left:b.movesLeft,firstCollect,draws,recycles,classes,board:b};
}
function probeChoices(d:Deal,seed:number){
  const result:Record<string,unknown>[]=[];
  const random=rng(seed+515);
  const indices=[...new Set([Math.floor(d.winningPath.length*.25),Math.floor(d.winningPath.length*.65)])];
  let board=d.initial,at=0;
  for(const prefix of indices){
    while(at<prefix){board=step(board,d.winningPath[at],d);at++;}
    const expected=d.winningPath[at];if(!expected||board.phase!=='playing')continue;
    const exact=step(board,expected,d),same=visible(exact,d);
    const candidates=options(board,d).filter(o=>o.key!==same);
    for(const kind of ['foundation','tableau','stock']){
      const pool=candidates.filter(o=>actionClass(o.a)===kind);
      if(!pool.length){result.push({prefix,kind,status:'NO_ALTERNATIVE',alternatives:0});continue;}
      const chosen=pool[random(pool.length)],next=step(board,chosen.a,d),t=performance.now();
      if(next.phase==='won'){result.push({prefix,kind,status:'SOLVED',alternatives:pool.length,proofCost:0,ms:0});continue;}
      const hint=resolveHintRoute(next,d,1500),ms=Math.round(performance.now()-t);
      let proofCost:null|number=null;
      if(hint.status==='SOLVED'){
        const last=replay(next,hint.path,d);assert.equal(last.phase,'won','alternative proof '+d.id);proofCost=(next.movesLeft??0)-(last.movesLeft??0);
      }
      result.push({prefix,kind,status:hint.status,alternatives:pool.length,proofCost,ms});
    }
  }
  return result;
}
function recovery(b:Board,d:Deal){
  assert.equal(b.phase,'exhausted');
  const n=remaining(b),adaptive=Math.max(5,Math.min(30,5*Math.ceil(.5*n/5)));
  const actual=findContinue({id:'study5-recovery',dealId:d.id,board:b},d,3000,performance.now()+1500);
  if(actual.status==='PROVEN_RECOVERABLE')assert.equal(replay({...b,movesLeft:10,phase:'playing'},actual.path,d).phase,'won');
  const amounts=[...new Set([10,20,adaptive])],probes=[];
  for(const moves of amounts){
    const board:Board={...structuredClone(b),movesLeft:moves,phase:'playing'};
    const t=performance.now(),h=resolveHintRoute(board,d,1500),ms=Math.round(performance.now()-t);
    let cost:null|number=null;
    if(h.status==='SOLVED'){const last=replay(board,h.path,d);assert.equal(last.phase,'won');cost=moves-(last.movesLeft??0);}
    probes.push({moves,status:h.status,cost,ms});
  }
  return {remaining:n,adaptive,actual:actual.status,probes};
}
type Row={profile:string;seed:number;level?:number;shape?:Shape;authoring:string;dealId?:string;topics?:string[];populationHash?:string;layoutHash?:string;searchMs?:number;visited?:number;cost?:number;sourceBudgetFits?:boolean;cards?:number;groups?:number;stock?:number;depths?:number[];foundations?:number;special?:boolean;publishedBudget?:number|null;
  controls?:{margin:string;budget:number;bots:Omit<Bot,'board'>[]}[];choices?:Record<string,unknown>[];recovery?:ReturnType<typeof recovery>};
const rows:Row[]=[],bank:{deal:Deal;shape?:Shape;seed:number;layoutHash:string;certificateCost:number}[]=[];
const levels=[...Array.from({length:10},(_,i)=>81+i),...Array.from({length:10},(_,i)=>121+i),...Array.from({length:10},(_,i)=>191+i)];
const samples=profile==='current'?levels.length:8;
const recoverySeen=new Set<string>();let recoveryCount=0;
for(let i=0;i<samples;i++){
  const seed=238501+i;
  let d:Deal,row:Row={profile,seed,authoring:'EXISTING'};
  if(profile==='current'){
    d=fixture(levels[i]);row.level=levels[i];row.publishedBudget=d.initial.movesLeft;
    assert(d.initial.movesLeft!==null);
  }else{
    const shape=shapeFor(i);row.shape=shape;
    const fresh=draft(shape,seed);d=fresh.deal;row.topics=fresh.chosen.map(x=>x.id);
    const t=performance.now(),s=findReferenceRoute(d,d.initial,8000,true,performance.now()+8000,'verified-specials');
    row.searchMs=Math.round(performance.now()-t);row.visited=s.visited;
    if(s.status!=='FOUND'){row.authoring=s.status;rows.push(row);console.log('STUDY238_INDEPENDENT_ROW '+JSON.stringify(row));continue;}
    d.winningPath=s.path;row.authoring='CERTIFIED';
  }
  const c=cost(d);row.cost=c;row.dealId=d.id;
  row.cards=d.initial.tableau.flat().length+d.initial.stock.length;
  row.groups=Object.values(d.cards).filter(c=>c.leader).length;
  row.stock=d.initial.stock.length;row.depths=d.initial.tableau.map(p=>p.length);row.foundations=d.initial.foundations.length;
  row.special=Boolean(d.lock||d.frozen||d.bound||d.puzzle||d.starter||d.golden||d.hitapps?.assemblies.length||
    d.hitapps?.gold||Object.values(d.initial.hitapps?.cards??{}).some(c=>c.order||c.lock||c.key||c.ice||c.bound||c.scissors||c.kind>1));
  row.populationHash=hash(Object.values(d.cards).map(c=>[c.category,c.text,c.leader]));
  row.layoutHash=hash([d.initial.tableau,d.initial.stock,d.initial.foundations,d.initial.faceUp,d.initial.hitapps]);
  if(row.shape?.sourceBudget!==undefined)row.sourceBudgetFits=c<=row.shape.sourceBudget;
  const budgets=[{margin:'15',budget:c+Math.max(12,Math.ceil(.15*c))},{margin:'25',budget:c+Math.max(18,Math.ceil(.25*c))}];
  if(profile==='current')budgets.unshift({margin:'published',budget:d.initial.movesLeft!});
  row.controls=[];
  let recoveryCandidate:Board|undefined;
  for(const entry of budgets){
    const copy=variant(d,entry.budget);assert.equal(cost(copy),c);
    const bots=(['foundation','reveal'] as const).map(p=>run(copy,p,seed));
    if(entry.margin==='25'){
      row.choices=probeChoices(copy,seed);
      recoveryCandidate=bots.find(b=>b.status==='exhausted')?.board;
      if(recoveryCandidate&&recoveryCount<4){
        const key=hash([row.layoutHash,recoveryCandidate]);
        if(!recoverySeen.has(key)){recoverySeen.add(key);recoveryCount++;row.recovery=recovery(recoveryCandidate,copy);}
      }
      if(profile!=='current')bank.push({deal:copy,shape:row.shape,seed,layoutHash:row.layoutHash,certificateCost:c});
    }
    row.controls.push({...entry,bots:bots.map(({board,...b})=>b)});
  }
  rows.push(row);writeFileSync(out+'/rows.json',JSON.stringify(rows,null,2));
  writeFileSync(out+'/research-bank.json',JSON.stringify(bank));
  console.log('STUDY238_INDEPENDENT_ROW '+JSON.stringify(row));
}
const valid=rows.filter(r=>r.cost!==undefined),choices=valid.flatMap(r=>r.choices??[]);
const controlSummary=['published','15','25'].flatMap(margin=>
  (['foundation','reveal'] as const).map(policy=>{
    const bots=valid.flatMap(r=>r.controls?.filter(c=>c.margin===margin).flatMap(c=>c.bots.filter(b=>b.policy===policy))??[]);
    return {margin,policy,n:bots.length,wins:bots.filter(b=>b.status==='won').length,exhausted:bots.filter(b=>b.status==='exhausted').length,
      stuck:bots.filter(b=>b.status==='policy-stuck'||b.status==='no-legal').length,actions:bots.reduce((a,b)=>a+b.actions,0)};
  }).filter(x=>x.n));
const summary={head,profile,samples,certified:valid.length,authoring:rows.map(r=>({seed:r.seed,status:r.authoring,groups:r.groups,cost:r.cost,sourceBudgetFits:r.sourceBudgetFits,ms:r.searchMs})),
  distinctLayouts:new Set(valid.map(r=>r.layoutHash)).size,distinctPopulations:new Set(valid.map(r=>r.populationHash)).size,
  sourceBudgetFits:valid.filter(r=>r.sourceBudgetFits).length,sourceBudgetCompared:valid.filter(r=>r.sourceBudgetFits!==undefined).length,
  controls:controlSummary,choices:['foundation','tableau','stock'].map(kind=>({kind,probes:choices.filter(c=>c.kind===kind&&c.status!=='NO_ALTERNATIVE').length,
    solved:choices.filter(c=>c.kind===kind&&c.status==='SOLVED').length,noAlternative:choices.filter(c=>c.kind===kind&&c.status==='NO_ALTERNATIVE').length})),
  recovery:valid.filter(r=>r.recovery).map(r=>({seed:r.seed,...r.recovery})),seconds:Math.round((performance.now()-start)/1000)};
writeFileSync(out+'/rows.json',JSON.stringify(rows,null,2));
writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));
console.log('STUDY238_INDEPENDENT_SUMMARY '+JSON.stringify(summary));
