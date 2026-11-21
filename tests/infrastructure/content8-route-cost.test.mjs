import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeRouteCosts } from '../../tools/qa/summarize-c8-route-cost.mjs';

const win = (changes={}) => ({
  phase:'early',step:2,budget:10,kind:'other-transfer',witnessRemainingActions:5,
  witness:'t0>f0',prefix:'d d',action:'r',route:'d d d d',
  outcome:'WIN',proof:'oracle',alternativeActions:7,actionsVsWitness:2,
  movesLeft:3,witnessMovesLeft:5,loopsBack:false,...changes
});
const unknown={phase:'late',step:7,budget:10,kind:'transfer-vs-stock',
  witnessRemainingActions:2,witness:'d',prefix:'',action:'t1>f0',
  outcome:'UNKNOWN',proof:'search-limit'};
const row={bank:'campaign',level:70,dealId:'synthetic-level70',dealDigest:'fixture-sha',slots:[],
  probes:[win(),unknown,win({phase:'middle',step:5,kind:'other-target',
    witness:'t2>f0',prefix:'',action:'t2>f1',route:'d d',
    alternativeActions:3,witnessRemainingActions:5,
    actionsVsWitness:-2,budget:9,movesLeft:6,witnessMovesLeft:4,loopsBack:true})]};
const fixture={schema:1,rows:[row]};

test('Q1b counts verified route cost relative to the correct witness suffix, not the whole original path',()=>{
  const summary=summarizeRouteCosts(fixture,{allowPartial:true});
  assert.equal(summary.main.WIN,2);
  assert.equal(summary.main.UNKNOWN,1);
  assert.equal(summary.main.NO_WIN,0);
  assert.equal(summary.main.foundPathsWithExtraActions,1);
  assert.equal(summary.main.foundPathsWithFewerActions,1);
  assert.deepEqual(summary.main.routeDeltaRange,{min:-2,median:-2,max:2});
  assert.equal(summary.main.demonstratedWinsThatLoopToPivot,1);
  assert.equal(summary.mainTransfers.probes,3);
  assert.equal(summary.demonstratedExpensiveExamples[0].actionsVsWitness,2);
});
test('Q1b refuses a fabricated replay length or budget',()=>{
  const bad={...fixture,rows:[{...row,probes:[win({alternativeActions:6})]}]};
  assert.throws(()=>summarizeRouteCosts(bad,{allowPartial:true}),/alternative route length/);
  const badBudget={...fixture,rows:[{...row,probes:[win({movesLeft:2})]}]};
  assert.throws(()=>summarizeRouteCosts(badBudget,{allowPartial:true}),/budget from pivot/);
});
test('Q1b keeps unresolved search separate from proof of dead ends',()=>{
  const result=summarizeRouteCosts({schema:1,rows:[{...row,probes:[unknown]}]},{allowPartial:true});
  assert.equal(result.main.UNKNOWN,1);
  assert.equal(result.main.WIN,0);
  assert.equal(result.main.NO_WIN,0);
  assert.equal(result.main.routeDeltaRange,null);
  assert.equal(result.unresolvedEarlyTransferExamples.length,1);
});
test('Q1b rejects an incomplete all-campaign run rather than reporting 1 level as 80',()=>{
  assert.throws(()=>summarizeRouteCosts(fixture),/Unexpected main campaign count/);
});
