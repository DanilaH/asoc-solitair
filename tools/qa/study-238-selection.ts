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
import { dealOrdinary, sourceWithinTolerance } from '../content/plain-dealer';
import { campaignId } from '../../src/domain/progression';
import { platformState } from '../../src/domain/services';
import { findContinue } from '../../src/domain/continuation';
import { runSourceBot } from '../content/hitapps-source-bot';
import { adjustedMoveBudget } from '../../src/domain/difficulty';
import type { Board, BoardCommand, Card, Deal } from '../../src/domain/types';

assert(E4_M1 && releaseProfile?.id==='c8-release-v1');
const profile=process.argv[2]??'current', start=performance.now();
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const out='.recording/study238-selection';
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
function draft(shape:Shape,seed:number,populationSeed=seed){
  const {cards,chosen}=population(shape.groups,shape.total,populationSeed);
  const values=Object.values(cards);
  const ids=values.filter(card=>card.leader).flatMap(leader=>[leader.id,...values.filter(card=>!card.leader&&card.category===leader.category).map(card=>card.id)]);
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

/**
 * Finite seed selection with own populations fixed within each candidate set.
 * Source Priority is the existing own-model reconstruction; product-proof selection
 * is separately labeled. No intentional losses or paid/ad targeting.
 */
assert(profile!=='current');
const rows:Record<string,unknown>[]=[];
const bank:{deal:Deal;shape:Shape;populationSeed:number;seed:number;policy:string;cost:number;layoutHash:string}[]=[];
const sets=4, cap=hitapps[profile]?12:4;
function certificate(d:Deal,path:BoardCommand[]){
  const b=replay(d.initial,path,d);
  assert.equal(b.phase,'won');
  return {cost:d.initial.movesLeft!-b.movesLeft!,path,routeHash:hash(path)};
}
type Trial={seed:number;sourceStatus?:string;sourceCost?:number;directedStatus:string;directedCost?:number;cost?:number;searchMs:number;
  sourceFit:boolean;penaltyFit:boolean;reserve15Fit:boolean;reserve25Fit:boolean;layoutHash:string;path?:BoardCommand[];deal:Deal};
for(let pop=0;pop<sets;pop++){
  // New independent own populations; AZUR's matched G8/G10 populations are paired by shape.
  const populationSeed=238601+pop,shape=shapeFor(pop<2?0:5),budget=shape.sourceBudget??450;
  const target=shape.sourceBudget===undefined?undefined:budget-Math.max(12,Math.ceil(budget*.12));
  const trials:Trial[]=[];
  for(let n=0;n<cap;n++){
    const seed=2386100+pop*100+n;
    const {deal:raw}=draft(shape,seed,populationSeed);
    const d=variant(raw,budget);
    const source=shape.kind==='hitapps'?runSourceBot(d,'Priority'):undefined;
    const certSource=source?.status==='WON'?certificate(d,source.path):undefined;
    const t=performance.now(),proposal=findReferenceRoute(d,d.initial,2600,true,t+1600,'verified-specials');
    const searchMs=Math.round(performance.now()-t);
    const certSearch=proposal.status==='FOUND'?certificate(d,proposal.path):undefined;
    const proofs=[certSource,certSearch].flatMap(x=>x?[x]:[]).sort((a,b)=>a.cost-b.cost);
    const best=proofs[0],cost=best?.cost;
    const fits=(fraction:number,floor:number)=>cost!==undefined&&cost+Math.max(floor,Math.ceil(cost*fraction))<=budget;
    const layoutHash=hash([d.initial.tableau,d.initial.stock,d.initial.foundations,d.initial.faceUp,d.initial.hitapps]);
    trials.push({seed,sourceStatus:source?.status,sourceCost:certSource?.cost,directedStatus:proposal.status,directedCost:certSearch?.cost,
      cost,searchMs,sourceFit:cost!==undefined,penaltyFit:cost!==undefined&&cost+1<=adjustedMoveBudget(budget,-5,true),
      reserve15Fit:fits(.15,12),reserve25Fit:fits(.25,18),layoutHash,path:best?.path,deal:d});
  }
  const first=trials[0],sourceWins=trials.filter(x=>x.sourceCost!==undefined);
  const priority=target===undefined?undefined:sourceWins.find(x=>sourceWithinTolerance(target,x.sourceCost!,true,10))??
    [...sourceWins].sort((a,b)=>Math.abs(a.sourceCost!-target!)-Math.abs(b.sourceCost!-target!))[0];
  const eligible=trials.filter(x=>x.reserve15Fit&&x.penaltyFit);
  // Closest to stated target among certified reserved candidates, never choose because a bot loses.
  const selected=shape.kind==='azur'?trials.find(x=>x.cost!==undefined)
    :[...eligible].sort((a,b)=>Math.abs(a.cost!-target!)-Math.abs(b.cost!-target!))[0];
  const rawSelected=trials.find(x=>x.cost!==undefined);
  const chosen=selected??rawSelected;
  let selectedEvidence:Record<string,unknown>|undefined;
  if(chosen){
    const c=chosen.cost!,moves=shape.kind==='azur'?c+Math.max(18,Math.ceil(.25*c)):budget;
    const d={...variant(chosen.deal,moves),winningPath:chosen.path!};
    assert.equal(cost(d),c);
    const bots=(['foundation','reveal'] as const).map(policy=>run(d,policy,chosen.seed));
    selectedEvidence={seed:chosen.seed,cost:c,budget:moves,spare:moves-c,qualifies:!!selected,
      policies:bots.map(({board,...rest})=>rest)};
    bank.push({deal:d,shape,populationSeed,seed:chosen.seed,policy:selected?(shape.kind==='azur'?'first-certificate-reserve25':'closest-proof-reserve15'):'certificate-only-no-target-reserve',
      cost:c,layoutHash:chosen.layoutHash});
  }
  const row={profile,populationSeed,shape,cap,budget,target,sourceTolerance:target===undefined?undefined:10,
    firstSeedProof:first.sourceFit,firstSeedReserve15:first.reserve15Fit,
    anyProof:trials.some(x=>x.sourceFit),anyReserve15:eligible.length>0,anyReserve25:trials.some(x=>x.reserve25Fit&&x.penaltyFit),
    sourceBotWins:sourceWins.length,priority:priority?{seed:priority.seed,sourceCost:priority.sourceCost,within:sourceWithinTolerance(target!,priority.sourceCost!,true,10),
      reserve15:priority.sourceCost!+Math.max(12,Math.ceil(priority.sourceCost!*.15))<=budget}:undefined,
    selected:selectedEvidence,trials:trials.map(({deal,path,...r})=>r)};
  rows.push(row);writeFileSync(out+'/rows.json',JSON.stringify(rows,null,2));writeFileSync(out+'/research-bank.json',JSON.stringify(bank));
  console.log('STUDY238_SELECTION_ROW '+JSON.stringify(row));
}
const summary={head,profile,sets,cap,candidates:sets*cap,firstSeedProof:rows.filter(x=>x.firstSeedProof).length,
  anyProof:rows.filter(x=>x.anyProof).length,firstSeedReserve15:rows.filter(x=>x.firstSeedReserve15).length,
  anyReserve15:rows.filter(x=>x.anyReserve15).length,anyReserve25:rows.filter(x=>x.anyReserve25).length,
  sourcePrioritySets:rows.filter(x=>x.priority).length,selected:bank.length,
  selectedQualified:rows.filter(x=>(x.selected as {qualifies?:boolean}|undefined)?.qualifies).length,
  seconds:Math.round((performance.now()-start)/1000)};
writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));console.log('STUDY238_SELECTION_SUMMARY '+JSON.stringify(summary));
