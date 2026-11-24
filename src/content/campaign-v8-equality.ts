import { LEGACY_OWNER_PREVIEW } from '../domain/types';
import attestedBank from './campaign-v8-equality-attested.json' with { type: 'json' };
import { registerBundledEquality, type EqualityManifest } from '../domain/equality-attestation';
import bank from './campaign-v8-equality-bank.json' with { type: 'json' };
import { content8Wave } from './campaign-v8-dealer';
import type { EqualityPreviewPolicy } from '../domain/equality-issuance';
import type { Board, BoardCommand, Deal } from '../domain/types';

export const EQUALITY_PREVIEW = LEGACY_OWNER_PREVIEW === 'generation' || LEGACY_OWNER_PREVIEW === 'equality';
const base = content8Wave.find(deal => deal.id === bank.baseId)!;

export const equalityPreviewDeal: Deal = {
  ...base, id: bank.id, initial: bank.initial as Board, winningPath: bank.route as BoardCommand[], recoveryPaths: undefined,
};
interface Entry { manifest: EqualityManifest; sha256: string; initial: Board; route: BoardCommand[] }
const catalog = (attestedBank as Entry[]).flatMap(entry => {
  const template = content8Wave.find(deal => deal.id === entry.manifest.baseId);
  if (!template) return [];
  const deal: Deal = { ...template, id: entry.manifest.dealId, version: entry.manifest.dealVersion,
    initial: entry.initial, winningPath: entry.route, recoveryPaths: undefined };
  return [{ deal, manifest: entry.manifest, sha256: entry.sha256 }];
});
export const equalityAttestedDeals = catalog.map(entry => entry.deal);

export async function loadEqualityPreviewPolicy(): Promise<EqualityPreviewPolicy | undefined> {
  if (!EQUALITY_PREVIEW || !catalog.length) return;
  const candidates = await Promise.all(catalog.map(({ sha256, ...candidate }) => registerBundledEquality(candidate, sha256)));
  const eligible = candidates.filter(candidate => candidate !== undefined);
  if (!eligible.length) return;
  return {
    enabled: true, minLevel: 16, version: 'controlled-attested-v2', maxIssued: 1,
    cohortEvidence: 'controlled-fixture', segment: 'NonPayer', enabledSegments: ['NonPayer'],
    seed: eligible[0].manifest.paywallSeed, candidates: eligible,
  };
}

export const isEqualityVariant = (id: string, baseId: string) =>
  (id === bank.id && baseId === bank.baseId) || catalog.some(entry => entry.deal.id === id && entry.manifest.baseId === baseId);
