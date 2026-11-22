import type { BoardCommand, Deal } from './types';

export interface EqualityBotTrace {
  botStrategyId: string;
  version: number;
  traceActions: readonly BoardCommand[];
  traceDigest: string;
  stepCount: number;
  lossReason: 'budget' | 'no-legal-action' | 'repeated-position';
}

export interface EqualityManifest {
  version: 2;
  provenanceTier: 'PRODUCT_ADAPTED';
  originalRuntime: 'UNOBSERVED';
  rulesVersion: 3;
  baseId: string;
  dealId: string;
  dealVersion: number;
  finalBoardHash: string;
  sourceSeed: number;
  paywallSeed: number;
  budget: number;
  featureConfig: { revision: string; enabled: readonly string[]; pairTransform: 'UNKNOWN' };
  runId: string;
  engineAndOracle: 'rules3-gameplay-oracle-v1';
  independentlyVerifiedWinningRouteHash: string;
  botTraces: readonly EqualityBotTrace[];
}

export function equalityBoardBinding(deal: Deal) {
  const { initial, cards, lock, frozen, bound, puzzle, golden, starter, recovery, bonusSlots, training, daily } = deal;
  return { initial, cards, lock, frozen, bound, puzzle, golden, starter, recovery, bonusSlots, training, daily };
}

export interface EqualityCandidate {
  deal: Deal;
  manifest: EqualityManifest;
}

type AttestedCandidate = { baseId: string; deal: Deal; paywallSeed: number; attestation: string };
const attested = new WeakMap<EqualityCandidate, AttestedCandidate>();
export const equalityAttestation = (candidate: EqualityCandidate) => attested.get(candidate);

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Registers only content pinned by the packaged catalog and replayed by the offline verifier in CI. */
export async function registerBundledEquality(candidate: EqualityCandidate, expectedManifestHash: string): Promise<EqualityCandidate | undefined> {
  try {
    const owned = structuredClone(candidate);
    const { deal, manifest } = owned;
    if (!/^[a-f0-9]{64}$/.test(expectedManifestHash) || await sha256(manifest) !== expectedManifestHash ||
        manifest.version !== 2 || manifest.provenanceTier !== 'PRODUCT_ADAPTED' || manifest.originalRuntime !== 'UNOBSERVED' ||
        manifest.rulesVersion !== 3 || (deal.initial.rulesVersion ?? 3) !== manifest.rulesVersion ||
        deal.id !== manifest.dealId || deal.version !== manifest.dealVersion || deal.daily || deal.initial.phase !== 'playing' ||
        deal.initial.movesLeft !== manifest.budget || !Number.isSafeInteger(manifest.budget) ||
        deal.winningPath.length === 0 || deal.winningPath.length >= manifest.budget ||
        await sha256(equalityBoardBinding(deal)) !== manifest.finalBoardHash ||
        await sha256(deal.winningPath) !== manifest.independentlyVerifiedWinningRouteHash) return;
    const traces = manifest.botTraces;
    if (!Array.isArray(traces) || traces.length < 2 ||
        new Set(traces.map(trace => trace.botStrategyId)).size !== traces.length ||
        new Set(traces.map(trace => trace.traceDigest)).size !== traces.length ||
        !Number.isSafeInteger(manifest.sourceSeed) || manifest.sourceSeed < 0 || manifest.sourceSeed > 2147483647 ||
        !Number.isSafeInteger(manifest.paywallSeed) || manifest.paywallSeed < 1 || manifest.paywallSeed > 2147483647 ||
        traces.some(trace => !Number.isSafeInteger(trace.version) || trace.version < 1 ||
          trace.stepCount !== trace.traceActions.length || trace.stepCount > manifest.budget ||
          Math.fround(trace.stepCount) < Math.fround(Math.fround(manifest.budget) * Math.fround(0.8)) ||
          !['budget', 'no-legal-action', 'repeated-position'].includes(trace.lossReason))) return;
    if (!(await Promise.all(traces.map(async trace => await sha256(trace.traceActions) === trace.traceDigest))).every(Boolean)) return;
    freeze(owned);
    attested.set(owned, freeze({ baseId: manifest.baseId, deal, paywallSeed: manifest.paywallSeed, attestation: expectedManifestHash }));
    return owned;
  } catch {
    return undefined;
  }
}
