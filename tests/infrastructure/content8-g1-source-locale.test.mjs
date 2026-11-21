import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { auditSemanticPacing,loadPublishedC8 } from '../../tools/qa/audit-c8-semantic-reuse.mjs';

const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const featureSource=read('docs/porting/SOURCE_FEATURES_PINNED.json');
const ledger=read('docs/porting/ADOPTION_LEDGER.json');
const source=read('docs/qa/content-v8/g1-structure-locale-matrix.json');

test('G1 source-to-product mapping covers all five native/asset/video/metadata features',()=>{
  const checked=new Map(source.featureCoverage.map(x=>[x.id,x]));
  const pinned=new Map(featureSource.features.map(x=>[x.id,x]));
  const active=ledger.features.filter(x=>x.stage==='G1');
  assert.equal(active.length,5);
  assert.equal(checked.size,5);
  assert.deepEqual([...checked.keys()].sort(),active.map(x=>x.id).sort());
  for(const item of active){
    const row=checked.get(item.id),ref=pinned.get(item.id);
    assert(row&&ref,'Missing source evidence '+item.id);
    assert.equal(row.sourceEvidenceTier,ref.evidenceTier);
    assert.equal(row.sourceEvidenceRef,ref.sourceEvidence);
    assert.notEqual(item.status,'OWNER_EXCLUDED');
  }
});

test('G1 original 2000-row source statistics stay separate from current 80-level product',()=>{
  const s=source.original,p=source.product;
  assert.equal(s.levelCount,2000);
  assert.equal(s.distinctThemeIds,4539);
  assert.equal(s.themeReferences,16062);
  assert.equal(s.minTopicReuseGap,162);
  assert.equal(s.adjacentOverlap,0);
  assert.equal(s.sevenCycleStartsAt,551);
  assert.equal(s.sevenCycleMatchingLatePairs,1443);
  assert.equal(s.localThemeBanks,33);
  assert.equal(s.themeIdsPerBank,4539);
  assert.equal(s.enVsRuThemesWithMemberCountDifferences,1357);
  assert.equal(s.enVsRuPotentialLevelCardCountDifferences,1687);
  assert.equal(s.packagedSpriteSets,90);
  assert.equal(s.matchingSpriteCountsWithWords,89);
  assert.deepEqual(s.conditionalAffectedOriginalLevels,[44,884,1290,1974]);
  assert.equal(s.addressablesDefinitionLocales,36);
  assert.equal(s.addressablesDefinitionBundles,468);
  assert.equal(s.originalLiveLocaleBudgetVerified,false);
  assert.equal(s.originalLiveRemoteOverrideCaptured,false);
  assert.equal(p.sourceParityNotClaimed,true);
  assert.equal(p.humanNoveltyEvidence,'NOT_EXECUTED');
});

test('G1 actual authored ordinary/special campaign repeats at observed intervals',()=>{
  const {rows}=loadPublishedC8();
  const report=auditSemanticPacing(rows);
  const p=source.product;
  assert.equal(report.full.levels,p.freshCampaignLevels);
  assert.equal(report.full.uniqueThemeIds,p.uniqueThemeIds);
  assert.equal(report.full.themeReferences,p.themeReferences);
  assert.equal(report.full.minimumReuseGap,p.minTopicReuseGap);
  assert.equal(report.full.adjacentLevelPairsWithOverlap,p.adjacentLevelPairsWithOverlap);
  assert.equal(report.full.adjacentThemeOccurrences,p.adjacentThemeOccurrences);
  assert.equal(report.late.levels,p.lateLevels);
  assert.deepEqual(report.late.range,p.lateLevelRange);
  assert.equal(report.late.uniqueThemeIds,p.lateUniqueThemeIds);
  assert.equal(report.late.themeReferences,p.lateThemeReferences);
  assert.equal(report.late.minimumReuseGap,p.lateMinTopicReuseGap);
  assert.deepEqual(report.latePeriod7,{
    comparedPairs:p.lateComparedSevenStepPairs,
    identicalStructurePairs:p.lateEqualSevenStepStructuralPairs
  });
  assert.deepEqual(Object.fromEntries(report.late.sourceNumericGeometryProfiles.map(
    x=>[String(x.structure.totalCards),x.levels])),p.lateProfileCountsByCards);
});
