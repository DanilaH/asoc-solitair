import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { ownThemeRegistry,normalizeLabel,playtestTemplate,type PlaytestRecipe } from '../content/playtest246-recipes';
import { playtestSet,playtestCore } from '../../src/content/campaign-playtest';
import { emptyFeatures,prepareSourceInput,sourceCardOrder } from '../content/hitapps-source-authoring';
import { authorSourceCandidate,certifySourceRoute } from '../content/hitapps-source-pipeline';
import { hitappsR4Difficulty } from '../../src/config/hitapps-r4';
import { adjustedMoveBudget } from '../../src/domain/difficulty';
import { runSourceBot } from '../content/hitapps-source-bot';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { authoringHash } from '../content/hitapps-authoring';
import { applyBoard } from '../../src/domain/engine';
import { cardArtwork } from '../../src/game/art';
import type { Card,Deal } from '../../src/domain/types';

const start=performance.now(),registry=ownThemeRegistry(),noRandom=()=>{throw Error('Recorded seed required');};
const shapes=[
  {groups:6,total:36,slots:3,columns:[3,4,5],stock:24,sourceBudget:62},
  {groups:10,total:64,slots:4,columns:[4,5,6,7],stock:42,sourceBudget:123},
  {groups:10,total:66,slots:4,columns:[4,5,6,7],stock:44,sourceBudget:130},
  {groups:12,total:80,slots:4,columns:[5,6,7,8],stock:54,sourceBudget:162},
  {groups:12,total:82,slots:4,columns:[5,6,7,8],stock:56,sourceBudget:168},
  {groups:15,total:98,slots:5,columns:[5,6,7,8,9],stock:63,sourceBudget:197},
  {groups:15,total:100,slots:4,columns:[5,6,7,8],stock:74,sourceBudget:249},
];
function population(groups:number,total:number){
  const cards:Record<string,Card>={},used=new Set<string>(),labels=new Set<string>();
  const base=Math.floor(total/groups)-1,extra=total%groups;
  for(let i=0;i<groups;i++){
    const count=base+Number(i<extra);
    const row=[...registry].find(([id,all])=>{
      const words=Object.values(all).filter(c=>!c.leader);
      const proposed=[Object.values(all).find(c=>c.leader)!,...words.slice(0,count)];
      return !used.has(id)&&words.length>=count&&new Set(proposed.map(c=>normalizeLabel(c.text))).size===count+1&&
        proposed.every(c=>!labels.has(normalizeLabel(c.text)));
    });
    assert(row);used.add(row[0]);
    const values=Object.values(row[1]),selected=[values.find(c=>c.leader)!,...values.filter(c=>!c.leader).slice(0,count)];
    for(const card of selected){cards[card.id]=card;labels.add(normalizeLabel(card.text));}
  }
  assert.equal(Object.keys(cards).length,total);return cards;
}
function proposal(deal:Deal,ms=1500){
  const deadline=performance.now()+ms,bot=runSourceBot(deal,'Priority');
  return bot.status==='WON'?bot.path:findReferenceRoute(deal,deal.initial,5000,true,deadline,'verified-specials').path;
}
const numeric=[];
for(const [index,shape]of shapes.entries()){
  const cards=population(shape.groups,shape.total),recipe:PlaytestRecipe={key:'numeric-'+shape.total,level:2001+index,
    dealer:'hitapps-ten-pass-v1',groups:shape.groups,physical:shape.total,slots:shape.slots,columns:shape.columns,
    displayTier:4,cards,topics:Object.values(cards).filter(c=>c.leader).map(c=>c.category),
    source:'THIRD_PARTY_WEB_UNVERIFIED numerical shape; foundation count ASSUMED; own words and budgets'};
  const template=playtestTemplate(recipe),trials=[];let accepted:Deal|undefined;
  for(let offset=1;offset<=32;offset++){
    const seed=2469000+index*100+offset,result=authorSourceCandidate(template,{input:{version:'hitapps-input-v2',layout:'random',stable:true,
      levelPenalty:0,cardOrder:sourceCardOrder(template),features:emptyFeatures},difficulty:hitappsR4Difficulty,
      historyPenalty:0,previousLosses:0,strategy:{name:'None'},seeds:[seed],drawSeed:noRandom,findWitness:proposal});
    trials.push({seed,status:result.status});
    if(result.status==='CERTIFIED'){accepted=result.deal;break;}
  }
  assert(accepted,'Numeric authoring blocked '+shape.total);
  assert.equal(accepted.initial.stock.length,shape.stock);
  assert.equal(accepted.initial.tableau.flat().length+accepted.initial.stock.length,shape.total);
  const initialProof=certifySourceRoute(accepted,accepted.winningPath)!;assert(initialProof);
  const budget=initialProof.cost+Math.max(18,Math.ceil(initialProof.cost*.25));
  const issued={...accepted,initial:{...accepted.initial,movesLeft:budget}};
  for(const penalty of [-5,0,10])assert(certifySourceRoute({...issued,initial:{...issued.initial,movesLeft:adjustedMoveBudget(budget,penalty,true)}},issued.winningPath));
  numeric.push({shape,trials,seed:trials.at(-1)!.seed,cost:initialProof.cost,budget,
    sourceBudgetFit:initialProof.cost<=shape.sourceBudget,originalOptimality:'UNKNOWN',routeHash:initialProof.routeHash,
    populationHash:authoringHash(cards),status:'QA_ONLY_CERTIFIED_NOT_ISSUED'});
}
const controls=[];
for(const feature of ['ordered','ice','lock','bound','puzzle','magnet','hammer','gold']){
  const level=Array.from({length:21},(_,i)=>81+i).find(level=>playtestSet('azur-'+level)?.recipe.feature===feature)!;
  const set=playtestSet('azur-'+level)!,entry=set.controls['25'][0],bank=playtestCore(level,'azur21-v1',25)!;
  const special=bank.byId.get(entry.deal.id+'-core-stage1-v1-m1')!.deal;
  const source=prepareSourceInput(set.template,{version:'hitapps-input-v2',layout:'random',stable:true,levelPenalty:0,
    cardOrder:sourceCardOrder(set.template),features:emptyFeatures,dealer:'azur-exclusive-fy-v1'},450).prepare(entry.seed,'None',noRandom).finish().deal;
  const path=proposal(source,3200),plain=path?{...source,winningPath:[...path]}:source;
  const certificate=path&&certifySourceRoute(plain,path);
  const textOnly:Deal={...plain,id:plain.id+'-text-control',cards:Object.fromEntries(Object.entries(plain.cards).map(([id,card])=>{
    const{image,...text}=card;return[id,text];}))};
  if(certificate)assert(certifySourceRoute(textOnly,textOnly.winningPath));
  let board=special.initial;const effects:Record<string,number>={};
  for(const action of special.winningPath){const step=applyBoard(board,action,special);assert(typeof step!=='string');
    for(const event of step.events){effects[event.type]=(effects[event.type]??0)+1;if(event.cause)effects[event.cause]=(effects[event.cause]??0)+1;if(event.reason)effects[event.type+':'+event.reason]=(effects[event.type+':'+event.reason]??0)+1;}board=step.board;}
  const key=(d:Deal)=>authoringHash([d.initial.tableau,d.initial.stock]);
  controls.push({feature,level,seed:entry.seed,matchedOwnPopulation:true,matchedRequestedSeed:true,
    sameFinalGeometry:key(plain)===key(special),physicalSpecial:special.initial.tableau.flat().length+special.initial.stock.length,
    physicalOrdinary:plain.initial.tableau.flat().length+plain.initial.stock.length,
    semanticNote:'Puzzle halves and starters are physical additions; source pattern reseeds are retained, not silently neutralized',
    ordinary:{status:certificate?'PROVEN':'UNKNOWN',cost:certificate?.cost??null,images:Object.values(plain.cards).filter(c=>cardArtwork(c,plain)).length},
    text:{status:certificate?'PROVEN':'UNKNOWN',cost:certificate?.cost??null,images:0},
    special:{status:'PROVEN',cost:entry.cost,effects,images:Object.values(special.cards).filter(c=>cardArtwork(c,special)).length},
    sameSpecialBudgetFit:Boolean(certificate&&certificate.cost<=special.initial.movesLeft!)});
}
const result={numeric,controls,registryTopics:registry.size,ms:Math.round(performance.now()-start),rss:process.memoryUsage().rss,
  scope:'own controls only, no new production bank, no original-runtime parity or human difficulty claim'};
mkdirSync('.recording/issue246',{recursive:true});writeFileSync('.recording/issue246/authoring-controls.json',JSON.stringify(result,null,2)+'\n');
console.log('PLAYTEST246_AUTHORING_CONTROLS '+JSON.stringify({numeric:numeric.length,specials:controls.length,ms:result.ms,rss:result.rss}));
