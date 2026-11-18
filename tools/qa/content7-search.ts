/** Independent bounded best-first search. Uses only the audit oracle transitions.
 * FOUND proves a legal route; UNKNOWN never proves a deadlock or optimality. */
import {identity,options,group} from './gameplay-oracle';
import type {Board,BoardCommand,Deal} from '../../src/domain/types';
export function independentRoute(d:Deal,input=d.initial,restriction:'none'|'no-lower'|'no-empty'='none',limit=12000){
 type N={b:Board;path:BoardCommand[];score:number};const heap:N[]=[],seen=new Map<string,number>();
 const push=(n:N)=>{const k=identity(n.b,d);if((seen.get(k)??Infinity)<=n.path.length)return;seen.set(k,n.path.length);heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].score<=n.score)break;heap[i]=heap[p];i=p;}heap[i]=n;};
 const pop=()=>{const n=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(last.score<=heap[c].score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return n;};
 const score=(b:Board,n:number)=>(Object.keys(d.cards).length-b.collected.length)*2.6+b.stock.length*.5+b.tableau.reduce((s,c)=>s+c.filter(id=>!b.faceUp.includes(id)).length,0)*1.1-b.foundations.flat().length*.78-b.tableau.reduce((s,_,i)=>s+Math.max(0,group(b,i,d).length-1),0)*.16+n*.5;
 push({b:structuredClone(input),path:[],score:score(input,0)});let visited=0;
 while(heap.length&&visited<limit){const n=pop(),k=identity(n.b,d),cost=n.path.length;if((seen.get(k)??Infinity)<cost)continue;visited++;
  if(n.b.phase==='won')return{status:'FOUND' as const,path:n.path,visited};
  if(cost>=110)continue;
  const emptyF=n.b.foundations.findIndex(c=>!c.length),emptyT=n.b.tableau.findIndex(c=>!c.length);
  for(const x of options(n.b,d,true)){
   const a=x.action;if(a.type==='transfer'){
    if(a.to.kind==='foundation'&&!n.b.foundations[a.to.index].length&&a.to.index!==emptyF)continue;
    if(a.to.kind==='tableau'&&(restriction==='no-lower'||!n.b.tableau[a.to.index].length&&(restriction==='no-empty'||a.to.index!==emptyT)))continue;
   }
   const nextCost=cost+1;if((seen.get(identity(x.board,d))??Infinity)<=nextCost)continue;push({b:x.board,path:[...n.path,a],score:score(x.board,nextCost)});
  }
 }
 return{status:(heap.length?'UNKNOWN':'UNSOLVABLE') as 'UNKNOWN'|'UNSOLVABLE',path:[] as BoardCommand[],visited};
}
