/** Complete finite restricted BFS using only the separate oracle's transitions.
 * No production applyBoard, legalCommands, packet or authoring state key. */
import{advance}from'./gameplay-oracle';import type{Board,BoardCommand,Deal,Location}from'../../src/domain/types';
export function oracleRoute(d:Deal,input=d.initial,restriction:'none'|'no-lower'|'no-empty'='none',limit=100000){
 const b=structuredClone(input);b.movesLeft=null;b.phase='playing';const key=(b:Board)=>JSON.stringify([b.tableau,b.foundations,b.stock,b.waste,[...b.faceUp].sort(),[...b.collected].sort(),b.joker??null,b.keys??[]]);
 const nodes:{b:Board;p:number;a?:BoardCommand}[]=[{b,p:-1}],seen=new Set([key(b)]);let at=0;
 for(;at<nodes.length&&at<limit;at++){
  const b=nodes[at].b;if(b.phase==='won'){const path:BoardCommand[]=[];let j=at;while(nodes[j].a){path.push(nodes[j].a!);j=nodes[j].p;}return{status:'FOUND' as const,visited:at+1,path:path.reverse()};}
  const locs:Location[]=[...b.tableau.map((_,index)=>({kind:'tableau' as const,index})),...b.foundations.map((_,index)=>({kind:'foundation' as const,index})),{kind:'waste',index:0}];
  const actions:BoardCommand[]=[{type:'draw'},{type:'recycle'}];
  for(const from of locs)for(const to of locs){if(to.kind==='waste'||restriction==='no-lower'&&to.kind==='tableau'||restriction==='no-empty'&&to.kind==='tableau'&&!b.tableau[to.index].length)continue;actions.push({type:'transfer',from,to});}
  for(const action of actions){const next=advance(b,action,d);if(!next)continue;const k=key(next);if(seen.has(k))continue;seen.add(k);nodes.push({b:next,p:at,a:action});}
 }
 return{status:(at<nodes.length?'UNKNOWN':'UNSOLVABLE') as 'UNKNOWN'|'UNSOLVABLE',visited:at,path:[] as BoardCommand[]};
}
