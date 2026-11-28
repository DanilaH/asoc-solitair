import { applyBoard, boardKey, legalCommands } from '../../src/domain/engine';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import { advance } from './gameplay-oracle';
import { isDeepStrictEqual } from 'node:util';

export type DecisionPolicy='foundation'|'reveal';
export function independentStep(board:Board,action:BoardCommand,deal:Deal){
  const actual=applyBoard(board,action,deal), oracle=advance(board,action,deal);
  if(typeof actual==='string'||!oracle||!isDeepStrictEqual(actual.board,oracle))throw Error('Independent oracle mismatch '+deal.id);
  return actual;
}
export function replayIndependent(board:Board,path:readonly BoardCommand[],deal:Deal){
  for(const action of path)board=independentStep(board,action,deal).board;
  return board;
}
export function observedKey(board:Board,deal:Deal){
  const up=new Set(board.faceUp), special=Boolean(board.joker||Object.values(board.hitapps?.cards??{}).some(c=>c.ice||c.bound||c.lock||c.puzzle||c.order||c.gold));
  const columns=board.tableau.map(p=>p.map(id=>up.has(id)?id:'?').join(','));
  return JSON.stringify([special?columns:columns.sort(),board.foundations.map(p=>p.join(',')).sort(),board.stock.length,
    board.waste,board.collected.slice().sort(),board.recyclesLeft,board.joker,
    Object.entries(board.hitapps?.cards??{}).filter(([id])=>up.has(id)).map(([id,c])=>[id,c.ice,c.bound,c.lock?.collected,c.gold?.health]),board.hitapps?.spent]);
}
export function chooseIndependent(board:Board,deal:Deal,policy:DecisionPolicy,seen:Set<string>){
  const hidden=(b:Board)=>b.tableau.flat().filter(id=>!b.faceUp.includes(id)).length;
  const home=(b:Board)=>b.collected.length+b.foundations.flat().length;
  const choices=legalCommands(board,deal).flatMap(action=>{
    const result=applyBoard(board,action,deal);if(typeof result==='string'||seen.has(observedKey(result.board,deal)))return[];
    const next=result.board, completed=next.collected.length-board.collected.length,progress=home(next)-home(board),
      reveal=hidden(board)-hidden(next),empty=next.tableau.filter(p=>!p.length).length-board.tableau.filter(p=>!p.length).length;
    const score=next.phase==='won'?1e9:completed*100+progress*(policy==='foundation'?35:8)+reveal*(policy==='reveal'?48:12)+empty*6+
      result.events.filter(e=>['key','unlock','ice','cut','unbind','assemble'].includes(e.type)).length*16+
      (action.type==='draw'?4:action.type==='recycle'?1:action.type==='transfer'&&action.from.kind==='waste'?2:-5);
    return [{action,score}];
  });
  choices.sort((a,b)=>b.score-a.score||JSON.stringify(a.action).localeCompare(JSON.stringify(b.action)));
  return choices[0]?.action;
}
export function runIndependent(deal:Deal,policy:DecisionPolicy,initial=deal.initial){
  let board=structuredClone(initial),firstCollect:number|null=null,actions=0;
  const seen=new Set<string>(),classes:Record<string,number>={};
  while(board.phase==='playing'&&actions<600){
    seen.add(observedKey(board,deal));const action=chooseIndependent(board,deal,policy,seen);if(!action)break;
    const cls=action.type==='transfer'?action.to.kind:action.type;classes[cls]=(classes[cls]??0)+1;
    board=independentStep(board,action,deal).board;actions++;
    if(firstCollect===null&&board.collected.length)firstCollect=actions;
  }
  return {policy,status:board.phase==='playing'?'POLICY_STUCK':board.phase,actions,classes,firstCollect,left:board.movesLeft,
    stateHash:boardKey(board),board};
}
