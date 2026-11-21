import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const get = (path) => JSON.parse(readFileSync(new URL('../../' + path, import.meta.url), 'utf8'));
const pinned = get('docs/porting/SOURCE_FEATURES_PINNED.json');
const ledger = get('docs/porting/ADOPTION_LEDGER.json');
const research = get('docs/qa/content-v8/e3-source-commerce-matrix.json');

test('E3 research coverage retains exactly the current 18 original source IDs', () => {
  const source = new Map(pinned.features.map(x => [x.id, x]));
  const active = ledger.features.filter(x => x.stage === 'E3');
  const indexed = new Map(research.featureCoverage.map(x => [x.id, x]));
  assert.equal(active.length, 18);
  assert.equal(indexed.size, 18, 'E3 research registry must not contain duplicate or dropped IDs');
  assert.deepEqual([...indexed.keys()].sort(), active.map(x => x.id).sort());
  for (const feature of active) {
    const original = source.get(feature.id), entry = indexed.get(feature.id);
    assert(original, 'Missing original pinned reference ' + feature.id);
    assert.equal(entry.sourceEvidenceTier, original.evidenceTier, feature.id);
    assert.equal(entry.sourceEvidenceRef, original.sourceEvidence, feature.id);
    assert.equal(entry.consumerStage, 'E3');
    assert.notEqual(feature.status, 'OWNER_EXCLUDED', 'Only owner can exclude ' + feature.id);
  }
});

test('E3 catalog aggregate accounts for every AZUR local SKU, without inventing active store availability', () => {
  const c = research.catalogAggregate;
  assert.equal(c.productsTotal, 41);
  assert.equal(c.uniqueProductIds, 41);
  assert.equal(c.types.consumable + c.types.nonConsumable + c.types.subscription, 41);
  assert.deepEqual(c.types, { consumable: 28, nonConsumable: 13, subscription: 0 });
  assert.equal(c.emptyStoreIdArrays, 41);
  assert.equal(c.emptyPayoutArrays, 41);
  assert.equal(Object.values(c.buckets).reduce((sum,n) => sum+n,0),41);
  assert.equal(c.helperFamilies.length, 4);
  assert.deepEqual(c.helperFamilies.slice().sort(), ['Boosters','Definition','Hints','Undo'].sort());
  for (const key of ['hints_offers','undo_offers','definition_offers','boosters_offers'])
    assert.equal(c.buckets[key],5);
  assert.equal(c.goldPassTypeCode, 0, 'Gold Pass local consumable does not establish a subscription');
  assert.equal(c.originalStoreCurrencyVerified,false);
  assert.equal(c.liveBillingValidated,false);
  assert.equal(c.originalReceiptsValidated,false);
  assert.equal(research.source.merchantCodesCopied,false);
});

test('a store or seller registration cannot silently become an IAP entitlement claim', () => {
  const e = research.platformEvidence;
  assert.equal(e.rustoreSelfEmployedPaySdk.status, 'UNAVAILABLE');
  assert.equal(e.rustoreSelfEmployedPaySdk.effectiveDate,'2026-02-01');
  assert.equal(e.nashstoreSellerSelfEmployed.status,'CONTRACT_ELIGIBLE');
  assert.equal(e.nashstoreInAppPayments.status,'UNVERIFIED');
  assert.equal(e.rustoreThirdPartyProcessor.status,'UNVERIFIED');
  for (const source of Object.values(e)) assert(source.official.startsWith('https://'));
});
