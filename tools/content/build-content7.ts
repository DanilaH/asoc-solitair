/** Staged authoring: never changes the live catalog before all eighty are accepted. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {content7Recipes,materialize} from './content7-recipes';
import {content7Witness} from './content7-witness';
import {applyBoard,assertBoard} from '../../src/domain/engine';
import {advance} from '../qa/gameplay-oracle';
import {imageByCard} from '../../src/content/topics';
for(const recipe of content7Recipes)materialize(recipe);
const end=Number(process.env.C7_STAGE??15),out=[];
const authoringSourceSHA256=createHash('sha256').update(await readFile('tools/content/content7-recipes.ts')).digest('hex');
const routeFinderSHA256=createHash('sha256').update(await readFile('tools/content/content7-witness.ts')).digest('hex');
await mkdir('.authoring/content7',{recursive:true});
for(const recipe of content7Recipes.filter(r=>r.level<=end)){
 const d=materialize(recipe);assertBoard(d.initial,d);
 const prefix=recipe.level===29?[{type:'transfer' as const,from:{kind:'tableau' as const,index:0},to:{kind:'tableau' as const,index:3}}]:[];
 let start=structuredClone(d.initial);for(const a of prefix){const x=applyBoard(start,a,d);if(typeof x==='string')throw Error(x);start=x.board;}
 const route=content7Witness({...d,initial:start},30000,recipe.level===18);const found=route?{...route,path:[...prefix,...route.path]}:null;if(!found)throw Error(`${d.id}: no bounded witness`);
 d.winningPath=found.path;d.initial.movesLeft=recipe.level<=2?null:found.path.length+Math.max(4,Math.ceil(found.path.length*.25));
 let b=structuredClone(d.initial),oracle=structuredClone(b);
 for(const a of d.winningPath){const x=applyBoard(b,a,d),y=advance(oracle,a,d);if(typeof x==='string'||!y||JSON.stringify(x.board)!==JSON.stringify(y))throw Error(`${d.id}: independent replay disagreement`);b=x.board;oracle=y;assertBoard(b,d);}
 if(b.phase!=='won')throw Error(`${d.id}: witness did not win`);
 const record={deal:d,author:{signature:recipe.signature,rationale:recipe.rationale,authoredSeed:null,sourceRevision:'b612420fda4d8677073034a91c944c46573cbf08',initialSha256:createHash('sha256').update(JSON.stringify(d.initial)).digest('hex'),witnessSearchVisited:found.visited,independentReplay:'PASS'}};
 out.push(record);await writeFile(`.authoring/content7/stage-${end}.json`,JSON.stringify(out,null,2)+'\n');console.log(`${recipe.level}: ${Object.keys(d.cards).length} cards / ${found.path.length} actions / ${d.initial.movesLeft??'∞'} budget / ${recipe.signature}`);
}
await mkdir('.authoring/content7',{recursive:true});await writeFile(`.authoring/content7/stage-${end}.json`,JSON.stringify(out,null,2)+'\n');
if(process.env.C7_FREEZE==='1'){
 if(end!==80||out.length!==80)throw Error('Only the complete eighty-level bank can be frozen');
 const records=out.map(({deal},i)=>{const recipe=content7Recipes[i],{cards,...definition}=deal;
  return{...definition,topics:recipe.topics.map((id,j)=>({id,count:recipe.counts[j],images:Object.keys(imageByCard).filter(k=>k.startsWith(id+'_')).map(k=>Number(k.slice(id.length+1))).filter(n=>n<=recipe.counts[j])})),
   ...(recipe.sequence?{sequence:recipe.sequence}:{}),...(recipe.keys?{keyCards:recipe.keys.map(s=>recipe.topics[s.charCodeAt(0)-97]+(s.length>1?'_'+s.slice(1):''))}:{}),};
 });
 await writeFile('src/content/campaign-v7.json',JSON.stringify(records,null,2)+'\n');
 await mkdir('docs/qa/content-v7',{recursive:true});
 await writeFile('docs/qa/content-v7/design.json',JSON.stringify({contentVersion:7,baseline:'b612420fda4d8677073034a91c944c46573cbf08',researchRevision:'8ca270d8f58fad2fff3d66cf700131fa74eada9b',authoring:'Literal offline layouts; no seed search or runtime randomness',authoringSourceSHA256,routeFinderSHA256,levels:out.map((r,i)=>({level:r.deal.campaignLevel,...r.author,contrast:content7Recipes[i].rationale}))},null,2)+'\n');
}
