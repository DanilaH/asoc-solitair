import { expect, it } from 'vitest';
import { content8Wave, content8Late } from '../../src/content/campaign-v8-dealer';
import { content8Special } from '../../src/content/campaign-v8-special';
import { content8BonusDeals } from '../../src/content/campaign-v8-bonus';
import { applyBoard } from '../../src/domain/engine';
import { knownContinuation } from '../../src/domain/solver';
import { identity, options, search } from '../../tools/qa/gameplay-oracle';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';

/**
 * RESEARCH ONLY, actual fresh CORE4/5 Deal IDs.
 * Only a full alternate route replayed by production Rules 3 is certified win.
 * Budgeted UNKNOWN is NOT proof of losing branches or human difficulty.
 * No original Hitapps/AZUR app is executed here.
 */
const LEVELS=[16,17,21,22,26,30,32,38,40,45,53,66,78,80];
const SEARCH_VISIT_LIMIT=900;
const MAX_BRANCHES_PER_LEVEL=2;
type Transfer=Extract<BoardCommand,{type:'transfer'}>;
type Candidate={
 level:number;dealId:string;category:'ordinary'|'special'|'bonus';
 step:number;witnessType:BoardCommand['type'];action:Transfer;board:Board
};
const originals=[...content8Wave,...content8Late];
const sourceByLevel=new Map(originals.map(x=>[x.campaignLevel!,x]));
const replacements=new Map([...content8Special,...content8BonusDeals]
  .map(x=>[x.campaignLevel!,x]));
const provenance=(deal:Deal):Candidate['category']=>
  deal.id.includes('-special-')?'special':deal.id.includes('-bonus-')?'bonus':'ordinary';
function pivots(length:number) {
 return new Set(Array.from({length:13},(_,p)=>Math.floor((length-1)*p/12)));
}
function actionKey(a:Transfer) {
 return a.from.kind+a.from.index+'>'+a.to.kind+a.to.index;
}
function differentTransfers(deal:Deal):Candidate[] {
 const witness=deal.winningPath;
 if(!witness.length)throw Error('No witness '+deal.id);
 const at=pivots(witness.length);
 const candidates:Candidate[]=[];
 let board:Board=deal.initial;
 for(const [step,main] of witness.entries()) {
  const next=applyBoard(board,main,deal);
  if(typeof next==='string')throw Error('Bad main witness '+deal.id+' step '+step);
  if(at.has(step)) {
   const chosen=identity(next.board,deal),distinct=new Set<string>();
   for(const alt of options(board,deal,true)) {
    if(alt.action.type!=='transfer')continue;
    const result=applyBoard(board,alt.action,deal);
    if(typeof result==='string')throw Error('Oracle disagrees with actual Rules3');
    const state=identity(result.board,deal);
    if(state===chosen||distinct.has(state))continue;
    distinct.add(state);
    candidates.push({level:deal.campaignLevel!,dealId:deal.id,
      category:provenance(deal),step,witnessType:main.type,
      action:alt.action,board:result.board});
   }
  }
  board=next.board;
 }
 if(board.phase!=='won')throw Error('Published witness does not win '+deal.id);
 const result:Candidate[]=[];
 const pick=(pred:(c:Candidate)=>boolean)=>{
  const item=candidates.find(c=>pred(c)&&!result.some(x=>
   x.step===c.step&&actionKey(x.action)===actionKey(c.action)));
  if(item&&result.length<MAX_BRANCHES_PER_LEVEL)result.push(item);
 };
 // Explicitly stratify OTHER transfers and transfer-instead-of-draw;
 // do not let a stock-draw skip preempt candidate selection.
 pick(x=>x.witnessType==='transfer'&&x.action.to.kind==='tableau');
 pick(x=>x.witnessType==='transfer'&&x.action.to.kind==='foundation');
 pick(x=>x.witnessType==='draw');
 for(const c of candidates) {
  if(result.length>=MAX_BRANCHES_PER_LEVEL)break;
  pick(x=>x===c);
 }
 return result;
}
function replay(board:Board,path:BoardCommand[],deal:Deal) {
 let state=board;
 for(const step of path){
  const next=applyBoard(state,step,deal);
  if(typeof next==='string')return false;
  state=next.board;
 }
 return state.phase==='won';
}
it('independent bounded continuations after non-waste alternative transfers (stratified)',()=>{
 const report=[] as Array<{
  level:number;dealId:string;category:string;step:number;witnessType:string;
  move:string;result:string;visited:number;pathActions?:number;proof?:string
 }>;
 for(const level of LEVELS) {
  const deal=replacements.get(level)??sourceByLevel.get(level);
  if(!deal)throw Error('Missing active Content8 deal '+level);
  for(const candidate of differentTransfers(deal)) {
   let path=knownContinuation(candidate.board,deal);
   let visited=0,proof='known_route',result='UNKNOWN_LIMIT';
   if(!path) {
    proof='independent_oracle';
    const found=search(candidate.board,deal,SEARCH_VISIT_LIMIT);
    visited=found.visited;
    if(found.status==='SOLVED')path=found.path;
    else result=found.status==='UNKNOWN'?'UNKNOWN_LIMIT':'NO_WIN_FOUND_IN_BOUNDED_ORACLE';
   }
   if(path)result=replay(candidate.board,path,deal)?'VERIFIED_WIN':'MODEL_DIVERGENCE';
   report.push({
    level,dealId:deal.id,category:candidate.category,step:candidate.step,
    witnessType:candidate.witnessType,move:actionKey(candidate.action),
    result,visited,...(path?{pathActions:path.length,proof}:{})
   });
  }
 }
 const count=(state:string)=>report.filter(x=>x.result===state).length;
 const summary={
  schema:'content8-stratified-transfer-continuation-v1',
  scope:'up to 2 different transfer actions per source level sampled across 13 witness pivots',
  caution:'Positive win is replayed through actual product Rules3. UNKNOWN or bounded no-win are NOT evidence of impossible routes. No human difficulty or original parity.',
  levels:LEVELS.length,sampledTransfers:report.length,searchVisitLimit:SEARCH_VISIT_LIMIT,
  verifiedWins:count('VERIFIED_WIN'),unknownAtLimit:count('UNKNOWN_LIMIT'),
  noWinInBoundedOracle:count('NO_WIN_FOUND_IN_BOUNDED_ORACLE'),
  modelDivergences:count('MODEL_DIVERGENCE'),
  witnessTransfer:report.filter(x=>x.witnessType==='transfer').length,
  insteadOfDraw:report.filter(x=>x.witnessType==='draw').length,
  byType:Object.fromEntries(['ordinary','special','bonus'].map(kind=>[kind,{
    probes:report.filter(x=>x.category===kind).length,
    wins:report.filter(x=>x.category===kind&&x.result==='VERIFIED_WIN').length
  }])),
  winningExamples:report.filter(x=>x.result==='VERIFIED_WIN').slice(0,8),
  unresolvedExamples:report.filter(x=>x.result!=='VERIFIED_WIN').slice(0,8)
 };
 console.log('C8_TRANSFER_CONTINUATIONS '+JSON.stringify(summary));
 expect(report.length).toBeGreaterThanOrEqual(20);
 expect(summary.modelDivergences).toBe(0);
 expect(report.some(x=>x.category==='ordinary')).toBe(true);
 expect(report.some(x=>x.category==='special')).toBe(true);
 expect(report.some(x=>x.category==='bonus')).toBe(true);
},120000);
