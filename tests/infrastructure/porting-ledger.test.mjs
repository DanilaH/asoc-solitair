import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validatePortingInventory, gitBlobSha, verifyPinnedFiles } from '../../tools/qa/verify-porting-ledger.mjs';

const raw = readFileSync(new URL('../../docs/porting/SOURCE_FEATURES_PINNED.json', import.meta.url), 'utf8');
const source = JSON.parse(raw);
const ledger = JSON.parse(readFileSync(new URL('../../docs/porting/ADOPTION_LEDGER.json', import.meta.url), 'utf8'));
const roadmap = readFileSync(new URL('../../docs/porting/IMPLEMENTATION_ROADMAP_2026-11-19.md', import.meta.url), 'utf8');
const agents = readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8');
const inspect = (src = source, game = ledger, map = roadmap, notes = agents, snapshot = raw) =>
  validatePortingInventory(src, game, map, notes, snapshot);
const hasError = (errors, target) => errors.some(e => e.includes(target));

test('real pinned kit snapshot ↔ consumer ledger ↔ complete roadmap passes', () => {
  const report = verifyPinnedFiles();
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  assert.equal(report.source, report.mapped);
  assert.equal(report.ownerExcluded, 0);
  assert.equal(report.pinnedBlob, gitBlobSha(raw));
});

test('reject missing researched mechanism even if roadmap unchanged', () => {
  const changed = structuredClone(ledger);
  const missingId = changed.features.pop().id;
  assert(hasError(inspect(source, changed), 'SILENTLY OMITTED source feature: ' + missingId));
});

test('reject duplicate source or ledger ID and orphan', () => {
  const changed = structuredClone(ledger);
  changed.features.push({ ...changed.features[0] });
  changed.features.push({ id: 'out-of-nowhere', status: 'ROADMAPPED', currentImplementation: 'None', nextAction: 'Audit', stage: 'F1' });
  const errors = inspect(source, changed);
  assert(hasError(errors, 'duplicate'));
  assert(hasError(errors, 'UNLINKED consumer feature'));
});

test('reject agent REJECT even with a present feature ID', () => {
  const changed = structuredClone(ledger);
  changed.features[0].status = 'REJECT';
  assert(hasError(inspect(source, changed), 'Invalid status'));
});

test('only an explicit owner decision permits permanent exclusion', () => {
  const changed = structuredClone(ledger);
  changed.features[0].status = 'OWNER_EXCLUDED';
  delete changed.features[0].ownerDecisionRef;
  assert(hasError(inspect(source, changed), 'Unapproved permanent exclusion'));
});

test('deferred or blocked mechanisms must retain concrete reentry and reason', () => {
  const changed = structuredClone(ledger);
  changed.features[0].status = 'DEFERRED';
  delete changed.features[0].reason;
  delete changed.features[0].nextAction;
  assert(hasError(inspect(source, changed), 'Missing blocked/deferred reason'));
  assert(hasError(inspect(source, changed), 'Deferred with no reentry'));
});

test('accepted status requires actual acceptance evidence', () => {
  const changed = structuredClone(ledger);
  changed.features[0].status = 'ACCEPTED';
  delete changed.features[0].acceptanceEvidence;
  assert(hasError(inspect(source, changed), 'Accepted with no acceptance evidence'));
});

test('pinned snapshot SHA cannot silently drift', () => {
  const changed = structuredClone(ledger);
  changed.sourceInventoryBlob = '0'.repeat(40);
  assert(hasError(inspect(source, changed), 'Source inventory snapshot does not match'));
});

test('a product mechanic cannot disappear from the staged roadmap', () => {
  const target = ledger.features[0];
  const line = '| ' + String.fromCharCode(96) + target.id + String.fromCharCode(96) + ' |';
  const altered = roadmap.replace(roadmap.split('\n').find(l => l.startsWith(line)) + '\n', '');
  assert(hasError(inspect(source, ledger, altered), 'Missing/duplicate roadmap row'));
});

test('source must have actual stable evidence URL and known limit', () => {
  const changed = structuredClone(source);
  changed.features[0].sourceEvidence = 'https://github.com/DanilaH/mini-games-kit/blob/main/bogus.md';
  changed.features[0].evidenceTier = 'PRECISE_NATIVE' ;
  const errors = inspect(changed);
  assert(hasError(errors, 'Non-versioned or invalid'));
  assert(hasError(errors, 'Unsupported evidence tier'));
});

test('stale AGENTS prohibitions are a governance regression', () => {
  assert(hasError(inspect(source, ledger, roadmap, agents + '\nDo not add excluded systems: ...'), 'Stale agent-authored'));
});
