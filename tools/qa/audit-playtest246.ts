import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { campaignPlaytest, playtestReserve } from '../../src/config/campaign-playtest';
import { campaignDeals, campaignIssuance, findDeal, selectCampaignDeal } from '../../src/content/campaign';
import { playtestCore, playtestKey, playtestSet } from '../../src/content/campaign-playtest';
import { extendedRecords } from '../../src/content/campaign-meta-bank';
import { freshSave, boardKey, legalCommands } from '../../src/domain/engine';
import { selectCampaignCore } from '../../src/content/campaign-core-stage1';
import { campaignId } from '../../src/domain/progression';
import { decodeSave } from '../../src/platform/storage';
import { authoringHash } from '../content/hitapps-authoring';
import { certifySourceRoute } from '../content/hitapps-source-pipeline';
import { resolveHintRoute } from '../../src/domain/hint';
import { dailyForDay } from '../../src/content/daily';
import { hitappsGoals } from '../../src/domain/hitapps-board';
import { cardArtwork } from '../../src/game/art';
import { featuresFor } from '../content/hitapps-feature-recipes';
import { prepareSourceInput,sourceCardOrder } from '../content/hitapps-source-authoring';
import type { RecipeFeature } from '../../src/content/campaign-meta-recipes';
import { replayIndependent, independentStep, runIndependent } from './playtest246-policy';
import type { Board, Deal } from '../../src/domain/types';

const start=performance.now(), profile=campaignPlaytest??'current', rows:Record<string,unknown>[]=[], scenarios:unknown[]=[], deviations:unknown[]=[];
const layouts=new Map<string,number>(), features=new Set<string>(), topics=new Set<string>(), images=new Set<string>();
let certificates=0;
function context(level:number){const save=freshSave(campaignDeals[level-1],'246-audit');
  save.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,
    completedCampaign:Array.from({length:level-1},(_,i)=>campaignId(i+1))};return save;}
for(let level=81;level<=101;level++){
  for(const reserve of campaignPlaytest?[15,25] as const:[25] as const){
    const data=campaignPlaytest&&playtestSet(playtestKey(level,campaignPlaytest));
    const bank=campaignPlaytest?playtestCore(level,campaignPlaytest,reserve):undefined;
    const records=data?data.controls[String(reserve) as '15'|'25']:extendedRecords(level);
    assert.equal(records.length,3);
    for(const row of records){
      const id=row.deal.id+'-core-stage1-v1-m1',deal=findDeal(id)!;
      assert(deal&&deal.initial.rulesVersion===4,id);
      assert.equal(authoringHash([deal.initial,deal.cards,deal.hitapps]),row.boardHash);
      const proof=certifySourceRoute(deal,deal.winningPath)!;assert(proof);certificates++;
      if(data){
        const dealer=data.recipe.source.startsWith('AZUR')?'azur-exclusive-fy-v1' as const:undefined;
        const features=featuresFor(data.template,{feature:data.recipe.feature as RecipeFeature|undefined,budget:450},row.seed,dealer);
        assert(features);
        const prepared=prepareSourceInput(data.template,{version:'hitapps-input-v2',layout:'random',stable:true,levelPenalty:0,
          cardOrder:sourceCardOrder(data.template),features,...(dealer&&{dealer})},450);
        const generated=prepared.prepare(row.seed,'None',()=>{throw Error('Recorded seed');}).finish().deal;
        assert.equal(prepared.sourceHash,row.sourceHash);
        assert.equal(authoringHash([{...generated.initial,movesLeft:deal.initial.movesLeft},generated.cards,generated.hitapps]),row.boardHash,
          'recovered generator seed replay '+id);
      }
      assert.equal(proof.cost,row.cost);assert.equal(proof.traceHash,row.traceHash);assert.equal(proof.routeHash,row.routeHash);
      for(const penalty of [-5,10]){
        const variant=findDeal(row.deal.id+`-budget-${penalty<0?'m':'p'}${Math.abs(penalty)}-core-stage1-v1-m1`)!;
        assert(variant&&certifySourceRoute(variant,variant.winningPath));certificates++;
        assert.equal(authoringHash([variant.initial,variant.cards,variant.hitapps]),row.budgets![String(penalty)].hash);
      }
      const semantic=Object.values(deal.cards).filter(c=>c.leader).map(c=>c.category);
      semantic.forEach(c=>topics.add(c));Object.values(deal.cards).forEach(c=>{const art=cardArtwork(c,deal);if(art)images.add(art);});
      const native=Object.values(deal.initial.hitapps!.cards);
      for(const [name,on]of Object.entries({ordered:native.some(c=>c.order),ice:native.some(c=>c.ice),lock:native.some(c=>c.lock),
        bound:native.some(c=>c.bound),puzzle:Boolean(deal.hitapps?.assemblies.length),magnet:native.some(c=>c.kind===5),
        hammer:native.some(c=>c.kind===6),gold:Boolean(deal.hitapps?.gold)}))if(on)features.add(name);
      const geometry=authoringHash([deal.initial.tableau.map(p=>p.map(id=>deal.cards[id].text)),deal.initial.stock.map(id=>deal.cards[id].text)]);
      assert(!layouts.has(geometry)||layouts.get(geometry)===level,'layout reused at another level');layouts.set(geometry,level);
      let b=deal.initial,firstCollect:number|null=null,step=0;const classes:Record<string,number>={};
      for(const action of deal.winningPath){b=independentStep(b,action,deal).board;step++;if(firstCollect===null&&b.collected.length)firstCollect=step;
        const cls=action.type==='transfer'?action.to.kind:action.type;classes[cls]=(classes[cls]??0)+1;}
      rows.push({level,reserve,id,seed:row.seed,cost:proof.cost,budget:deal.initial.movesLeft,remaining:proof.reserve,
        geometry,routeHash:proof.routeHash,traceHash:proof.traceHash,physical:deal.initial.tableau.flat().length+deal.initial.stock.length,
        semanticGoals:hitappsGoals(deal).length,
        topics:semantic,images:Object.values(deal.cards).filter(c=>cardArtwork(c,deal)).length,
        imageMetadata:Object.values(deal.cards).filter(c=>c.image).length,feature:data?.recipe.feature??null,
        columns:deal.initial.tableau.map(p=>p.length),slots:deal.initial.foundations.length,firstCollect,classes});
      const saved=context(level);saved.attempt=freshSave(deal,'retained').attempt;
      assert.deepEqual(decodeSave(JSON.stringify(saved),findDeal).attempt.board,deal.initial);
    }
    const save=context(level),base=campaignDeals[level-1];
    const selected=bank?selectCampaignCore(bank,save,base,undefined,undefined):selectCampaignDeal(save,base);
    if(reserve===playtestReserve){
      assert.equal(selectCampaignDeal(save,base).id,selected.id,'actual selector');
      save.attempt=freshSave(selected,'issued').attempt;save.attempt.issuance=campaignIssuance(save,base,selected);
      assert.deepEqual(decodeSave(JSON.stringify(save),findDeal).attempt,save.attempt);
      let at=selected.initial;const prefix=Math.floor(selected.winningPath.length*.45);
      at=replayIndependent(at,selected.winningPath.slice(0,prefix),selected);
      const expected=selected.winningPath[prefix],target=expected&&independentStep(at,expected,selected).board;
      const alternative=legalCommands(at,selected).find(a=>target&&boardKey(independentStep(at,a,selected).board)!==boardKey(target));
      if(alternative){
        const board=independentStep(at,alternative,selected).board,t=performance.now(),result=resolveHintRoute(board,selected);
        let cost:number|null=null;
        if(result.status==='SOLVED'){const end=replayIndependent(board,result.path,selected);assert.equal(end.phase,'won');cost=board.movesLeft!-end.movesLeft!;}
        deviations.push({level,id:selected.id,prefix,alternative,status:result.status,cost,remaining:board.movesLeft,ms:Math.round(performance.now()-t)});
      }else deviations.push({level,id:selected.id,status:'NO_DISTINCT_ALTERNATIVE'});
    }
    for(const policy of ['foundation','reveal'] as const){
      const {board,stateHash,...result}=runIndependent(selected,policy);
      scenarios.push({level,reserve,id:selected.id,...result});
    }
  }
  console.log('PLAYTEST246_LEVEL '+JSON.stringify({profile,level,certificates}));
}
// A combined, fixed player exposure trace. Separate mode gaps are not semantic parity.
const exposure:unknown[]=[];const last=new Map<string,number>(),lastWords=new Map<string,number>();let topicGap=Infinity,wordGap=Infinity;
for(let index=0;index<21;index++){
  const level=81+index,save=context(level),deal=selectCampaignDeal(save,campaignDeals[level-1]);
  const day=new Date(Date.UTC(2026,10,28+index)).toISOString().slice(0,10);
  for(const [mode,d]of [['campaign',deal],['daily',dailyForDay(day)]]as const){
    const n=index*2+Number(mode==='daily');
    const normalize=(s:string)=>s.normalize('NFC').toLocaleLowerCase('ru').replaceAll('ё','е').trim();
    const labels=new Set<string>();
    for(const card of Object.values(d.cards)){
      const key=normalize(card.text);labels.add(key);
      if(card.leader){if(last.has(card.category))topicGap=Math.min(topicGap,n-last.get(card.category)!);last.set(card.category,n);}
    }
    for(const key of labels){if(lastWords.has(key))wordGap=Math.min(wordGap,n-lastWords.get(key)!);lastWords.set(key,n);}
    exposure.push({mode,level,day,topics:Object.values(d.cards).filter(c=>c.leader).map(c=>c.category)});
  }
}
const result={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),profile,
  certificateCount:certificates,uniqueLayouts:layouts.size,topics:topics.size,images:images.size,features:[...features],
  combinedExposure:{episodes:42,topicIdGap:Number.isFinite(topicGap)?topicGap:null,normalizedLabelGap:Number.isFinite(wordGap)?wordGap:null,
    semanticAmbiguity:'HUMAN_REVIEW_REQUIRED',trace:exposure},
  limits:{authoringNodes:2400,authoringMs:850,seedsPerSet:32,admission:'3 exact certified layouts, -5/0/+10; fail closed'},
  ms:Math.round(performance.now()-start),rss:process.memoryUsage().rss,rows,scenarios,deviations};
assert.equal(certificates,campaignPlaytest?378:189);
if(campaignPlaytest)assert.equal(features.size,8);
mkdirSync('.recording/issue246',{recursive:true});writeFileSync(`.recording/issue246/generation-${profile}.json`,JSON.stringify(result,null,2)+'\n');
console.log('PLAYTEST246_GENERATION '+JSON.stringify({...result,rows:undefined,scenarios:undefined,deviations:undefined,combinedExposure:{...result.combinedExposure,trace:undefined}}));
