import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyMove, loadPublishedPassports, summarize
} from '../../tools/qa/audit-c8-decision-evidence.mjs';

const mock = (level, move='d', missedWaste=true) => ({
  level, cards:64, steps:99, slack:13, recycles:0,
  forcedStock:4, optionalStock:30,
  choices:{
    tested:3, unresolved:1, otherWins:1,
    choices:[{step:12, move, extraActions:1, missedWaste}]
  }
});

test('choice type is based on actual command, not on generic otherWins field', () => {
  assert.equal(classifyMove('d'),'stock_draw');
  assert.equal(classifyMove('r'),'stock_recycle');
  assert.equal(classifyMove('t0>f1'),'card_transfer');
  assert.equal(classifyMove('w0>t4'),'card_transfer');
  assert.equal(classifyMove('t2>t3'),'card_transfer');
  assert.equal(classifyMove('foo'),'unclassified');
});

test('only missed-waste draw alternatives do not certify diverse card transfers', () => {
  const result=summarize([mock(16),mock(17)]);
  assert.equal(result.all.certifiedSelectedAlternatives,2);
  assert.equal(result.all.alternativesByType.card_transfer,0);
  assert(result.warnings.includes('NO_DIFFERENT_TRANSFER_BRANCH_CERTIFIED'));
  assert(result.warnings.includes('ALL_SELECTED_ALTERNATIVES_ARE_MISSED_WASTE_ACTIONS'));
  assert(result.warnings.includes('CHOICE_PROBES_UNRESOLVED_ARE_NOT_LOSS_PROOFS'));
});

test('diverse transfer choice removes that specific coverage warning', () => {
  const result=summarize([mock(16),mock(17,'t0>f0',false)]);
  assert.equal(result.all.alternativesByType.card_transfer,1);
  assert.equal(result.all.alternativesByType.stock_draw,1);
  assert(!result.warnings.includes('NO_DIFFERENT_TRANSFER_BRANCH_CERTIFIED'));
  assert(!result.warnings.includes('ALL_SELECTED_ALTERNATIVES_ARE_MISSED_WASTE_ACTIONS'));
});

test('invalid or noncontiguous passport data fail instead of padding counts', () => {
  assert.throws(()=>summarize([mock(16),mock(18)]),/Noncontiguous/);
  assert.throws(()=>summarize([mock(16),mock(16)]),/Duplicate/);
  assert.throws(()=>summarize([{...mock(16),choices:{tested:1}}]),/Incomplete/);
  assert.throws(()=>summarize([{...mock(16),choices:{tested:1,unresolved:0,otherWins:0,
    choices:[{move:'unknown',extraActions:1,missedWaste:false}]}}]),/Unclassifiable/);
});

test('published C8 source passports are contiguous and every retained choice has provenance', () => {
  const rows=loadPublishedPassports();
  const report=summarize(rows);
  assert.equal(rows.length,65);
  assert.deepEqual(report.all.levelRange,[16,80]);
  assert.equal(report.all.certifiedSelectedAlternatives,
    rows.reduce((total,row)=>total+row.choices.choices.length,0));
  assert.equal(report.all.witnessRecycles,
    rows.reduce((total,row)=>total+row.recycles,0));
  assert.equal(report.all.alternativesByType.card_transfer,
    rows.flatMap(row=>row.choices.choices).filter(c=>classifyMove(c.move)==='card_transfer').length);
  assert.equal(report.stages.late.levels,49);
  assert.equal(report.evidence.includes('NOT human gameplay'),true);
});
