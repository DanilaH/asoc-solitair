import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { hitappsR4Difficulty } from '../../src/config/hitapps-r4';
import { adjustedMoveBudget } from '../../src/domain/difficulty';
import { applyBoard, assertBoard } from '../../src/domain/engine';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { Kind, sourceCard } from '../../src/domain/hitapps-rules';
import type { Deal } from '../../src/domain/types';
import { authoringHash } from './hitapps-authoring';
import { featuresFor } from './hitapps-feature-recipes';
import { authorSourceCandidate, certifySourceRoute } from './hitapps-source-pipeline';
import { sourceCardOrder } from './hitapps-source-authoring';
import { runSourceBot } from './hitapps-source-bot';
import { unpackMetaDeal, type PackedMetaDeal } from '../../src/content/campaign-meta-pack';
import { PLAYTEST246, playtestRecipes, playtestTemplate } from './playtest246-recipes';

const start=performance.now(), output='.authoring/playtest246';
mkdirSync(output,{recursive:true});
const noRandom=()=>{throw Error('Recorded seed required');};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const selectedKeys=process.argv.slice(2), recipes=playtestRecipes().filter(r=>!selectedKeys.length||selectedKeys.includes(r.key));
const bank:Record<string,unknown>={}, manifest:unknown[]=[];
for(const recipe of recipes){
  const before=performance.now(), template=playtestTemplate(recipe), trials:Record<string,unknown>[]=[], selected:{deal:Deal;seed:number;receipt:unknown;sourceHash:string}[]=[];
  const geometries=new Set<string>();
  for(let offset=1;offset<=32&&selected.length<3;offset++){
    const seed=recipe.level*10000+24600+offset, features=featuresFor(template,{feature:recipe.feature,budget:450},seed,
      recipe.dealer==='azur-exclusive-fy-v1'?recipe.dealer:undefined);
    if(!features){trials.push({seed,status:'PATTERN_INPUT_UNKNOWN'});continue;}
    const deadline=performance.now()+850;
    const result=authorSourceCandidate(template,{
      input:{version:'hitapps-input-v2',layout:'random',stable:true,levelPenalty:0,cardOrder:sourceCardOrder(template),features,
        ...(recipe.dealer==='azur-exclusive-fy-v1'?{dealer:recipe.dealer}:{})},
      difficulty:hitappsR4Difficulty,historyPenalty:0,previousLosses:0,strategy:{name:'None'},seeds:[seed],drawSeed:noRandom,
      findWitness(candidate){
        // Priority is one proposal strategy; final board + independent oracle certify it.
        const bot=runSourceBot(candidate,'Priority');
        return bot.status==='WON'?bot.path:findReferenceRoute(candidate,candidate.initial,2400,true,deadline,'verified-specials').path;
      },
    });
    if(result.status!=='CERTIFIED'){trials.push({seed,status:result.status,phases:result.trials.map(t=>t.reason)});continue;}
    const {deal,manifest:{receipt,proof}}=result;
    if(receipt.failedMask){trials.push({seed,status:'FEATURE_PATTERN_REJECTED',mask:receipt.failedMask});continue;}
    const layoutHash=hash([deal.initial.tableau,deal.initial.stock,deal.initial.faceUp]);
    if(geometries.has(layoutHash)){trials.push({seed,status:'DUPLICATE_LAYOUT'});continue;}
    // Confirm an actual reachable effect rather than metadata alone.
    let board=deal.initial;const effects:Record<string,number>={};
    for(const action of deal.winningPath){const step=applyBoard(board,action,deal);assert(typeof step!=='string');
      for(const e of step.events){effects[e.type]=(effects[e.type]??0)+1;if(e.cause)effects[e.cause]=(effects[e.cause]??0)+1;if(e.reason)effects[e.type+':'+e.reason]=(effects[e.type+':'+e.reason]??0)+1;}
      if(action.type==='transfer'&&step.events.some(e=>e.cards?.some(id=>(board.hitapps?.cards[id]?.order??0)>0)))effects.ordered=(effects.ordered??0)+1;
      board=step.board;}
    const required=recipe.feature==='lock'?'unlock':recipe.feature==='puzzle'?'assemble':recipe.feature==='bound'?'cut':recipe.feature==='gold'?'gold:activated':recipe.feature;
    const starterSpecial=(recipe.feature==='magnet'||recipe.feature==='hammer')&&Boolean(effects['ice:booster-break']||effects['cut:booster']);
    if(required&&!effects[required]&&!starterSpecial){trials.push({seed,status:'NO_REACHABLE_FEATURE_EFFECT',feature:recipe.feature,effects});continue;}
    geometries.add(layoutHash);selected.push({deal,seed,receipt,sourceHash:receipt.sourceHash});
    trials.push({seed,status:'CERTIFIED',layoutHash,cost:proof.cost,routeHash:proof.routeHash,effects});
  }
  const row={key:recipe.key,source:recipe.source,recipe:{...recipe,cards:undefined},attempts:trials,selected:selected.length,ms:Math.round(performance.now()-before)};
  manifest.push(row);writeFileSync(output+'/admission.json',JSON.stringify(manifest,null,2));
  if(selected.length!==3)throw Error(`Admission blocked ${recipe.key}: ${selected.length}/3; all failures in ${output}/admission.json`);
  const controls:Record<string,PackedMetaDeal[]>={};
  for(const reserve of [15,25]){
    const costs=selected.map(s=>certifySourceRoute(s.deal,s.deal.winningPath)!.cost);
    const worst=Math.max(...costs), budget=worst+Math.max(reserve===15?12:18,Math.ceil(worst*reserve/100));
    controls[String(reserve)]=selected.map(entry=>{
      const deal={...entry.deal,id:entry.deal.id+`-pt246-r${reserve}`,initial:{...entry.deal.initial,movesLeft:budget}};
      const proof=certifySourceRoute(deal,deal.winningPath)!;assert(proof);
      const budgets=Object.fromEntries([-5,10].map(penalty=>{
        const moves=adjustedMoveBudget(budget,penalty,true), variant={...deal,initial:{...deal.initial,movesLeft:moves}};
        assert(certifySourceRoute(variant,variant.winningPath));
        return [String(penalty),{moves,hash:authoringHash([variant.initial,variant.cards,variant.hitapps])}];
      }));
      const {cards,initial:full,...definition}=deal,{hitapps,...initial}=full;
      const changed=Object.fromEntries(Object.entries(hitapps!.cards).filter(([id,c])=>JSON.stringify(c)!==JSON.stringify(sourceCard(cards[id].leader?Kind.category:Kind.word,cards[id].rank??0))));
      const row:PackedMetaDeal={seed:entry.seed,strategy:'proof-first:Priority+bounded-directed',use:'campaign',cost:proof.cost,reserve:proof.reserve,
        baseId:template.id,deal:{...definition,initial,native:{order:Object.keys(hitapps!.cards),changed,generatedGold:hitapps!.generatedGold}},
        changedCards:Object.fromEntries(Object.entries(cards).filter(([id,c])=>JSON.stringify(c)!==JSON.stringify(template.cards[id]))),
        sourceHash:entry.sourceHash,boardHash:authoringHash([full,cards,deal.hitapps]),routeHash:proof.routeHash,traceHash:proof.traceHash,
        receiptHash:authoringHash(entry.receipt),basicRuntime:'rules4-independent-oracle-v1',campaignPolicy:'core-stage1-opening-v1',budgets};
      const restored=unpackMetaDeal(row,template);assert.equal(authoringHash(restored.deal.initial),authoringHash(full));
      assertBoard(full,deal);return row;
    });
  }
  bank[recipe.key]={recipe:{...recipe,cards:undefined},template,controls};
  writeFileSync(output+'/'+recipe.key+'.json',JSON.stringify(bank[recipe.key]));
  console.log('PLAYTEST246_ADMISSION '+JSON.stringify({...row,attempts:trials.map(t=>({seed:t.seed,status:t.status,cost:t.cost}))}));
}
writeFileSync(output+'/bank.json',JSON.stringify({schema:PLAYTEST246,levels:bank})+'\n');
console.log('PLAYTEST246_TOTAL '+JSON.stringify({levels:recipes.length,seconds:Math.round((performance.now()-start)/1000),rss:process.memoryUsage().rss}));
