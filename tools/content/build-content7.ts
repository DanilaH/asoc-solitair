/** Staged authoring: never changes the live catalog before all eighty are accepted. */
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {content7Recipes,materialize} from './content7-recipes';
import {content7Witness} from './content7-witness';
import {applyBoard,assertBoard} from '../../src/domain/engine';
import {advance} from '../qa/gameplay-oracle';
for(const recipe of content7Recipes)materialize(recipe);
const end=Number(process.env.C7_STAGE??15),out=[];
await mkdir('.authoring/content7',{recursive:true});
for(const recipe of content7Recipes.filter(r=>r.level<=end)){
 const d=materialize(recipe);assertBoard(d.initial,d);
 const found=content7Witness(d);if(!found)throw Error(`${d.id}: no bounded witness`);
 d.winningPath=found.path;d.initial.movesLeft=recipe.level<=2?null:found.path.length+Math.max(4,Math.ceil(found.path.length*.25));
 let b=structuredClone(d.initial),oracle=structuredClone(b);
 for(const a of d.winningPath){const x=applyBoard(b,a,d),y=advance(oracle,a,d);if(typeof x==='string'||!y||JSON.stringify(x.board)!==JSON.stringify(y))throw Error(`${d.id}: independent replay disagreement`);b=x.board;oracle=y;assertBoard(b,d);}
 if(b.phase!=='won')throw Error(`${d.id}: witness did not win`);
 const record={deal:d,author:{signature:recipe.signature,rationale:recipe.rationale,authoredSeed:null,sourceRevision:'b612420fda4d8677073034a91c944c46573cbf08',initialSha256:createHash('sha256').update(JSON.stringify(d.initial)).digest('hex'),witnessSearchVisited:found.visited,independentReplay:'PASS'}};
 out.push(record);await writeFile(`.authoring/content7/stage-${end}.json`,JSON.stringify(out,null,2)+'\n');console.log(`${recipe.level}: ${Object.keys(d.cards).length} cards / ${found.path.length} actions / ${d.initial.movesLeft??'∞'} budget / ${recipe.signature}`);
}
await mkdir('.authoring/content7',{recursive:true});await writeFile(`.authoring/content7/stage-${end}.json`,JSON.stringify(out,null,2)+'\n');
