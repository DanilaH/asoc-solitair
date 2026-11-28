import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { campaignPlaytest } from '../../src/config/campaign-playtest';
import { campaignDeals,findDeal,selectCampaignDeal } from '../../src/content/campaign';
import { freshSave,dispatch,legalCommands,boardKey,placeJoker,applyBoard } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { purchaseHelper,buyContinue } from '../../src/domain/services';
import { findContinue } from '../../src/domain/continuation';
import { resolveHintRoute } from '../../src/domain/hint';
import { knownContinuation,continuationLookup } from '../../src/domain/solver';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { bonusOffer,purchaseBonusSlot } from '../../src/domain/bonus-slots';
import { buyRandomJokerAccess,findRandomJokerPlacement,settleRandomJoker,randomJokerCount } from '../../src/domain/random-joker';
import { prepareShuffleBoard,commitShuffle,type ShuffleRequest } from '../../src/domain/proof-shuffle';
import { proveShuffle } from '../../src/game/shuffle-proof';
import { grantEventPrize } from '../../src/domain/events/daily-tasks';
import { buyUnlimitedAccess,expireUnlimited,unlimitedRemaining,restoreQuote,restoreCampaignStock } from '../../src/domain/campaign-recovery';
import { revealRelatedWord,definitionCount } from '../../src/domain/reward-offers';
import { decodeSave } from '../../src/platform/storage';
import { serializeSave } from '../../src/platform/save-undo';
import { clearUndo } from '../../src/domain/history';
import { replayIndependent,independentStep,chooseIndependent,observedKey,runIndependent } from './playtest246-policy';
import type { Board,BoardCommand,Deal,Save } from '../../src/domain/types';

const profile=campaignPlaytest??'current',rows:Record<string,unknown>[]=[],recoveries:unknown[]=[],start=performance.now();
const levels=[81,82,84,86,87,88,90,92,94,96,101];
const clone=(s:Save)=>decodeSave(serializeSave(s),findDeal);
function route(board:Board,deal:Deal){
  const answer=resolveHintRoute(board,deal);
  if(answer.status!=='SOLVED')return{status:answer.status,cost:null,path:[] as BoardCommand[]};
  const end=replayIndependent(board,answer.path,deal);assert.equal(end.phase,'won');
  const cost=board.movesLeft===null?end.hitapps!.move-board.hitapps!.move:board.movesLeft-end.movesLeft!;
  return{status:'PROVEN',cost,path:answer.path};
}
function policy(board:Board,deal:Deal){const{board:_,stateHash,...result}=runIndependent(deal,'foundation',board);return result;}
function snapshot(level:number){
  const base=campaignDeals[level-1],context=freshSave(base,'helper-select');
  context.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,
    completedCampaign:Array.from({length:level-1},(_,i)=>campaignId(i+1))};
  const deal=selectCampaignDeal(context,base),save=freshSave(deal,'helper-'+level);save.platform=context.platform;
  save.profile.coins=2000;save.profile.hints=0;save.profile.undos=0;save.profile.jokers=0;
  const prefix=Math.floor(deal.winningPath.length*.45);
  let state=save;
  for(let i=0;i<prefix;i++){
    if(i<prefix-3)clearUndo(state.attempt);
    const result=dispatch(state,deal.winningPath[i],deal);assert(result.accepted);state=result.next;
  }
  const wanted=deal.winningPath[prefix],expected=independentStep(state.attempt.board,wanted,deal).board;
  const alternative=legalCommands(state.attempt.board,deal).find(a=>boardKey(independentStep(state.attempt.board,a,deal).board)!==boardKey(expected));
  if(alternative){const result=dispatch(state,alternative,deal);assert(result.accepted);state=result.next;}
  assert.equal(state.attempt.board.phase,'playing');
  return{deal,save:state,prefix,origin:alternative?'reachable off-witness choice':'reachable witness prefix'};
}
function multiShuffle(request:ShuffleRequest){
  const deadline=performance.now()+1800,attempts=[];
  for(let i=0;i<3&&performance.now()<deadline;i++){
    const seed=(request.seed+Math.imul(i,0x9e3779b9))>>>0,board=prepareShuffleBoard(request.board,request.deal,seed);
    if(!board){attempts.push({seed,status:'NO_CHANGE'});continue;}
    const until=Math.min(deadline,performance.now()+(deadline-performance.now())/(3-i));
    const lookup=continuationLookup(board,request.deal,until);
    const found=findReferenceRoute(request.deal,board,6400,true,until,'verified-specials',lookup);
    attempts.push({seed,status:found.status});
    if(found.status==='FOUND'&&replayIndependent(board,found.path,request.deal).phase==='won')return{seed,path:found.path,attempts};
  }
  return{attempts};
}
for(const level of levels){
  const{save,deal,prefix,origin}=snapshot(level),baseline=route(save.attempt.board,deal),baselinePolicy=policy(save.attempt.board,deal);
  const baselineNext=chooseIndependent(save.attempt.board,deal,'foundation',new Set([observedKey(save.attempt.board,deal)]));
  const inv=(s:Save)=>({hints:s.profile.hints,undos:s.profile.undos,jokers:s.profile.jokers,random:randomJokerCount(s),
    shuffle:s.dailyTasks?.inventory.shuffles??0,definitions:definitionCount(s)});
  function record(helper:string,next:Save,details:Record<string,unknown>,matched=save){
    const noHelper=matched===save?baseline:route(matched.attempt.board,deal);
    const noHelperPolicy=matched===save?baselinePolicy:policy(matched.attempt.board,deal);
    const noHelperNext=matched===save?baselineNext:chooseIndependent(matched.attempt.board,deal,'foundation',new Set([observedKey(matched.attempt.board,deal)]));
    const proof=next.attempt.board.phase==='playing'?route(next.attempt.board,deal):{status:next.attempt.board.phase,cost:null,path:[]};
    const afterNext=next.attempt.board.phase==='playing'?chooseIndependent(next.attempt.board,deal,'foundation',new Set([observedKey(next.attempt.board,deal)])):undefined;
    rows.push({profile,level,dealId:deal.id,prefix,origin,helper,need:noHelper.status==='PROVEN'?'NO_PROVEN_FORCED_NEED':'UNKNOWN',
      noHelper:{proofStatus:noHelper.status,cost:noHelper.cost,policy:noHelperPolicy},proofStatus:proof.status,
      solved:proof.status==='PROVEN',policy:policy(next.attempt.board,deal),boardChanged:boardKey(matched.attempt.board)!==boardKey(next.attempt.board),
      actionChanged:JSON.stringify(noHelperNext)!==JSON.stringify(afterNext),stepsSpent:matched.attempt.board.movesLeft!==null&&next.attempt.board.movesLeft!==null?matched.attempt.board.movesLeft-next.attempt.board.movesLeft:null,
      movesSaved:noHelper.cost!==null&&proof.cost!==null?noHelper.cost-proof.cost:null,remaining:next.attempt.board.movesLeft,
      walletDelta:next.profile.coins-matched.profile.coins,inventoryBefore:inv(matched),inventoryAfter:inv(next),
      encodedSaveBytes:Buffer.byteLength(serializeSave(next)),undoFrames:next.attempt.undo.length,...details});
    assert.deepEqual(clone(next).attempt.board,next.attempt.board);
  }
  {
    let next=clone(save);const acquired=purchaseHelper(next,'hint'),before=next.profile.hints;
    const answer=resolveHintRoute(next.attempt.board,deal);let consumed=false,issued=false;
    if(answer.status==='SOLVED'&&answer.path[0]){
      const offer=dispatch(next,{type:'hint',revision:next.revision,action:answer.path[0]},deal);issued=offer.accepted;next=offer.next;
      const unused=clone(next);if(campaignPlaytest)assert.equal(unused.profile.hints,before);
      const used=dispatch(next,answer.path[0],deal);assert(used.accepted);next=used.next;consumed=next.profile.hints===before-1;
    }
    record('Hint',next,{available:true,quote:300,acquired,issued,consumed,changedSuggestedMove:answer.status==='SOLVED'&&JSON.stringify(answer.path[0])!==JSON.stringify(baselineNext),failure:answer.status==='SOLVED'?null:answer.status});
  }
  {
    let next=clone(save);const acquired=purchaseHelper(next,'undo');let used=0;
    const beforeHistory=next.attempt.undo.map(b=>structuredClone(b));
    for(let i=0;i<2&&next.attempt.undo.length;i++){
      if(!next.profile.undos)purchaseHelper(next,'undo');const result=dispatch(next,{type:'undo'},deal);assert(result.accepted);next=result.next;used++;
      assert.deepEqual(next.attempt.board,beforeHistory[beforeHistory.length-used]);
    }
    record('Undo',next,{available:beforeHistory.length>0,quote:200,acquired,consumed:used,historyFrames:beforeHistory.length,failure:used?null:'NO_HISTORY'});
  }
  {
    let next=clone(save);const columns=next.attempt.board.tableau.flatMap((_,i)=>typeof placeJoker(next.attempt.board,i,deal)==='string'?[]:[i]);
    const acquired=columns.length?purchaseHelper(next,'joker'):false;
    if(acquired){const result=dispatch(next,{type:'place-joker',column:columns[0]},deal);assert(result.accepted);next=result.next;}
    record('Manual Joker',next,{available:columns.length>0,quote:800,acquired,consumed:acquired,solverGate:false,failure:columns.length?null:'NO_LEGAL_COLUMN'});
  }
  {
    const next=clone(save),acquired=buyRandomJokerAccess(next,deal,'audit-random-'+level,1000);
    const found=acquired?findRandomJokerPlacement(next.attempt,deal,'azj-audit-'+level,()=>0,performance.now()+3200):undefined;
    const consumed=Boolean(found&&settleRandomJoker(next,deal,{...found,attemptId:next.attempt.id,revision:next.revision}));
    if(acquired&&!consumed)assert.equal(randomJokerCount(clone(next)),1);
    record('Random Joker',next,{available:acquired,quote:300,acquired,consumed,retainedUnused:acquired&&!consumed,failure:consumed?null:acquired?'UNKNOWN':'INELIGIBLE'});
  }
  {
    const next=clone(save);assert(grantEventPrize(next,{kind:'Shuffle',quantity:1}));
    const request:ShuffleRequest={attemptId:next.attempt.id,dealId:deal.id,revision:next.revision,board:structuredClone(next.attempt.board),deal,seed:246000+level};
    const t=performance.now();let single:BoardCommand[]|null=null,error:string|null=null;
    try{single=proveShuffle(request);}catch(e){error=String(e);}
    const singleMs=Math.round(performance.now()-t),t1=performance.now(),portfolio=multiShuffle(request),portfolioMs=Math.round(performance.now()-t1);
    const consumed=Boolean(single&&commitShuffle(next,deal,request,single));
    const alternative=clone(save);grantEventPrize(alternative,{kind:'Shuffle',quantity:1});
    let alternativeConsumed=false;
    if(portfolio.path)alternativeConsumed=commitShuffle(alternative,deal,{...request,seed:portfolio.seed!,revision:alternative.revision},portfolio.path);
    if(!consumed)assert.equal(next.dailyTasks!.inventory.shuffles,1);
    record('Shuffle',next,{available:true,quote:'saved charge',acquired:'controlled canonical Shuffle grant',consumed,
      single:{proven:Boolean(single),ms:singleMs,error},portfolio:{proven:Boolean(portfolio.path),ms:portfolioMs,attempts:portfolio.attempts,consumed:alternativeConsumed,
        policy:alternativeConsumed?policy(alternative.attempt.board,deal):null},activation:'comparison only; current policy retained',failure:consumed?null:'UNKNOWN'});
  }
  for(const kind of ['foundation','tableau']as const){
    const next=clone(save),offer=bonusOffer(deal,kind),consumed=purchaseBonusSlot(next,deal,next.attempt.id,kind);
    record(kind==='foundation'?'Upper slot':'Lower slot',next,{available:Boolean(offer),quote:offer?.coins??null,acquired:consumed,consumed,solverGate:false,
      newLegalOptions:legalCommands(next.attempt.board,deal).length-legalCommands(save.attempt.board,deal).length,failure:consumed?null:'NO_ELIGIBLE_SLOT'});
  }
  {
    const next=clone(save),until=1000+60000,acquired=buyUnlimitedAccess(next,deal,'audit-unlimited-'+level,1000);
    if(acquired){assert.equal(next.attempt.board.movesLeft,null);assert.equal(unlimitedRemaining(next.attempt.unlimited!,1100),59900);
      const resumed=clone(next);expireUnlimited(resumed,until);assert.equal(resumed.attempt.board.movesLeft,save.attempt.board.movesLeft);}
    record('Unlimited',next,{available:Boolean(deal.extraHelpers),quote:deal.extraHelpers?.unlimitedCoins,acquired,consumed:acquired,durationMs:60000,
      modeledActionsIn60sAt3s:20,humanSpeed:'UNMEASURED',failure:acquired?null:'INELIGIBLE'});
  }
  {
    let next=clone(save);
    const timed=buyUnlimitedAccess(next,deal,'audit-restore-clock-'+level,1000);
    if(timed)for(const expected of [0,100,150]){
      let count=0;
      while(restoreQuote(next.attempt,deal)===undefined&&count++<400){
        const result=dispatch(next,{type:next.attempt.board.stock.length?'draw':'recycle'},deal);
        if(!result.accepted)break;next=result.next;
      }
      const quote=restoreQuote(next.attempt,deal),before=clone(next);
      assert.equal(quote,expected,'actual M1 restore ladder');
      const oracle=independentStep({...next.attempt.board,recyclesLeft:1},{type:'recycle'},deal).board;
      assert(restoreCampaignStock(next,deal,{attemptId:next.attempt.id,revision:next.revision,cost:quote!}));
      assert.deepEqual(next.attempt.board,oracle);
      const undo=clone(next);assert(purchaseHelper(undo,'undo'));
      const wallet=undo.profile.coins,result=dispatch(undo,{type:'undo'},deal);assert(result.accepted);
      assert.equal(result.next.profile.coins,wallet+expected);assert.deepEqual(result.next.attempt.board,before.attempt.board);
      assert.equal(result.next.attempt.stockRestores??0,before.attempt.stockRestores??0);
      assert(purchaseHelper(result.next,'undo'));
      const afterPurchase=result.next.profile.coins,twice=dispatch(result.next,{type:'undo'},deal);
      assert(twice.accepted);assert.equal(twice.next.profile.coins,afterPurchase);
      record('Stock restore',next,{available:true,quote,acquired:true,consumed:true,undoRefund:expected,
        origin:'reachable draw/recycle control under purchased Unlimited; fixed functional clock, no human timing claim',failure:null},before);
    }
  }
  {
    const next=clone(save),card=Object.values(deal.cards).find(c=>!c.leader&&next.attempt.board.faceUp.includes(c.id)&&
      Object.values(deal.cards).some(o=>!o.leader&&o.id!==c.id&&o.category===c.category&&next.attempt.board.faceUp.includes(o.id)));
    const before=definitionCount(next),text=card&&revealRelatedWord(next,deal,card.id),consumed=definitionCount(next)===before-1;
    record('Definition',next,{available:Boolean(card),quote:'linked-word charge',acquired:'existing single charge',consumed,relatedWord:text??null,
      semanticUsefulness:'HUMAN_REVIEW_REQUIRED',failure:consumed?null:'NO_VISIBLE_LINKED_WORD'});
  }
  // Naturally exhausted trajectories, no artificial budget reduction or solver-UNKNOWN conversion.
  for(const bot of ['foundation','reveal']as const){
    const end=runIndependent(deal,bot);if(end.board.phase!=='exhausted')continue;
    const attempts=[];const remaining=end.board.tableau.flat().length+end.board.stock.length+end.board.waste.length+end.board.foundations.flat().length;
    const proxy=Math.min(30,Math.max(5,5*Math.ceil(Math.fround(Math.fround(.5*remaining)/5))));
    for(const amount of [...new Set([10,20,proxy])]){
      const board:Board={...end.board,phase:'playing',movesLeft:amount},deadline=performance.now()+1400;
      const known=knownContinuation(board,deal),found=known?{status:'FOUND',path:known}:findReferenceRoute(deal,board,3000,true,deadline,'verified-specials',continuationLookup(board,deal,deadline));
      let cost:number|null=null;if(found.status==='FOUND'&&found.path){const won=replayIndependent(board,found.path,deal);assert.equal(won.phase,'won');cost=amount-won.movesLeft!;}
      attempts.push({amount,proofStatus:cost===null?'UNKNOWN':'PROVEN',cost,counterfactual:amount!==10});
    }
    const loss=clone(save);loss.attempt.board=end.board;clearUndo(loss.attempt);const check=findContinue(loss.attempt,deal,3000,performance.now()+1400);
    let consumed=false;if(check.status==='PROVEN_RECOVERABLE')consumed=buyContinue(loss,{attemptId:loss.attempt.id,deal,path:check.path});
    recoveries.push({level,bot,remaining,attempts,actualPlus10:check.status,paid900:consumed,
      originalCoefficientAndCap:'UNKNOWN; .5/30/min5 is explicitly a hypothetical research control'});
  }
  console.log('PLAYTEST246_HELPER_LEVEL '+JSON.stringify({profile,level,rows:rows.length}));
}
// Stress the existing300-frame contract on an actually reachable larger board.
// This separate high-wallet fixture tests storage/refunds, not M1 affordability.
let longSave=snapshot(94).save;const longDeal=findDeal(longSave.attempt.dealId)!;
longSave.profile.coins=100000;assert(buyUnlimitedAccess(longSave,longDeal,'long-history-functional-clock',1000));
for(let i=0;i<350;i++){
  const quote=restoreQuote(longSave.attempt,longDeal);
  if(quote!==undefined)assert(restoreCampaignStock(longSave,longDeal,{attemptId:longSave.attempt.id,revision:longSave.revision,cost:quote}));
  else{const next=dispatch(longSave,{type:longSave.attempt.board.stock.length?'draw':'recycle'},longDeal);assert(next.accepted);longSave=next.next;}
}
assert.equal(longSave.attempt.undo.length,300);
const encoded=serializeSave(longSave),rawBytes=Buffer.byteLength(JSON.stringify(longSave));longSave=clone(longSave);
const refundable=longSave.attempt.restoreUndo?.entries.reduce((n,e)=>n+e.debit,0)??0,wallet=longSave.profile.coins;
longSave.profile.undos=300;
for(let i=0;i<300;i++){const next=dispatch(longSave,{type:'undo'},longDeal);assert(next.accepted);longSave=next.next;}
assert.equal(longSave.profile.coins,wallet+refundable);assert.equal(longSave.attempt.undo.length,0);
assert.equal(dispatch(longSave,{type:'undo'},longDeal).accepted,false);
const history={level:94,physical:longDeal.initial.stock.length+longDeal.initial.tableau.flat().length,
  frames:300,rawBytes,encodedBytes:Buffer.byteLength(encoded),refundable,all300UndoAccepted:true,
  nativeSaveLimitBytes:4*1024*1024,functionalClock:'fixed; no Android timing claim'};
assert(history.encodedBytes<history.nativeSaveLimitBytes);
const report={profile,controlledWallet:2000,initialHelperStock:{hints:0,undos:0,jokers:0,random:0,shuffles:0,definitions:1},semanticUsefulness:'HUMAN_REVIEW_REQUIRED',history,
  rows,recoveries,ms:Math.round(performance.now()-start),rss:process.memoryUsage().rss};
mkdirSync('.recording/issue246',{recursive:true});writeFileSync(`.recording/issue246/helpers-${profile}.json`,JSON.stringify(report,null,2)+'\n');
console.log('PLAYTEST246_HELPERS '+JSON.stringify({...report,rows:rows.length,recoveries:recoveries.length}));
