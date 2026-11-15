import {applyBoard,packet,placeJoker} from '../../src/domain/engine';
import type {Board,BoardCommand,Deal} from '../../src/domain/types';
export type SearchResult={status:'FOUND'|'UNSOLVABLE'|'UNKNOWN';path:BoardCommand[];visited:number};
export function searchOpening(deal:Deal,options:{board?:Board;noLower?:boolean;noEmpty?:boolean;limit?:number}={}):SearchResult{
 const start=structuredClone(options.board??deal.initial);start.movesLeft=null;start.phase='playing';
 const key=(b:Board)=>JSON.stringify([deal.lock||b.joker?b.tableau:b.tableau.map(c=>c.join(',')).sort(),b.foundations.map(c=>c.join(',')).sort(),b.stock,b.waste,[...b.faceUp].sort(),b.joker??null,b.keys??[]]);
 const nodes:{b:Board;p:number;a?:BoardCommand}[]=[{b:start,p:-1}],seen=new Set([key(start)]);let at=0;
 for(;at<nodes.length&&at<(options.limit??80000);at++){
  const {b}=nodes[at];if(b.phase==='won'){const path:BoardCommand[]=[];let n=at;while(nodes[n].a){path.push(nodes[n].a!);n=nodes[n].p;}return{status:'FOUND',path:path.reverse(),visited:at+1};}
  const sources=[...b.tableau.map((_,index)=>({kind:'tableau' as const,index})),{kind:'waste' as const,index:0}],empty=b.foundations.findIndex(c=>!c.length),emptyT=b.tableau.findIndex(c=>!c.length);
  const targets=[...b.foundations.map((_,index)=>({kind:'foundation' as const,index})),...(!options.noLower?b.tableau.map((_,index)=>({kind:'tableau' as const,index})):[])];
  const commands:BoardCommand[]=[];
  for(const from of sources){if(from.kind==='waste'?!b.waste.length:!packet(b,from.index,deal).length)continue;for(const to of targets){
   if(from.kind===to.kind&&from.index===to.index)continue;
   if(to.kind==='foundation'&&!b.foundations[to.index].length&&to.index!==empty)continue;
   if(to.kind==='tableau'&&!b.tableau[to.index].length){if(options.noEmpty||to.index!==emptyT)continue;if(from.kind==='tableau'&&packet(b,from.index,deal).length===b.tableau[from.index].length)continue;}
   commands.push({type:'transfer',from,to});
  }}
  if(b.stock.length)commands.push({type:'draw'});else if(b.waste.length)commands.push({type:'recycle'});
  for(const cmd of commands){const r=applyBoard(b,cmd,deal);if(typeof r==='string')continue;const k=key(r.board);if(seen.has(k))continue;seen.add(k);nodes.push({b:r.board,p:at,a:cmd});}
 }
 return{status:at<nodes.length?'UNKNOWN':'UNSOLVABLE',path:[],visited:at};
}
export function bestJokerRoute(deal:Deal,limit=60000){let best:{column:number;path:BoardCommand[];visited:number}|undefined;for(let column=0;column<deal.initial.tableau.length;column++){const b=placeJoker(deal.initial,column,deal);if(typeof b==='string')continue;const r=searchOpening(deal,{board:b,limit});if(r.status==='FOUND'&&(!best||r.path.length<best.path.length))best={column,path:r.path,visited:r.visited};}return best;}
