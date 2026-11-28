/**
 * #238 pilot5: independent ordinary-layout authoring, decision diversity and recovery.
 * Own word bank, exact source numeric profiles where available, no product issuance.
 */
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
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
import { platformState, buyContinue } from '../../src/domain/services';
import { findContinue, verifiesContinue } from '../../src/domain/continuation';
import { knownContinuation, continuationLookup } from '../../src/domain/solver';
import { recordSourceContinue } from '../../src/domain/difficulty';
import { BALANCE } from '../../src/domain/balance';
import type { Board, BoardCommand, Card, Deal } from '../../src/domain/types';

assert(E4_M1 && releaseProfile?.id==='c8-release-v1');
const profile=process.argv[2]??'current', start=performance.now();
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const out='.recording/study238-recovery';
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

/** Reconstruct exactly the policy trajectories from pilot5's authenticated CI artifact.
 * Baseline and candidate use the same actual worker limits. No proof changes product code.
 */
const sourceDir='.recording/pilot5';
const shapes=['current','H6','H10','H12','H15a','H15b','A1','A2','A3','A4'];
const results:Record<string,unknown>[]=[];
const seenStates=new Set<string>();
type Prior={seed:number;level?:number;dealId?:string;layoutHash?:string;cost?:number;controls?:{margin:string;budget:number;bots:{policy:Policy;status:string;actions:number}[]}[];recovery?:{remaining:number;actual:string}};
type BankEntry={deal:Deal;seed:number;layoutHash:string;certificateCost:number};
function directed(attempt:{id:string;dealId:string;board:Board},deal:Deal,deadline:number){
  const initial:Board={...attempt.board,movesLeft:BALANCE.continueMoves,phase:'playing'};
  const known=knownContinuation(initial,deal);
  if(known&&verifiesContinue(attempt,{attemptId:attempt.id,deal,path:known}))
    return {status:'PROVEN_RECOVERABLE' as const,path:known,visited:0};
  const proposed=findReferenceRoute(deal,initial,3000,true,deadline,'verified-specials',continuationLookup(initial,deal,deadline));
  if(proposed.status==='FOUND'&&verifiesContinue(attempt,{attemptId:attempt.id,deal,path:proposed.path}))
    return {status:'PROVEN_RECOVERABLE' as const,path:proposed.path,visited:proposed.visited};
  return {status:'UNKNOWN' as const,visited:proposed.visited};
}
function checkedPurchase(d:Deal,b:Board,path:BoardCommand[]){
  const s=freshSave(d,'study6-continue');
  s.profile.coins=BALANCE.continueCoinPrice;s.attempt.board=structuredClone(b);
  const proof={attemptId:s.attempt.id,deal:d,path};
  assert(verifiesContinue(s.attempt,proof),'proof verifier');
  recordSourceContinue(s,d);
  assert(buyContinue(s,proof),'actual purchase');
  assert.equal(s.profile.coins,0);assert.equal(s.attempt.board.movesLeft,BALANCE.continueMoves);
  const won=replay(s.attempt.board,path,d);
  assert.equal(won.phase,'won');
  // Same proof cannot spend a second purchase; no changes from refused purchase.
  const before=JSON.stringify(s);assert.equal(buyContinue(s,proof),false);assert.equal(JSON.stringify(s),before);
  return BALANCE.continueMoves-won.movesLeft!;
}
for(const shape of shapes){
  const dir=sourceDir+'/study-238-independent-'+shape;
  const previous=JSON.parse(readFileSync(dir+'/rows.json','utf8')) as Prior[];
  const bank=JSON.parse(readFileSync(dir+'/research-bank.json','utf8')) as BankEntry[];
  let count=0;
  // First reproduce all exact prior recovery cases, then extend to other genuine losses.
  const valid=previous.filter(row=>row.cost!==undefined).sort((a,b)=>Number(Boolean(b.recovery))-Number(Boolean(a.recovery)));
  for(const row of valid){
    const d=shape==='current'?fixture(row.level!):bank.find(entry=>entry.seed===row.seed)!.deal;
    assert(d&&hash([d.initial.tableau,d.initial.stock,d.initial.foundations,d.initial.faceUp,d.initial.hitapps])===row.layoutHash,'pilot5 exact board '+shape+'/'+row.seed);
    const original={...d,id:row.dealId!};
    const ctrls=row.controls!.slice().sort((a,b)=>Number(b.margin==='25')-Number(a.margin==='25'));
    for(const ctrl of ctrls){
      const deal=variant(original,ctrl.budget);
      for(const priorBot of ctrl.bots){
        if(priorBot.status!=='exhausted')continue;
        const bot=run(deal,priorBot.policy,row.seed);
        assert.equal(bot.status,priorBot.status,'reconstruct prior phase');
        assert.equal(bot.actions,priorBot.actions,'reconstruct prior trajectory');
        const key=hash([row.layoutHash,bot.board]);
        if(seenStates.has(key))continue;
        seenStates.add(key);
        const exact=Boolean(row.recovery&&ctrl.margin==='25'&&priorBot===ctrl.bots.find(x=>x.status==='exhausted'));
        if(exact)assert.equal(remaining(bot.board),row.recovery!.remaining,'pilot5 exact recovery position');
        const attempt={id:'study6-continue',dealId:deal.id,board:bot.board};
        const t0=performance.now(),baseline=findContinue(attempt,deal,3000,t0+1400),ms0=Math.round(performance.now()-t0);
        const t1=performance.now(),candidate=directed(attempt,deal,t1+1400),ms1=Math.round(performance.now()-t1);
        let baselineCost:null|number=null,candidateCost:null|number=null;
        if(baseline.status==='PROVEN_RECOVERABLE')baselineCost=checkedPurchase(deal,bot.board,baseline.path);
        if(candidate.status==='PROVEN_RECOVERABLE')candidateCost=checkedPurchase(deal,bot.board,candidate.path);
        const result={shape,seed:row.seed,margin:ctrl.margin,policy:priorBot.policy,exactPilot5:exact,dealId:deal.id,boardHash:key,
          remaining:remaining(bot.board),baseline:baseline.status,baselineMs:ms0,baselineCost,candidate:candidate.status,candidateMs:ms1,candidateCost,
          candidateVisited:candidate.visited,baselinePath:baseline.status==='PROVEN_RECOVERABLE'?baseline.path:undefined,
          candidatePath:candidate.status==='PROVEN_RECOVERABLE'?candidate.path:undefined};
        results.push(result);count++;
        writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
        console.log('STUDY238_RECOVERY_ROW '+JSON.stringify(result));
        if(count>=8)break;
      }if(count>=8)break;
    }if(count>=8)break;
  }
}
const aggregate=(rows:Record<string,unknown>[])=>({n:rows.length,baseline:rows.filter(x=>x.baseline==='PROVEN_RECOVERABLE').length,
  directed:rows.filter(x=>x.candidate==='PROVEN_RECOVERABLE').length,added:rows.filter(x=>x.baseline!=='PROVEN_RECOVERABLE'&&x.candidate==='PROVEN_RECOVERABLE').length,
  lost:rows.filter(x=>x.baseline==='PROVEN_RECOVERABLE'&&x.candidate!=='PROVEN_RECOVERABLE').length,
  baselineMax:Math.max(0,...rows.map(x=>Number(x.baselineMs))),directedMax:Math.max(0,...rows.map(x=>Number(x.candidateMs)))});
const summary={head,sourceRun:46132719274,limits:{nodes:3000,ms:1400,moves:BALANCE.continueMoves},all:aggregate(results),exact:aggregate(results.filter(r=>r.exactPilot5)),seconds:Math.round((performance.now()-start)/1000)};
writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));console.log('STUDY238_RECOVERY_SUMMARY '+JSON.stringify(summary));
