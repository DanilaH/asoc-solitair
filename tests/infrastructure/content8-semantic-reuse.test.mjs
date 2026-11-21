import assert from 'node:assert/strict';
import test from 'node:test';
import { auditSemanticPacing, loadPublishedC8 } from '../../tools/qa/audit-c8-semantic-reuse.mjs';

const row=(level,topics,structure={tableau:3,foundations:3,stock:5,totalCards:12,budget:20})=>
  ({level,dealId:'synthetic-'+level,topics,structure});

test('distinct topic IDs, per-deal uniqueness, and reuse gap are not confused with random deck cards',()=>{
  const report=auditSemanticPacing([
    row(1,['alpha','beta']),row(2,['gamma','beta']),
    row(3,['gamma','delta']),row(4,['alpha','epsilon'])
  ]);
  assert.equal(report.full.levels,4);
  assert.equal(report.full.uniqueThemeIds,5);
  assert.equal(report.full.themeReferences,8);
  assert.equal(report.full.minimumReuseGap,1);
  assert.equal(report.full.repeatOccurrences,3);
  assert.equal(report.full.adjacentLevelPairsWithOverlap,2);
  assert.equal(report.full.adjacentThemeOccurrences,2);
  assert.equal(report.late.levels,0);
});

test('a duplicated, empty, noncontiguous or unversioned level is a data error, not a novelty estimate',()=>{
  assert.throws(()=>auditSemanticPacing([row(1,['a','a'])]),/Duplicated topic/);
  assert.throws(()=>auditSemanticPacing([row(1,[])]),/No topics/);
  assert.throws(()=>auditSemanticPacing([row(1,['a']),row(3,['b'])]),/Noncontiguous/);
  assert.throws(()=>auditSemanticPacing([{...row(1,['a']),dealId:''}]),/Missing immutable/);
});

test('actual current Content8 authoring documents the semantic repetition gap separately from solved-path QA',()=>{
  const {rows,sourceDigest,sourceFiles}=loadPublishedC8();
  const report=auditSemanticPacing(rows);
  assert.equal(rows.length,80);
  assert.equal(rows[0].level,1);
  assert.equal(rows.at(-1).level,80);
  assert.equal(report.full.uniqueThemeIds,78);
  assert.equal(report.full.themeReferences,862);
  assert.equal(report.full.minimumReuseGap,1);
  assert.equal(report.full.adjacentLevelPairsWithOverlap,3);
  assert.equal(report.full.adjacentThemeOccurrences,8);
  assert.equal(report.late.levels,49);
  assert.equal(report.late.uniqueThemeIds,78);
  assert.equal(report.late.themeReferences,574);
  assert.equal(report.late.minimumReuseGap,6);
  assert.equal(report.late.adjacentLevelPairsWithOverlap,0);
  assert.deepEqual(report.latePeriod7,{comparedPairs:42,identicalStructurePairs:42});
  assert.deepEqual(report.late.sourceNumericGeometryProfiles.map(x=>x.levels),[7,21,14,7]);
  assert.match(sourceDigest,/^[a-f0-9]{64}$/);
  assert.equal(sourceFiles.length,4);
  // These are observed source-current regression values, NOT targets that
  // forbid more original-language content in future immutable deal versions.
});
