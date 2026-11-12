/** Audit-only second implementation. No production transition/packet/legal helpers. */
import type { Board, BoardCommand, Deal, Location } from '../../src/domain/types';
export function locked(b: Board, i: number, d: Deal) { return d.lock?.column === i && !d.lock.requiredKeys.every(k => b.keys?.includes(k)); }
function validGroup(ids: string[], d: Deal) {
  const c=d.cards[ids[0]]?.category;
  if(!ids.every(id=>d.cards[id].category===c))return false;
  if(!Object.values(d.cards).some(x=>x.category===c&&x.ordered))return true;
  const ranks=ids.filter(id=>!d.cards[id].leader).map(id=>d.cards[id].rank!).sort((a,b)=>a-b);
  return !(ids.some(id=>d.cards[id].leader)&&ranks.length&&ranks[0]!==1)&&ranks.every((r,i)=>i===0||r===ranks[i-1]+1);
}
export function group(b:Board,i:number,d:Deal):string[]{
  const col=b.tableau[i]; if(!col||locked(b,i,d))return[];
  const edge=b.joker?.column===i?b.joker.boundary:0;
  let j=col.length; while(j>edge&&b.faceUp.includes(col[j-1])&&validGroup(col.slice(j-1),d))j--;
  return col.slice(j);
}
export function advance(input:Board,a:BoardCommand,d:Deal):Board|null{
  if(input.phase!=='playing')return null;
  const b=structuredClone(input);
  const expose=(id:string|undefined)=>{if(!id||b.faceUp.includes(id))return;b.faceUp.push(id);const key=d.cards[id].keyId;if(key&&!(b.keys??=[]).includes(key)){b.keys.push(key);if(d.lock&&!locked(b,d.lock.column,d))expose(b.tableau[d.lock.column].at(-1));}};
  if(a.type==='draw'){const id=b.stock.shift();if(!id)return null;b.waste.push(id);b.faceUp.push(id);}
  else if(a.type==='recycle'){if(b.stock.length||!b.waste.length)return null;const closed=new Set(b.waste);b.stock=[...b.waste];b.waste=[];b.faceUp=b.faceUp.filter(id=>!closed.has(id));}
  else{
    if(a.from.kind===a.to.kind&&a.from.index===a.to.index)return null;
    const ids=a.from.kind==='tableau'?group(b,a.from.index,d):a.from.kind==='waste'?b.waste.slice(-1):[];
    if(!ids.length||a.to.kind==='waste')return null;
    const target=a.to.kind==='foundation'?b.foundations[a.to.index]:b.tableau[a.to.index];if(!target)return null;
    const lead=ids.some(id=>d.cards[id].leader),cat=d.cards[ids[0]].category;
    let available:string[]=[];
    if(a.to.kind==='foundation'){
      if(!target.length&&!lead||target.length&&(d.cards[target[0]].category!==cat||lead))return null;
      available=target;
    }else{
      if(locked(b,a.to.index,d))return null;
      available=group(b,a.to.index,d);
      if(b.joker?.column===a.to.index){if(target.length>b.joker.boundary)return null;}
      else if(target.length&&(!available.length||d.cards[available[0]].category!==cat))return null;
      if((b.rulesVersion??3)>=3&&available.some(id=>d.cards[id].leader))return null;
    }
    const merged=[...available,...ids];if(!validGroup(merged,d))return null;
    const normalized=[...merged.filter(id=>!d.cards[id].leader).sort((a,b)=>(d.cards[a].rank??0)-(d.cards[b].rank??0)),...merged.filter(id=>d.cards[id].leader)];
    if(a.to.kind==='foundation')b.foundations[a.to.index]=normalized;
    else b.tableau[a.to.index]=[...target.slice(0,target.length-available.length),...normalized];
    if(a.from.kind==='waste')b.waste.pop();
    else{const col=b.tableau[a.from.index];col.splice(col.length-ids.length,ids.length);if(b.joker?.column===a.from.index&&col.length===b.joker.boundary)delete b.joker;expose(col.at(-1));}
    if(a.to.kind==='foundation'&&normalized.length===Object.values(d.cards).filter(c=>c.category===cat).length){b.collected.push(...normalized);b.foundations[a.to.index]=[];}
  }
  if(b.movesLeft!==null)b.movesLeft--;
  b.phase=b.collected.length===Object.keys(d.cards).length?'won':b.movesLeft===0?'exhausted':'playing';return b;
}
export function options(b:Board,d:Deal,prune=false):{action:BoardCommand;board:Board}[]{
  const out:{action:BoardCommand;board:Board}[]=[],sources:Location[]=[...b.tableau.map((_,index)=>({kind:'tableau' as const,index})),{kind:'waste',index:0}],targets:Location[]=[...b.foundations.map((_,index)=>({kind:'foundation' as const,index})),...b.tableau.map((_,index)=>({kind:'tableau' as const,index}))];
  for(const from of sources)for(const to of targets){
    if(prune&&from.kind==='tableau'&&to.kind==='tableau'&&!b.tableau[to.index].length&&group(b,from.index,d).length===b.tableau[from.index].length)continue;
    const action:BoardCommand={type:'transfer',from,to},board=advance(b,action,d);if(board)out.push({action,board});
  }
  const action:BoardCommand={type:b.stock.length?'draw':'recycle'},board=advance(b,action,d);if(board)out.push({action,board});return out;
}
export function identity(b:Board,d:Deal){return JSON.stringify([b.rulesVersion??3,d.lock||b.joker?b.tableau:b.tableau.map(c=>c.join(',')).sort(),b.foundations.map(c=>c.join(',')).sort(),b.stock,b.waste,[...b.faceUp].sort(),[...b.collected].sort(),b.keys??[],b.joker??null]);}
/** Exhaustive BFS when SOLVED/UNSOLVABLE; bounded UNKNOWN is never a failure proof. */
export function search(b:Board,d:Deal,limit=10000){
 const q=[{board:b,path:[] as BoardCommand[]}],seen=new Map([[identity(b,d),b.movesLeft??Infinity]]);let i=0;
 while(i<q.length&&i<limit){const n=q[i++];if(n.board.phase==='won')return{status:'SOLVED' as const,path:n.path,visited:i};for(const x of options(n.board,d,true)){const k=identity(x.board,d),rem=x.board.movesLeft??Infinity;if((seen.get(k)??-1)>=rem)continue;seen.set(k,rem);q.push({board:x.board,path:[...n.path,x.action]});}}
 return {status:i<q.length?'UNKNOWN' as const:'UNSOLVABLE' as const,path:[] as BoardCommand[],visited:i};
}
