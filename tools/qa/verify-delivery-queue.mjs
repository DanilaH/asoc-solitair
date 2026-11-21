/**
 * Delivery queue: pure, dependency-free consumer-side source feature coverage.
 * This is a project planning/implementation gate, NOT original binary parity.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read = name => JSON.parse(readFileSync(resolve(root,name),'utf8'));
const gates = new Set(['READY_LOCAL','PHYSICAL_ANDROID','SOURCE_EVIDENCE',
  'OWNER_ACTIVATION_GATE','MERCHANT_ELIGIBILITY','RELEASE_GATE']);
const states = new Set(['QUEUED','IN_PROGRESS','ENGINEERING_VERIFIED','NEEDS_DEVICE',
  'BLOCKED_EXTERNAL','NEEDS_OWNER','ACCEPTED','FAILED']);
const sha = value => /^[0-9a-f]{40}$/.test(String(value||''));

export function validateDeliveryQueue(queue, pinned, ledger) {
  assert.equal(queue?.schema,'asoc-autonomous-delivery-queue-v1');
  assert.equal(pinned?.features?.length,114,'Pinned source feature inventory missing 114');
  assert.equal(ledger?.features?.length,114,'Consumer source feature ledger missing 114');
  assert.equal(queue?.sourcePin?.sourceInventoryRef,ledger.sourceInventoryRef);
  assert.equal(queue?.sourcePin?.sourceInventoryBlob,ledger.sourceInventoryBlob);
  assert(sha(queue?.sourcePin?.sourceInventoryBlob),'Missing immutable source Git blob pin');
  assert(sha(queue?.sourcePin?.baselineContent8Head),'Missing Content8 code baseline');
  assert(sha(queue?.sourcePin?.runtimeKitCommit),'Missing exact mini-games-kit runtime pin');
  assert(Array.isArray(queue.packets) && queue.packets.length===38,'P00..P37 full delivery queue missing');
  const source=new Map(pinned.features.map(x=>[x.id,x]));
  const current=new Map(ledger.features.map(x=>[x.id,x]));
  assert.equal(source.size,114,'Duplicate source ID');
  assert.equal(current.size,114,'Duplicate consumer ledger ID');
  assert.deepEqual([...current.keys()].sort(),[...source.keys()].sort(),'Missing/unregistered source ID');
  const seen=new Set(),owner=new Map(),statusCounts={},gatesCounts={};
  queue.packets.forEach((p,index)=>{
    assert.equal(p.id,'P'+String(index).padStart(2,'0'),'Queue order changed or duplicate ID');
    assert.equal(p.order,index,'Numeric package order mismatch');
    assert(typeof p.title==='string'&&p.title.length>=8,'Package title missing');
    assert(states.has(p.state),'Unrecognized package work state '+p.id);
    assert(gates.has(p.entryGate),'Unrecognized evidence gate '+p.id);
    assert(Array.isArray(p.dependsOn)&&new Set(p.dependsOn).size===p.dependsOn.length,'Duplicate package dependency '+p.id);
    assert(Array.isArray(p.sourceFeatureIds),'Package source owner list missing '+p.id);
    assert(typeof p.spec==='string'&&p.spec.startsWith('docs/porting/specs/')&&p.spec.endsWith('.md'),'Missing package spec '+p.id);
    assert(typeof p.acceptanceTarget==='string'&&p.acceptanceTarget.length>10,'Package exit target missing '+p.id);
    assert(Array.isArray(p.deliverables)&&p.deliverables.length>=3,'Delivery acceptance omitted '+p.id);
    for(const dep of p.dependsOn)assert(seen.has(dep),'Unresolved/forward dependency '+p.id+' -> '+dep);
    seen.add(p.id);
    for(const id of p.sourceFeatureIds){
      assert(source.has(id),'Package '+p.id+' invents source feature '+id);
      assert(!owner.has(id),'Source feature assigned to multiple primary packages: '+id);
      owner.set(id,p.id);
    }
    statusCounts[p.state]=(statusCounts[p.state]||0)+1;
    gatesCounts[p.entryGate]=(gatesCounts[p.entryGate]||0)+1;
  });
  assert.equal(owner.size,source.size,'Source feature left without an owning package');
  assert.equal(Object.keys(queue.sourceFeatureOwner||{}).length,114,'Owner crosswalk should cover all 114');
  for(const [id,packet] of owner)assert.equal(queue.sourceFeatureOwner[id],packet,'Primary owner crosswalk mismatch for '+id);
  assert.equal(queue.coverage?.totalSourceFeatures,undefined,'Do not duplicate a drift-prone legacy sourceTotal field');
  assert.equal(queue.coverage?.sourceIds,114);
  assert.equal(queue.coverage?.assignedSourceIds,114);
  assert.equal(queue.coverage?.packets,38);
  assert.equal(queue.coverage?.excludedSourceIds,0,'A source system may not be excluded by researcher');
  assert.equal(ledger.features.filter(x=>x.status==='OWNER_EXCLUDED').length,0,
    'Current owner scope is full, exceptions need explicit owner evidence and queue policy revision');
  return {schema:'asoc-delivery-queue-check-v1',
    packages:queue.packets.length,assignedSourceIds:owner.size,
    states:statusCounts,entryGates:gatesCounts,
    sourceBlob:queue.sourcePin.sourceInventoryBlob,
    baseline:queue.sourcePin.baselineContent8Head};
}

export function checkDeliveryFiles(queue,progressText,dir=root) {
  for(const p of queue.packets) {
    const spec=resolve(dir,p.spec);
    assert(existsSync(spec),'Uncreated technical specification: '+p.spec);
    const markdown=readFileSync(spec,'utf8');
    assert(markdown.includes('P'+p.id.slice(1)),
      'Technical specification does not mention '+p.id+' in '+p.spec);
    const row=new RegExp('^\\| '+p.id+' \\| ([A-Z_]+) \\|','m').exec(progressText);
    assert(row,'Missing progress row for '+p.id);
    assert.equal(row[1],p.state,'Queue status/progress row mismatch for '+p.id);
  }
}

if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  const pinnedRaw=readFileSync(resolve(root,'docs/porting/SOURCE_FEATURES_PINNED.json'));
  const gitBlob=createHash('sha1').update(Buffer.from('blob '+pinnedRaw.length+'\0')).update(pinnedRaw).digest('hex');
  const ledger=read('docs/porting/ADOPTION_LEDGER.json');
  const queue=read('docs/porting/DELIVERY_QUEUE.json');
  const result=validateDeliveryQueue(queue,JSON.parse(pinnedRaw.toString('utf8')),ledger);
  assert.equal(gitBlob,ledger.sourceInventoryBlob,'Pinned source snapshot changed without ledger sync');
  const pkg=read('package.json');
  assert(pkg.dependencies['@danilah/mini-games-kit'].endsWith('#'+queue.sourcePin.runtimeKitCommit),
    'Kit runtime dependency pin drift');
  checkDeliveryFiles(queue,readFileSync(resolve(root,'docs/porting/DELIVERY_PROGRESS.md'),'utf8'));
  console.log('DELIVERY_QUEUE_GATE '+JSON.stringify(result));
}
