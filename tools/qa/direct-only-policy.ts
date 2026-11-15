/** Port of supplied model/direct-only.mjs, same candidate order, LCG and stopping rule. */
import {applyBoard,boardKey,freshAttempt} from '../../src/domain/engine';
import type{BoardCommand,Deal,Location}from'../../src/domain/types';
export function directOnly(deal:Deal,seed:number){
 let board=freshAttempt(deal,'audit-'+seed).board,randomState=seed,reason='terminal';
 const path:BoardCommand[]=[],seen=new Set<string>();
 const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 while(board.phase==='playing'&&path.length<150){
  const key=boardKey(board);if(seen.has(key)){reason='repeated-board-no-progress';break;}seen.add(key);
  const candidates:{action:BoardCommand;result:Exclude<ReturnType<typeof applyBoard>,string>}[]=[];
  const empty=board.foundations.findIndex(x=>!x.length),sources:Location[]=[...board.tableau.map((_,index)=>({kind:'tableau' as const,index})),{kind:'waste',index:0}];
  for(const from of sources)for(let i=0;i<board.foundations.length;i++){
   if(!board.foundations[i].length&&i!==empty)continue;
   const action:BoardCommand={type:'transfer',from,to:{kind:'foundation',index:i}},result=applyBoard(board,action,deal);if(typeof result!=='string')candidates.push({action,result});
  }
  let selected=candidates.length?candidates[seed===0?0:Math.floor(random()*candidates.length)]:null;
  if(!selected){const action:BoardCommand={type:board.stock.length?'draw':'recycle'},result=applyBoard(board,action,deal);if(typeof result==='string'){reason='no-direct-action';break;}selected={action,result};}
  board=selected.result.board;path.push(selected.action);
 }
 if(path.length>=150)reason='step-cap';
 return{seed,outcome:board.phase,reason,steps:path.length,draws:path.filter(a=>a.type==='draw').length,recycles:path.filter(a=>a.type==='recycle').length,movesLeft:board.movesLeft,path};
}
