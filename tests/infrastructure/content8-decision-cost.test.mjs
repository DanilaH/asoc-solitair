import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeQ1Decisions } from '../../tools/qa/c8-decision-cost.mjs';

const row = level => ({bank:'campaign',level,dealId:'fixture-'+level,slots:[],budget:10,
  witnessLength:5,probes:[]});
const make = () => ({schema:1,rows:Array.from({length:80},(_,i)=>row(i+1))});
const probe=(route,movesLeft,kind='other-transfer',outcome='WIN')=>({
  kind,phase:'early',step:2,budget:9,witness:'d',action:'t0>t1',prefix:'',
  outcome,proof:'oracle',...(outcome==='WIN'?{route,movesLeft,loopsBack:false}:{})
});
test('separates cheaper/equal/costlier certified routes from unknown transfers',()=>{
  const fixture=make();
  fixture.rows[1].probes=[
    probe('d d d',5),  // baseline 5, alternative 5
    probe('d',7),      // alternative saves two moves relative to non-optimal witness
    probe('d d d d d',3), // alternative spends two more
    probe(undefined,undefined,'transfer-vs-stock','UNKNOWN')
  ];
  const result=analyzeQ1Decisions(fixture);
  assert.equal(result.rows,80);
  assert.equal(result.campaign.wins,3);
  assert.equal(result.campaign.unknown,1);
  assert.equal(result.campaign.cheaperThanWitness,1);
  assert.equal(result.campaign.equalToWitness,1);
  assert.equal(result.campaign.costlierThanWitness,1);
  assert.deepEqual(result.campaign.deltaMoves,{min:-2,p25:-2,median:0,p75:0,max:2});
  assert.equal(result.unknownTransfersByKind['transfer-vs-stock'],1);
  assert.equal(result.exampleExpensive[0].extraMovesVsWitness,2);
  assert.equal(result.exampleCheaper[0].extraMovesVsWitness,-2);
});
test('rejects an incomplete or inconsistent certificate rather than inventing regret',()=>{
  const testCase=make();
  testCase.rows[4].probes=[probe('d d',4)]; // should be movesLeft=6
  assert.throws(()=>analyzeQ1Decisions(testCase),/move conservation/);
  testCase.rows[4].probes=[probe('d d',6)];
  testCase.rows[4].probes[0].budget=8;
  assert.throws(()=>analyzeQ1Decisions(testCase),/budget inconsistent/);
});
test('supports an unlimited tutorial budget without assigning a fake cost',()=>{
  const testCase=make();
  testCase.rows[0].budget=null;
  testCase.rows[0].probes=[{...probe('d d d',null),budget:null}];
  const output=analyzeQ1Decisions(testCase);
  assert.equal(output.campaign.wins,1);
  assert.equal(output.campaign.knownMoveDeltas,0);
  assert.equal(output.campaignRows[0].witnessMovesLeft,null);
});
test('rejects duplicate scenarios and incomplete main catalog',()=>{
  const testCase=make();
  testCase.rows[1].dealId=testCase.rows[0].dealId;
  testCase.rows[1].level=testCase.rows[0].level;
  assert.throws(()=>analyzeQ1Decisions(testCase),/duplicate scenario/);
  testCase.rows.pop();
  assert.throws(()=>analyzeQ1Decisions(testCase),/full active 1-80 campaign/);
});
