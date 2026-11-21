import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateDeliveryQueue, checkDeliveryFiles } from '../../tools/qa/verify-delivery-queue.mjs';

const read=name=>JSON.parse(readFileSync(new URL('../../'+name,import.meta.url),'utf8'));
const snapshot=()=>({
  queue:read('docs/porting/DELIVERY_QUEUE.json'),
  source:read('docs/porting/SOURCE_FEATURES_PINNED.json'),
  ledger:read('docs/porting/ADOPTION_LEDGER.json')
});

test('all 114 discovered systems have exactly one responsible packet across P00..P37',()=>{
  const {queue,source,ledger}=snapshot();
  const report=validateDeliveryQueue(queue,source,ledger);
  assert.equal(report.packages,38);
  assert.equal(report.assignedSourceIds,114);
  const progress=readFileSync(new URL('../../docs/porting/DELIVERY_PROGRESS.md',import.meta.url),'utf8');
  checkDeliveryFiles(queue,progress);
});

test('an original feature omitted from the queue must fail closed',()=>{
  const {queue,source,ledger}=snapshot();
  const owner=queue.sourceFeatureOwner['hitapps-stock-dealer'];
  const target=queue.packets.find(x=>x.id===owner);
  target.sourceFeatureIds.splice(target.sourceFeatureIds.indexOf('hitapps-stock-dealer'),1);
  assert.throws(()=>validateDeliveryQueue(queue,source,ledger),/Source feature left without/);
});

test('one source feature cannot be silently assigned to two different implementation packets',()=>{
  const {queue,source,ledger}=snapshot();
  queue.packets.find(x=>x.id==='P17').sourceFeatureIds.push('hitapps-stock-dealer');
  assert.throws(()=>validateDeliveryQueue(queue,source,ledger),/multiple primary packages/);
});

test('a forward, absent or cyclic dependency does not masquerade as an executable queue',()=>{
  const {queue,source,ledger}=snapshot();
  queue.packets[1].dependsOn.push('P24');
  assert.throws(()=>validateDeliveryQueue(queue,source,ledger),/Unresolved\/forward dependency/);
});

test('a source registry pin or promised label is not allowed to drift silently',()=>{
  const {queue,source,ledger}=snapshot();
  queue.sourcePin.sourceInventoryBlob='0'.repeat(40);
  assert.throws(()=>validateDeliveryQueue(queue,source,ledger),/Expected values to be strictly equal/);
  queue.sourcePin.sourceInventoryBlob=ledger.sourceInventoryBlob;
  queue.packets[4].state='ORIGINAL_PARITY';
  assert.throws(()=>validateDeliveryQueue(queue,source,ledger),/Unrecognized package work state/);
});

test('package status changes must update the human progress record together',()=>{
  const {queue}=snapshot();
  const progress=readFileSync(new URL('../../docs/porting/DELIVERY_PROGRESS.md',import.meta.url),'utf8');
  queue.packets[0].state='ACCEPTED';
  assert.throws(()=>checkDeliveryFiles(queue,progress),/Queue status\/progress row mismatch/);
});
