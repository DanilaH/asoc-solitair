import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL('../../'+name,import.meta.url),'utf8'));
const source=read('docs/porting/SOURCE_FEATURES_PINNED.json');
const ledger=read('docs/porting/ADOPTION_LEDGER.json');
const evidence=read('docs/qa/content-v8/f-source-event-matrix.json');
const task=evidence.azurDailyTasks;

test('the full F1/F2/F3 inventory remains source-tier exact, independently staged and not owner-excluded',()=>{
  const ids=new Map(source.features.map(x=>[x.id,x]));
  const active=ledger.features.filter(x=>['F1','F2','F3'].includes(x.stage));
  const refs=new Map(evidence.featureCoverage.map(x=>[x.id,x]));
  assert.equal(active.length,23);
  assert.equal(refs.size,23,'no duplicate or missing F IDs');
  assert.deepEqual([...refs.keys()].sort(),active.map(x=>x.id).sort());
  assert.deepEqual(Object.fromEntries(['F1','F2','F3'].map(stage=>
    [stage,active.filter(x=>x.stage===stage).length])),{F1:12,F2:6,F3:5});
  for(const item of active) {
    const s=ids.get(item.id),row=refs.get(item.id);
    assert(s && row,'pinned source and research row are mandatory: '+item.id);
    assert.equal(row.pinnedSourceTier,s.evidenceTier,item.id);
    assert.equal(row.sourceEvidence,s.sourceEvidence,item.id);
    assert.equal(row.stage,item.stage,item.id);
    assert.notEqual(item.status,'OWNER_EXCLUDED','Only owner can exclude a source mechanic: '+item.id);
  }
});

test('AZUR DailyTasks retains all 16 functional task kinds including commercial/use-helper kinds',()=>{
  const tasks=new Map(task.taskEnum.map(x=>[x.name,x.value]));
  assert.equal(tasks.size,17,'Unknown fallback plus 16 actual task types');
  assert.equal(tasks.get('Unknown'),0);
  assert.deepEqual([...tasks.values()].sort((a,b)=>a-b),Array.from({length:17},(_,i)=>i));
  for(const name of ['CompleteLevels','CollectThemes','ExecuteMoves','UseHints','WinNoHints',
    'DrawCards','DailyLogin','CollectDailyBonuses','UseDefinitions','UseJokers',
    'UseRollbacks','UseShuffles','EarnCoins','BuyExtraMoves','BuyBoosters','MakePurchase'])
    assert(Number.isInteger(tasks.get(name)),'Missing source task: '+name);
  assert.equal(task.liveTaskDistributionVerified,false);
});

test('all nine source reward enums remain distinguishable from actual granted rewards',()=>{
  const rewards=new Map(task.rewardEnum.map(x=>[x.name,x.value]));
  assert.equal(rewards.size,9);
  assert.deepEqual([...rewards.values()].sort((a,b)=>a-b),Array.from({length:9},(_,i)=>i));
  for(const name of ['Coins','MoveHint','Undo','Definition','Shuffle','Joker','Medals',
    'RandomBoostersChest','CardBack']) assert(rewards.has(name),'Missing reward '+name);
  assert.equal(task.originalRewardsObserved,false);
  const defaults=task.compiledDefaults;
  assert.deepEqual(defaults,{daily_tasks_per_day:4,daily_tasks_event_duration_days:7,
    daily_tasks_default_unlock_level:2,daily_tasks_default_unlock_day:1});
  assert.equal(evidence.source.originalLiveEventObserved,false);
});
