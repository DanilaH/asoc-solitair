/** #238 pilot7. Nonrepeating late blocks over certified artifact banks; research only. */
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { M1, E4_M1 } from '../../src/config/economy';
import { M1_VICTORY } from '../../src/domain/azur-victory-reward';
import { releaseProfile } from '../../src/config/profile';
import { campaignDeals, campaignIssuance, selectCampaignDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { cardsFor, type TopicId } from '../../src/content/topics';
import { applyBoard, assertBoard, dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import { Kind, sourceCard } from '../../src/domain/hitapps-rules';
import { advance } from './gameplay-oracle';
import { dealAzur } from '../content/azur-dealer';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { resolveHintRoute } from '../../src/domain/hint';
import { campaignId, completedLevels, dailyModeAvailable, dailyTasksAvailable, helperUnlocked, freeHintDemo } from '../../src/domain/progression';
import { beginDeal } from '../../src/domain/campaign';
import { quoteLayoutRetry, commitAdaptiveRetry } from '../../src/app/campaign-retry';
import { mayStartCampaignAttempt, refreshCampaignLives } from '../../src/domain/campaign-lives';
import { adjustedMoveBudget, futureDifficultyPenalty, recordSourceContinue } from '../../src/domain/difficulty';
import { clearUndo } from '../../src/domain/history';
import { findContinue } from '../../src/domain/continuation';
import { applyReceipt, buyContinue, platformState, purchaseHelper, quoteContinueVideo, cancelContinueVideo } from '../../src/domain/services';
import { claimShopCoins, offerQuote, prepareRewardOffer, retireUnrewardedOffer, selectedWinMultiplier, type OfferPlacement } from '../../src/domain/reward-offers';
import { acceptedTaskSignals, claimTask, claimTaskMilestone, openWeeklyChest, pendingTaskRewards, recordTaskSignal, updatePreviewTasks, type TaskSignal } from '../../src/domain/events/daily-tasks';
import { claimDailyBonus, openDailyBonusRound, revealDailyBonusCard } from '../../src/domain/events/daily-bonus';
import { grantShuffleIntro } from '../../src/domain/shuffle-progression';
import { claimWinStreak } from '../../src/domain/events/win-streak';
import { recordFreeCampaignClear } from '../../src/domain/commerce/storefront';
import { switchMode } from '../../src/domain/sessions';
import { restoreCampaignStock, restoreQuote } from '../../src/domain/campaign-recovery';
import { coffeeBlocker, recordCoffeeDisplay, releasePlacementEligible } from '../../src/domain/campaign-advertising';
import { bonusOffer, pilesFor, purchaseBonusSlot } from '../../src/domain/bonus-slots';
import { allowsRandomJoker, buyRandomJokerAccess, findRandomJokerPlacement, placeRandomJokerAt, randomJokerReady, settleRandomJoker } from '../../src/domain/random-joker';
import { canShuffle, commitShuffle, prepareShuffleBoard } from '../../src/domain/proof-shuffle';
import type { Board, BoardCommand, Command, Deal, Save } from '../../src/domain/types';

assert(E4_M1 && releaseProfile?.id==='c8-release-v1');
assert.equal(campaignDeals.length,200);
const family=process.argv[2]??'current', channel=process.argv[3]??'free';
assert(['current','five','azur'].includes(family));assert(['free','rv','rv-nofill'].includes(channel));
const supply=process.argv[4]??'full';
const slope=Number(process.argv[5]??5);
assert(['partial','no-optional'].includes(supply));assert([2,5].includes(slope));
const voluntary=channel!=='free';
const lastLevel=95;
// Research-only injection into existing dispatch parameter, preserving M1 offer identity in this model.
const victory={...M1_VICTORY,coinsPerRemainingMove:slope};
const outDir='.recording/study238-block';
mkdirSync(outDir,{recursive:true});
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const start=Date.UTC(2026,10,28,12),DAY=86400000;
const stats:Record<string,number>={};
const money:Record<string,number>={};
const bump=(k:string,n=1)=>{stats[k]=(stats[k]??0)+n;};
function rng(seed:number){let x=seed>>>0;return (n:number)=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return Math.floor(x/4294967296*n);};}
function replay(b:Board,path:readonly BoardCommand[],d:Deal){for(const a of path){const o=advance(b,a,d);if(!o)return; b=o;}return b;}
function certify(d:Deal){assertBoard(d.initial,d);const result=replay(d.initial,d.winningPath,d);assert.equal(result?.phase,'won',d.id);return (d.initial.movesLeft??0)-(result?.movesLeft??0);}
const size=(d:Deal)=>d.initial.stock.length+d.initial.tableau.flat().length;
const groups=(d:Deal)=>Object.values(d.cards).filter(c=>c.leader).length;

type BankEntry={deal:Deal;seed:number;layoutHash:string;cost?:number;certificateCost?:number;populationSeed?:number;policy?:string};
type BlockRow={level:number;profile:string;sourceRun:number;seed:number;layoutHash:string;populationKey:string;deal:Deal;cost:number};
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function geometry(d:Deal){return hash([d.initial.tableau,d.initial.stock,d.initial.foundations,d.initial.faceUp,d.initial.hitapps]);}
function populationKey(d:Deal){return hash(Object.values(d.cards).filter(c=>c.leader).map(c=>c.category).sort());}
function categorySet(d:Deal){return new Set(Object.values(d.cards).filter(c=>c.leader).map(c=>c.category));}
const block:BlockRow[]=[];
const waveFive=['H12','H6','H10','H10','H10','H15b','H6','H10','H10','H10'];
const waveAzur=['A1','A2','A3','A2','A4','A3','A4'];
if(family!=='current'){
  const wave=family==='five'?waveFive:waveAzur;
  const usedLayouts=new Set<string>(),usedPopulation=new Map<string,number>();
  const pools=new Map<string,(BankEntry&{sourceRun:number})[]>();
  for(const profile of new Set(wave)){
    const files=[
      {run:46132719274,path:'.recording/pilot5/study-238-independent-'+profile+'/research-bank.json'},
      {run:46134064192,path:'.recording/pilot6/study-238-selection-'+profile+'/research-bank.json'},
    ];
    const pool=files.flatMap(({run,path})=>(JSON.parse(readFileSync(path,'utf8')) as BankEntry[]).map(entry=>({...entry,sourceRun:run})));
    for(const entry of pool){
      assert.equal(geometry(entry.deal),entry.layoutHash,'artifact layout hash');
      assert.equal(certify(entry.deal),entry.cost??entry.certificateCost,'artifact finite proof');
    }
    pools.set(profile,pool);
  }
  for(let level=81;level<=lastLevel;level++){
    const profile=wave[(level-81)%wave.length],pool=pools.get(profile)!;
    const candidates=pool.filter(e=>!usedLayouts.has(e.layoutHash));
    assert(candidates.length,'insufficient distinct layouts for '+profile+' at '+level);
    function score(entry:BankEntry){
      const words=categorySet(entry.deal);
      const previous=block.slice(-3);
      const overlap=previous.reduce((sum,row,i)=>sum+[...categorySet(row.deal)].filter(cat=>words.has(cat)).length*(i+1),0);
      return (usedPopulation.get(populationKey(entry.deal))??0)*100+overlap;
    }
    candidates.sort((x,y)=>score(x)-score(y)||x.seed-y.seed||x.layoutHash.localeCompare(y.layoutHash));
    const source=candidates[0],pop=populationKey(source.deal);
    usedLayouts.add(source.layoutHash);usedPopulation.set(pop,(usedPopulation.get(pop)??0)+1);
    block.push({level,profile,sourceRun:source.sourceRun,seed:source.seed,layoutHash:source.layoutHash,populationKey:pop,
      deal:source.deal,cost:source.cost??source.certificateCost!});
  }
  assert.equal(usedLayouts.size,lastLevel-80);
}
writeFileSync(outDir+'/block-manifest.json',JSON.stringify(block.map(({deal,...entry})=>entry),null,2));
console.log('STUDY238_BLOCK_MANIFEST '+JSON.stringify({family,layouts:block.length,populations:new Set(block.map(x=>x.populationKey)).size,
  rows:block.map(({deal,...entry})=>entry)}));
let save=freshSave(campaignDeals[0],'initial');
let minWallet=save.profile.coins,minWalletLate=Infinity,levelInProgress=0;
let current:Deal=campaignDeals[0], now=start, launchedAt=start, dayIndex=0, dayWins=0, lastDay=-1, nextId=0, adSequence=0, retryAfter=0;
const id=(label:string)=>'study3-'+label+'-'+(++nextId);
const utc=()=>new Date(now).toISOString().slice(0,10);
const account=(label:string,before:number)=>{
  const delta=save.profile.coins-before;
  if(delta)money[label]=(money[label]??0)+delta;
  assert(Number.isSafeInteger(save.profile.coins)&&save.profile.coins>=0,label+' wallet');
  minWallet=Math.min(minWallet,save.profile.coins);
  if(levelInProgress>=81)minWalletLate=Math.min(minWalletLate,save.profile.coins);
};
function syncTasks(){
  if(!dailyTasksAvailable(save))return;
  updatePreviewTasks(save,now);recordTaskSignal(save,now,{id:'login',kind:'DailyLogin',channel:'login',amount:1});
  grantShuffleIntro(save);
}
function signal(kind:TaskSignal['kind'],channel:TaskSignal['channel'],amount=1,signalId=id('task')){
  if(dailyTasksAvailable(save)){syncTasks();recordTaskSignal(save,now,{id:signalId,kind,channel,amount});}
}
function collectTasks(){
  if(supply==='no-optional'||supply==='partial'&&dayIndex%3!==0||!dailyTasksAvailable(save))return;
  syncTasks();
  // Claims may unlock a milestone; scan again, never fabricate a claim.
  for(let pass=0;pass<3;pass++)for(const row of pendingTaskRewards(save)){
    const before=save.profile.coins;
    if(row.kind==='task')claimTask(save,row.utc,row.id);else claimTaskMilestone(save,row.weekStart,row.id);
    account('tasks',before);
  }
  for(const key of save.dailyTasks?.inventory.chestKeys.slice()??[]){
    const before=save.profile.coins;openWeeklyChest(save,key);account('weekly-chests',before);
  }
}
function collectFree(){
  if(supply==='no-optional'||supply==='partial'&&dayIndex%2!==0)return;
  const before=save.profile.coins;
  if(claimShopCoins(save,current,now,true)){account('free-wallet',before);signal('EarnCoins','wallet',save.profile.coins-before);}
}
function collectBonus(){
  if(supply==='no-optional'||supply==='partial'&&dayIndex%2!==0)return;
  const round=openDailyBonusRound(save,now,id('bonus'),rng(238031+dayIndex),'azur-compiled-r1');
  if(!round||round.claimed)return;
  for(let i=0;i<12&&round.won===undefined;i++)if(!round.revealed.includes(i))revealDailyBonusCard(save,round.roundId,i,now);
  const before=save.profile.coins;
  if(claimDailyBonus(save,round.roundId,now)){
    account('daily-bonus',before);signal('CollectDailyBonuses','daily-bonus',1,'bonus:'+round.roundId);
    bump('daily-bonus-claims');
  }
}
function claimStreak(){
  if(supply==='no-optional')return;
  const before=save.profile.coins;claimWinStreak(save,save.meta?.winStreak?.claimed??0);account('win-streak',before);
}
function modeledFill(label:string){
  bump('ad-request:'+label);
  // Explicit scenario, deterministic 75% fill/earn, not empirical or actual SDK.
  const shown=channel!=='rv-nofill'&&(++adSequence)%4!==0;
  if(shown){bump('hypothetical-shown:'+label);platformState(save).lastFullscreenAt=now;now+=25000;}
  else{bump('hypothetical-no-fill:'+label);retryAfter=now+30000;}
  return shown;
}
function rewardedOffer(kind:OfferPlacement){
  if(!voluntary||now<retryAfter)return false;
  const quote=offerQuote(save,current,kind,now,true);if(!quote)return false;
  bump('opportunity:'+kind);
  const nonce=id('offer'), offer=prepareRewardOffer(save,current,kind,now,nonce,true,true);if(!offer)return false;
  if(!modeledFill(kind)){retireUnrewardedOffer(save,nonce);return false;}
  const before=save.profile.coins;
  applyReceipt(save,{schema:1,id:id('earned'),attempt:nonce,dealId:current.id,mode:'campaign',placement:kind},{offerNow:now,deal:current});
  assert.equal(save.profile.coins-before,quote.amount,'simulated offer settlement');
  account('rv:'+kind,before);bump('hypothetical-earned:'+kind);return true;
}
function rewardedHelper(kind:'hint'|'undo'|'continue'){
  if(!voluntary||now<retryAfter||current.daily)return false;
  if(kind==='continue'&&!quoteContinueVideo(save))return false;
  const a=save.attempt.id, receipt={schema:1 as const,id:id('earned'),attempt:a,dealId:current.id,mode:'campaign' as const,placement:kind};
  bump('opportunity:'+kind);
  if(kind==='continue')recordSourceContinue(save,current);
  if(!modeledFill(kind)){if(kind==='continue')cancelContinueVideo(save,receipt);return false;}
  const before=save.profile.coins, inv=save.profile[kind==='undo'?'undos':'hints'];
  applyReceipt(save,receipt,{deal:current,unrestrictedVideo:true,offerNow:now});
  if(kind==='continue')assert.equal(save.attempt.board.phase,'playing');
  else assert(save.profile[kind==='undo'?'undos':'hints']>inv);
  account('rv:'+kind,before);bump('hypothetical-earned:'+kind);return true;
}
function acquire(kind:'hint'|'undo'){
  const field=kind==='hint'?'hints':'undos';
  if(save.profile[field]>0||kind==='hint'&&freeHintDemo(save,current))return true;
  if(save.profile.coins<M1.helperPrices[kind]&&!current.daily)rewardedOffer('shop-free-coins');
  const before=save.profile.coins;
  if(purchaseHelper(save,kind)){account('buy:'+kind,before);signal('BuyBoosters','wallet');return true;}
  if(rewardedHelper(kind))return true;
  bump('unaffordable:'+kind);return false;
}
function cadence(startOfLevel=false){
  if(now<retryAfter||current.training||!current.daily&&current.campaignLevel!<=15)return;
  if(current.daily&&startOfLevel)return;
  if(startOfLevel){
    if(releasePlacementEligible(save,current.campaignLevel!,'level-start',now,launchedAt)){
      bump('opportunity:level-start');modeledFill('level-start');
    }
  }else{
    if(!coffeeBlocker(save,current,now,launchedAt,true,true)){
      bump('opportunity:coffee');if(modeledFill('coffee'))recordCoffeeDisplay(save,current);
    }
  }
}
function command(cmd:Command,check=true){
  // Only one-step Undo is used by the policy. Keep last snapshot, not an ever-growing search copy.
  if(cmd.type==='draw'||cmd.type==='recycle'||cmd.type==='transfer')clearUndo(save.attempt);
  const before=save, coins=save.profile.coins;
  const boardCommand=cmd.type==='draw'||cmd.type==='transfer'||cmd.type==='recycle';
  const oracle=boardCommand&&check?advance(save.attempt.board,cmd,current):undefined;
  const result=dispatch(save,cmd,current,utc(),victory);
  assert(result.accepted,result.reason??'accepted action rejected');
  if(boardCommand&&check)assert(isDeepStrictEqual(result.next.attempt.board,oracle),'oracle '+current.id);
  save=result.next;account((current.daily?'daily:':'campaign:')+cmd.type,coins);
  if(boardCommand){
    bump(current.daily?'daily-actions':'campaign-actions');
    save.attempt.telemetry??={started:true,finished:false,activeMs:0};
    save.attempt.telemetry.started=true;
    save.attempt.telemetry.activeMs+=3000;
    now+=3000;
  }
  assertBoard(save.attempt.board,current);
  if(!current.daily&&before.platform?.completedCampaign.length!==save.platform?.completedCampaign.length&&save.attempt.board.phase==='won'){
    const c=save.profile.coins;recordFreeCampaignClear(save,now);account('monthly',c);
    bump('base-coins',save.attempt.victory?.tierBase??0);
    bump('move-bonus-coins',save.attempt.victory?.movesBonus??0);
  }
  if(dailyTasksAvailable(save)){
    // day assignment occurs at session/unlock, actual event amounts come from dispatch.
    if(!save.dailyTasks||save.dailyTasks.lastUtc!==utc())syncTasks();
    for(const s of acceptedTaskSignals(before,result,cmd,current))recordTaskSignal(save,now,s);
  }
  if(boardCommand)cadence();
}
function scripted(){
  for(const a of current.winningPath)command(a);
  assert.equal(save.attempt.board.phase,'won','certified fresh attempt '+current.id);
}
function dailySession(){
  if(lastDay===dayIndex)return;lastDay=dayIndex;syncTasks();collectFree();collectBonus();collectTasks();
  if(supply==='partial'&&dayIndex%7===3&&dailyModeAvailable(save)){
    const campaign=current,daily=dailyForDay(utc());
    switchMode(save,'daily',daily,id('daily'));current=daily;
    scripted();bump('daily-scripted-wins');
    switchMode(save,'campaign',campaign,id('campaign'));current=campaign;
    collectTasks();
  }
}
function nextDay(){
  dayIndex++;dayWins=0;now=start+dayIndex*DAY;launchedAt=now;retryAfter=0;
  refreshCampaignLives(save,now);
}
function select(level:number,retry:number){
  const base=campaignDeals[level-1];
  if(family==='current'||level<=80)return selectCampaignDeal(save,base,level===1?undefined:save.attempt);
  const entry=block[level-81],source=entry.deal,cost=entry.cost;
  // Common reserve policy; intentionally not original live numeric budget.
  const budget=Math.max(cost+1,adjustedMoveBudget(cost+Math.max(18,Math.ceil(cost*.25)),futureDifficultyPenalty(save),true));
  const f=source.initial.foundations.length,t=source.initial.tableau.length;
  const tier=entry.profile==='H15b'||entry.profile==='A4'?'superhard':entry.profile==='H12'||entry.profile==='A3'?'hard':'normal';
  const d:Deal={...source,id:'study7-'+family+'-'+level,campaignLevel:level,training:undefined,
    difficultyTier:tier,randomJokerPreview:1,
    extraHelpers:{version:1,randomJokerCoins:M1.randomJoker,unlimitedCoins:M1.unlimited,unlimitedMs:60000},
    shufflePolicy:'hidden-pool-r1',shuffleCost:'charge',
    bonusSlots:{...(f>=3&&f<5?{foundation:{coins:M1.upperSlot}}:{}),...(t>=3&&t<5?{tableau:{coins:M1.lowerSlot}}:{})},
    initial:{...structuredClone(source.initial),movesLeft:budget}};
  certify(d);return d;
}
function startLevel(level:number){
  const prev=save.attempt, d=select(level,0);
  beginDeal(save,d,id('level'));current=d;
  if(family==='current'||level<=80)save.attempt.issuance=campaignIssuance(save,campaignDeals[level-1],d,level===1?undefined:prev);
  cadence(true);
}
function retryLevel(level:number,retry:number){
  const old=current;
  now+=60000;collectTasks();
  const real=family==='current'||level<=80;
  if(real){
    const q=quoteLayoutRetry(save);
    if(q){
      let r=commitAdaptiveRetry(save,q,id('retry'),now,quoteLayoutRetry);
      if(r==='lives'){now+=300000;bump('life-wait-ms',300000);r=commitAdaptiveRetry(save,q,id('retry'),now,quoteLayoutRetry);}
      assert.equal(r,'started','retry issuance');current=q.selected;bump('layout-retry');return;
    }
  }
  if(!mayStartCampaignAttempt(save,save.attempt,now)){
    now+=300000;bump('life-wait-ms',300000);assert(mayStartCampaignAttempt(save,save.attempt,now));
  }
  if(real){command({type:'restart',attemptId:id('retry')});bump('same-layout-retry');return;}
  // Same-layout restart on proxy: never consume a different level's selected geometry.
  command({type:'restart',attemptId:id('retry')});bump('proxy-same-layout-retry');
}
function visible(b:Board,d:Deal){
  const up=new Set(b.faceUp);
  // Canonicalize equivalent ordinary piles to reject harmless relocation loops.
  const special=Boolean(b.joker||d.lock||d.frozen||d.bound||Object.values(b.hitapps?.cards??{}).some(c=>c.lock||c.ice||c.bound));
  const cols=b.tableau.map(p=>p.map(card=>up.has(card)?card:'?').join(','));
  return JSON.stringify([special?cols:cols.sort(),b.foundations.map(p=>p.join(',')).sort(),b.stock.length,b.waste,
    b.collected.slice().sort(),b.recyclesLeft,b.joker,b.keys,Object.entries(b.hitapps?.cards??{})
      .filter(([id])=>up.has(id)).map(([id,c])=>[id,c.ice,c.bound,c.lock?.collected,c.gold?.health]),b.hitapps?.spent]);
}
const hidden=(b:Board)=>b.tableau.flat().filter(id=>!b.faceUp.includes(id)).length;
const home=(b:Board)=>b.foundations.flat().length+b.collected.length;
function pick(b:Board,d:Deal,seen:Set<string>){
  const options=legalCommands(b,d).flatMap(a=>{
    const r=applyBoard(b,a,d);if(typeof r==='string')return[];
    const next=r.board;
    if(seen.has(visible(next,d)))return[];
    const completion=next.collected.length-b.collected.length,
      progress=home(next)-home(b),reveal=hidden(b)-hidden(next),
      empty=next.tableau.filter(p=>!p.length).length-b.tableau.filter(p=>!p.length).length;
    const merge=a.type==='transfer'&&a.to.kind==='tableau'&&b.tableau[a.to.index].length>0&&a.from.kind==='tableau'&&empty>0;
    const special=r.events.filter(e=>['key','unlock','ice','cut','unbind','assemble'].includes(e.type)).length;
    const foundationWeight=levelInProgress<81?18:levelInProgress%2?35:8;
    const revealWeight=levelInProgress<81?24:levelInProgress%2?12:48;
    const v=next.phase==='won'?1e9:completion*100+progress*foundationWeight+reveal*revealWeight+special*16+empty*5+(merge?8:0)
      +(a.type==='draw'?4:a.type==='recycle'?1:a.type==='transfer'&&a.from.kind==='waste'?2:-4);
    // Reject a non-progressing move to an empty column if it only swaps equivalent piles.
    if(a.type==='transfer'&&a.to.kind==='tableau'&&a.from.kind==='tableau'&&v<0)return[];
    return [{a,v}];
  });
  options.sort((a,b)=>b.v-a.v||JSON.stringify(a.a).localeCompare(JSON.stringify(b.a)));return options[0]?.a;
}
function play():string{
  const seen=new Set<string>();let stall=0,usedHint=false,usedUndo=false,usedSlot=false,askedJoker=false,askedShuffle=false,usedRecovery=false;
  for(let turns=0;turns<500;turns++){
    const b=save.attempt.board;
    if(b.phase==='won')return 'won';
    if(b.phase==='exhausted'){
      if(usedRecovery||save.attempt.continued)return 'exhausted';
      usedRecovery=true;bump('continue-requested');
      const proof=findContinue(save.attempt,current,3000,performance.now()+1200);
      if(proof.status==='PROVEN_RECOVERABLE'){
        assert.equal(replay({...b,movesLeft:10,phase:'playing'},proof.path,current)?.phase,'won','continue oracle');
        bump('continue-proven');
        const old=save.profile.coins, candidate=structuredClone(save);
        recordSourceContinue(candidate,current);
        if(buyContinue(candidate,{attemptId:candidate.attempt.id,deal:current,path:proof.path})){
          save=candidate;account('buy:continue',old);signal('BuyExtraMoves','continue');bump('continue-coins');seen.clear();continue;
        }
        bump('continue-coins-denied');
      }else bump('continue-unproven');
      if(rewardedHelper('continue')){seen.clear();continue;}
      return 'exhausted';
    }
    seen.add(visible(b,current));
    let a=pick(b,current,seen);
    const trouble=stall>=7||!a||((b.movesLeft??999)<=8&&groups(current)>0);
    if(trouble&&!usedHint&&helperUnlocked(save,'hint',current)){
      usedHint=true;bump('hint-need');
      if(acquire('hint')){
        const ans=resolveHintRoute(b,current,1200);
        if(ans.status==='SOLVED'&&ans.path.length){
          assert.equal(replay(b,ans.path,current)?.phase,'won','hint oracle');
          command({type:'hint',revision:save.revision,action:ans.path[0]});bump('hint-applied');
          if(JSON.stringify(a)!==JSON.stringify(ans.path[0]))bump('hint-changed');
          a=ans.path[0];
        }else bump('hint-unproven');
      }
    }
    if(!a&&!usedUndo&&save.attempt.undo.length&&helperUnlocked(save,'undo',current)){
      usedUndo=true;bump('undo-need');
      if(acquire('undo')){command({type:'undo'});bump('undo-used');stall=0;continue;}
    }
    if(!a){
      const price=restoreQuote(save.attempt,current);
      if(price!==undefined){
        const old=save.profile.coins,oracle=advance({...b,recyclesLeft:1},{type:'recycle'},current);
        if(restoreCampaignStock(save,current,{attemptId:save.attempt.id,revision:save.revision,cost:price})){
          assert(isDeepStrictEqual(save.attempt.board,oracle),'restore oracle');account('stock-restore',old);bump('restore-used');now+=3000;stall=0;continue;
        }bump('restore-denied');
      }
      if(!askedShuffle&&canShuffle(save,current)){
        askedShuffle=true;bump('shuffle-need');
        const seed=(23800+nextId)>>>0, shuffled=prepareShuffleBoard(b,current,seed);
        if(shuffled){
          const proof=resolveHintRoute(shuffled,current,1200);
          if(proof.status==='SOLVED'){
            assert.equal(replay(shuffled,proof.path,current)?.phase,'won','shuffle oracle');
            if(commitShuffle(save,current,{attemptId:save.attempt.id,dealId:current.id,revision:save.revision,board:b,deal:current,seed},proof.path)){
              bump('shuffle-used');seen.clear();stall=0;continue;
            }
          }bump('shuffle-unproven');
        }
      }
      if(!usedSlot){
        usedSlot=true;
        for(const kind of ['foundation','tableau'] as const){
          const offer=bonusOffer(current,kind);
          if(!offer||pilesFor(b,kind).length!==offer.index)continue;
          bump('slot-need:'+kind);const old=save.profile.coins;
          if(purchaseBonusSlot(save,current,save.attempt.id,kind)){account('buy:slot-'+kind,old);bump('slot-used:'+kind);break;}
          else bump('slot-denied:'+kind);
        }
        // openBonusSlot mutates b in place; re-evaluate legal actions on next turn.
        if(pick(save.attempt.board,current,seen))continue;
      }
      if(!askedJoker&&allowsRandomJoker(save.attempt,current)){
        askedJoker=true;bump('joker-need');const old=save.profile.coins;
        if(!randomJokerReady(save,current))buyRandomJokerAccess(save,current,id('joker-right'),now);
        account('buy:random-joker',old);
        if(randomJokerReady(save,current)){
          const placement=findRandomJokerPlacement(save.attempt,current,id('azj').replace('study3-azj','azj'),rng(nextId+238),performance.now()+1200);
          if(placement){
            const board=placeRandomJokerAt(save.attempt,current,placement.column,placement.id);
            assert(board&&replay(board,placement.path,current)?.phase==='won','joker oracle');
            if(settleRandomJoker(save,current,{...placement,attemptId:save.attempt.id,revision:save.revision})){
              bump('joker-used');seen.clear();stall=0;continue;
            }
          }bump('joker-unproven');
        }else bump('joker-denied');
      }
      return 'policy-stuck';
    }
    const before=home(b),closed=hidden(b);
    command(a);const after=save.attempt.board;
    stall=home(after)>before||hidden(after)<closed?0:stall+1;
  }
  return save.attempt.board.phase==='won'?'won':'bound';
}
const rows:Record<string,unknown>[]=[];
let checkpoint:{wallet:number;stats:Record<string,number>;money:Record<string,number>;profile:Save['profile']}|undefined;
for(let level=1;level<=lastLevel;level++){
  levelInProgress=level;
  if(dayWins>=3)nextDay();
  dailySession();
  collectFree();collectBonus();collectTasks();
  const wallet=save.profile.coins, actions=stats['campaign-actions']??0;
  const prePenalty=futureDifficultyPenalty(save);
  startLevel(level);
  let status='guided',attempts=1,assisted=false;
  const initialId=current.id, initialBudget=current.initial.movesLeft;
  if(level<=15)scripted();
  else{
    status=play();
    if(status==='won'){bump('first-policy-wins');if(!save.attempt.continued)bump('first-without-continue');}
    else{
      bump('first-policy-fail:'+status);retryLevel(level,1);attempts++;
      status=play();
      if(status==='won')bump('retry-policy-wins');
      else{
        bump('second-policy-fail:'+status);retryLevel(level,2);attempts++;
        scripted();assisted=true;bump('scripted-rescues');
      }
    }
  }
  assert.equal(save.attempt.board.phase,'won');assert.equal(completedLevels(save),level);
  claimStreak();collectTasks();
  if(voluntary&&level>=16&&save.profile.coins<600){
    const offer=selectedWinMultiplier(save,current);if(offer)rewardedOffer(offer);
  }
  dayWins++;
  const reconciled=M1.initialCoins+Object.values(money).reduce((a,b)=>a+b,0);
  assert.equal(save.profile.coins,reconciled,'wallet reconciliation L'+level);
  rows.push({level,day:dayIndex,initialId,finalId:current.id,initialBudget,attempts,scripted:level<=15||assisted,
    firstPolicyWin:level>15&&attempts===1,policyWin:level>15&&!assisted,cards:size(current),groups:groups(current),
    penaltyBefore:prePenalty,penaltyAfter:futureDifficultyPenalty(save),walletBefore:wallet,wallet:save.profile.coins,
    hints:save.profile.hints,undos:save.profile.undos,jokers:save.profile.jokers,shuffles:save.dailyTasks?.inventory.shuffles??0,
    movesBonus:save.attempt.victory?.movesBonus??0,actions:(stats['campaign-actions']??0)-actions,
    lives:save.campaignLives?.remaining??5,sourceOutcome:save.sourceDifficultyHistory?.at(-1),stats:{...stats}});
  if(level===80){checkpoint={wallet:save.profile.coins,stats:{...stats},money:{...money},profile:structuredClone(save.profile)};}
  if(level%10===0||level===1||level===lastLevel){
    writeFileSync(outDir+'/rows.json',JSON.stringify(rows,null,2));
    console.log('STUDY238_BLOCK_PROGRESS '+JSON.stringify({family,channel,supply,slope,level,wallet:save.profile.coins,firstWins:stats['first-policy-wins']??0,
      retryWins:stats['retry-policy-wins']??0,scriptedRescues:stats['scripted-rescues']??0,penalty:futureDifficultyPenalty(save)}));
  }
}
assert(checkpoint);
const diff=(a:Record<string,number>,b:Record<string,number>)=>Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(k=>[k,(a[k]??0)-(b[k]??0)]));
const result={head,family,channel,supply,slope,levels:completedLevels(save),wallet:save.profile.coins,minWallet,minWalletLate,days:dayIndex+1,
  stats,money,checkpoint,late:{levels:lastLevel-80,netCoins:save.profile.coins-checkpoint.wallet,stats:diff(stats,checkpoint.stats),money:diff(money,checkpoint.money)},
  inventory:{hint:save.profile.hints,undo:save.profile.undos,joker:save.profile.jokers,shuffle:save.dailyTasks?.inventory.shuffles??0},
  block: block.map(({deal,...entry})=>entry)};
writeFileSync(outDir+'/summary.json',JSON.stringify(result,null,2));console.log('STUDY238_BLOCK_SUMMARY '+JSON.stringify(result));
