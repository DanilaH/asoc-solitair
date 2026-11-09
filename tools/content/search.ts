import { applyBoard, legalCommands, packet } from '../../src/domain/engine';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
function random(seed: number) { let n=seed; return () => { n=(Math.imul(n,1664525)+1013904223)>>>0; return n/4294967296; }; }
function shuffle<T>(items: T[], rng: () => number) { for(let i=items.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items; }
export function authorInitial(plan: { columns: number; depth: number; slots: number }, cards: Deal['cards'], seed: number): Board {
  const ids=shuffle(Object.keys(cards),random(seed)), tableau=Array.from({length:plan.columns},()=>[] as string[]);
  for(let row=0;row<plan.depth;row++)for(const col of tableau)if(ids.length)col.push(ids.shift()!);
  return {tableau,foundations:Array.from({length:plan.slots},()=>[]),stock:ids,waste:[],faceUp:tableau.map(col=>col.at(-1)!).filter(Boolean),collected:[],movesLeft:200,phase:'playing'};
}
interface Node { board: Board; path: BoardCommand[]; score: number }
const key = (b: Board) => JSON.stringify([b.tableau.map(col=>col.join(',')).sort(),b.foundations.map(col=>col.join(',')).sort(),b.stock,b.waste,[...b.faceUp].sort(),[...b.collected].sort()]);
export function findWitness(deal: Deal, limit=20000): {path: BoardCommand[]; visited:number} | null {
  const heap:Node[]=[], seen=new Map<string,number>();
  const push=(n:Node)=>{heap.push(n);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].score<=n.score)break;heap[i]=heap[p];i=p;}heap[i]=n;};
  const pop=()=>{const result=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(last.score<=heap[c].score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return result;};
  const score=(b:Board,g:number)=>g*.48+(Object.keys(deal.cards).length-b.collected.length)*2+b.stock.length*.7+b.tableau.reduce((n,col)=>n+col.filter(id=>!b.faceUp.includes(id)).length,0)*.8;
  push({board:deal.initial,path:[],score:score(deal.initial,0)});let visited=0;
  while(heap.length&&visited++<limit){
    const node=pop(), k=key(node.board), cost=node.path.length;
    if(seen.has(k)&&seen.get(k)!<=cost)continue;seen.set(k,cost);
    if(node.board.phase==='won')return{path:node.path,visited};
    if(cost>=85)continue;
    for(const cmd of legalCommands(node.board,deal)){
      if(cmd.type==='transfer'&&cmd.from.kind==='tableau'&&cmd.to.kind==='tableau'&&!node.board.tableau[cmd.to.index].length&&packet(node.board,cmd.from.index,deal).length===node.board.tableau[cmd.from.index].length)continue;
      const result=applyBoard(node.board,cmd,deal);if(typeof result==='string')continue;
      const nextKey=key(result.board);if(seen.has(nextKey)&&seen.get(nextKey)!<=cost+1)continue;
      push({board:result.board,path:[...node.path,cmd],score:score(result.board,cost+1)});
    }
  }
  return null;
}
