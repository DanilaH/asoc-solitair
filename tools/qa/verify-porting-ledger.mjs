#!/usr/bin/env node
/**
 * Check the REAL consumer adoption ledger against a byte-identical, pinned
 * snapshot of mini-games-kit source inventory.
 *
 * This is LOCAL PINNED SOURCE COVERAGE, not a live kit checkout or proof that
 * all vendor features were discovered. Update kit inventory, source pin and
 * consumer ledger together when a source feature changes.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const allowedStatuses = new Set([
  'RESEARCHED', 'EVIDENCE_GAP', 'ROADMAPPED', 'IN_PROGRESS',
  'IMPLEMENTED_UNVERIFIED', 'ACCEPTED', 'DEFERRED', 'BLOCKED', 'OWNER_EXCLUDED',
]);
const allowedTiers = new Set([
  'VIDEO_OBSERVED', 'ASSET_VERIFIED', 'NATIVE_STATIC', 'MODEL_PARITY',
  'ORIGINAL_RUNTIME', 'METADATA', 'INFERRED', 'UNKNOWN',
]);
const requiredStage = /^[A-G][1-9]\d?$/;
const featureId = /^[a-z][a-z0-9-]+$/;
const has = value => typeof value === 'string' && value.trim().length > 0;

export function gitBlobSha(content) {
  return createHash('sha1').update('blob ' + Buffer.byteLength(content) + '\0').update(content).digest('hex');
}

function byId(rows, kind, errors) {
  const entries = new Map();
  if (!Array.isArray(rows)) {
    errors.push(kind + '.features must be an array');
    return entries;
  }
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== 'object' || !featureId.test(row.id ?? '')) {
      errors.push(kind + ': invalid row/id at index ' + index);
      continue;
    }
    if (entries.has(row.id)) errors.push(kind + ': duplicate ' + row.id);
    entries.set(row.id, row);
  }
  return entries;
}

export function validatePortingInventory(source, ledger, roadmap, agents, rawSource) {
  const errors = [];
  if (source?.schema !== 'reference-feature-inventory-v1') errors.push('Unexpected kit source schema');
  if (ledger?.schema !== 'consumer-adoption-ledger-v1') errors.push('Unexpected consumer ledger schema');
  if (ledger?.sourceInventoryBlob !== gitBlobSha(rawSource)) {
    errors.push('Source inventory snapshot does not match pinned Git blob SHA in consumer ledger');
  }
  if (!has(ledger?.sourceInventoryRef) || !has(ledger?.sourceInventoryUrl)) {
    errors.push('Missing source inventory revision/link in consumer ledger');
  }
  const src = byId(source?.features, 'source', errors);
  const dst = byId(ledger?.features, 'consumer', errors);
  for (const [id, feature] of src) {
    if (!dst.has(id)) errors.push('SILENTLY OMITTED source feature: ' + id);
    if (!has(feature.name) || !has(feature.sourceEvidence) ||
        !has(feature.originalBuild) || !has(feature.knownLimit)) {
      errors.push('Missing provenance/evidence/limit for ' + id);
    }
    if (!allowedTiers.has(feature.evidenceTier)) errors.push('Unsupported evidence tier: ' + id);
    if (!/^https:\/\/github\.com\/DanilaH\/mini-games-kit\/blob\/[0-9a-f]{40}\/research\/games\/association-solitaire\//.test(feature.sourceEvidence)) {
      errors.push('Non-versioned or invalid source evidence URL: ' + id);
    }
  }
  for (const [id, record] of dst) {
    if (!src.has(id)) errors.push('UNLINKED consumer feature: ' + id);
    if (!allowedStatuses.has(record.status)) errors.push('Invalid status ' + record.status + ': ' + id);
    if (!has(record.currentImplementation)) errors.push('Missing current implementation disposition: ' + id);
    if (!has(record.nextAction) && record.status !== 'ACCEPTED' && record.status !== 'OWNER_EXCLUDED') {
      errors.push('Missing next action: ' + id);
    }
    if (!has(record.stage) || !requiredStage.test(record.stage)) errors.push('Missing/invalid stage: ' + id);
    if (['BLOCKED', 'DEFERRED'].includes(record.status) && !has(record.reason)) {
      errors.push('Missing blocked/deferred reason: ' + id);
    }
    if (record.status === 'DEFERRED' && !has(record.nextAction)) errors.push('Deferred with no reentry: ' + id);
    if (record.status === 'OWNER_EXCLUDED' && !has(record.ownerDecisionRef)) {
      errors.push('Unapproved permanent exclusion: ' + id);
    }
    if (['IN_PROGRESS', 'IMPLEMENTED_UNVERIFIED', 'ACCEPTED'].includes(record.status) &&
        !has(record.implementationPR) && !has(record.currentImplementation)) {
      errors.push('Implemented without code or PR: ' + id);
    }
    if (record.status === 'ACCEPTED' && !has(record.acceptanceEvidence)) {
      errors.push('Accepted with no acceptance evidence: ' + id);
    }
    const row = '| ' + String.fromCharCode(96) + id + String.fromCharCode(96) + ' |';
    // Count actual Markdown table rows, not arbitrary substrings: a literal escaped \\n
    // must not silently satisfy the complete reference-to-product coverage gate.
    const appearances = roadmap.split(/\r?\n/).filter(line => line.startsWith(row)).length;
    if (appearances !== 1) errors.push('Missing/duplicate roadmap row: ' + id + ' (' + appearances + ')');
    if (!roadmap.includes('### ' + record.stage + '.')) {
      errors.push('Stage not found in roadmap: ' + record.stage);
    }
  }
  for (const key of ['docs/porting/PORTING_POLICY.md', 'docs/porting/ADOPTION_LEDGER.json',
                     'docs/porting/IMPLEMENTATION_ROADMAP_2026-11-19.md']) {
    if (!agents.includes(key)) errors.push('AGENTS missing owner governance reference: ' + key);
  }
  if (agents.includes('Do not add excluded systems:')) {
    errors.push('Stale agent-authored global feature prohibition resurrected');
  }
  return errors;
}

export function verifyPinnedFiles(root = project) {
  const base = resolve(root, 'docs/porting/');
  const raw = readFileSync(resolve(base, 'SOURCE_FEATURES_PINNED.json'), 'utf8');
  const source = JSON.parse(raw);
  const ledger = JSON.parse(readFileSync(resolve(base, 'ADOPTION_LEDGER.json'), 'utf8'));
  const roadmap = readFileSync(resolve(base, 'IMPLEMENTATION_ROADMAP_2026-11-19.md'), 'utf8');
  const agents = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
  const errors = validatePortingInventory(source, ledger, roadmap, agents, raw);
  return { source: source.features.length, mapped: ledger.features.length,
    pinnedBlob: gitBlobSha(raw), ownerExcluded: ledger.features.filter(x => x.status === 'OWNER_EXCLUDED').length, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = verifyPinnedFiles();
  console.log(JSON.stringify({ ...report, result: report.errors.length ? 'FAIL' : 'PINNED_LOCAL_COVERAGE_PASS',
    note: 'No live kit HEAD comparison and no claim about vendor-research exhaustiveness' }, null, 2));
  if (report.errors.length) process.exitCode = 1;
}
