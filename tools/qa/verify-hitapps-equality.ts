import assert from 'node:assert/strict';
import bank from '../../src/content/campaign-v8-equality-attested.json' with { type: 'json' };
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import type { EqualityManifest } from '../../src/domain/equality-attestation';
import type { Board, BoardCommand } from '../../src/domain/types';
import { verifyEqualityBankEntry } from '../content/hitapps-equality-bank';

const entries = bank as { manifest: EqualityManifest; sha256: string; initial: Board; route: BoardCommand[] }[];
assert.equal(new Set(entries.map(entry => entry.manifest.dealId)).size, entries.length);
for (const { manifest, sha256, initial, route } of entries) {
  const base = content8Wave.find(deal => deal.id === manifest.baseId);
  assert(base);
  const deal = { ...base, id: manifest.dealId, version: manifest.dealVersion,
    initial, winningPath: route, recoveryPaths: undefined };
  assert(verifyEqualityBankEntry(base, { deal, manifest }, sha256), `Unverifiable Equality board: ${deal.id}`);
}
console.log(`Verified Equality bank entries: ${entries.length}. Archival seed 47 is save-compatible only.`);
