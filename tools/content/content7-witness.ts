/** Production-engine route finder for literal authored boards, not a random dealer. */
import {applyBoard,legalCommands,packet} from '../../src/domain/engine';
import type {Board,BoardCommand,Deal} from '../../src/domain/types';
export function content7Witness(d:Deal,limit=30000,noLower=false){
 type N={b:Board;path:BoardCommand[];score:number};const heap:N[]=[],seen=new Map<string,number>();
 const key=(b:Board)=>JSON.stringify([d.lock?b.tableau:b.tableau.map(c=>c.join(',')).sort(),b.foundations.map(c=>c.join(',')).sort(),b.stock,b.waste,[...b.faceUp].sort(),b.collected.slice().sort(),b.keys??[]]);
 const score=(b:Board,g:number)=>(Object.keys(d.cards).length-b.collected.length)*3-b.foundations.flat().length*.9-b.tableau.reduce((s,_,i)=>s+Math.max(0,packet(b,i,d).length-1),0)*.28+b.stock.length*.5+g*.62;
 const push=(n:N)=>{const k=key(n.b);if((seen.get(k)??Infinity)<=n.path.length)return;seen.set(k,n.path.length);heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].score<=n.score)break;heap[i]=heap[p];i=p;}heap[i]=n;};
 const pop=()=>{const n=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(last.score<=heap[c].score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return n;};
 push({b:d.initial,path:[],score:score(d.initial,0)});let visited=0;
 while(heap.length&&visited++<limit){const n=pop();if(n.b.phase==='won')return{path:n.path,visited};if(n.path.length>=100)continue;
  const emptyF=n.b.foundations.findIndex(c=>!c.length),emptyT=n.b.tableau.findIndex(c=>!c.length);
  for(const a of legalCommands(n.b,d)){
   if(a.type==='transfer'){
    if(noLower&&a.to.kind==='tableau')continue;
    if(a.to.kind==='foundation'&&!n.b.foundations[a.to.index].length&&a.to.index!==emptyF)continue;
    if(a.to.kind==='tableau'&&!n.b.tableau[a.to.index].length&&(a.to.index!==emptyT||a.from.kind==='tableau'&&packet(n.b,a.from.index,d).length===n.b.tableau[a.from.index].length))continue;
   }
   const x=applyBoard(n.b,a,d);if(typeof x==='string')continue;const path=[...n.path,a];push({b:x.board,path,score:score(x.board,path.length)});
  }
 }
 return null;
}
