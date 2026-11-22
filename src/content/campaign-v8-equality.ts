import bank from './campaign-v8-equality-bank.json' with { type: 'json' };
import { content8Wave } from './campaign-v8-dealer';
import type { EqualityPreviewPolicy } from '../domain/equality-issuance';
import type { Board, BoardCommand, Deal } from '../domain/types';

export const EQUALITY_PREVIEW = import.meta.env?.VITE_C8_OWNER_PREVIEW === 'equality';
const base = content8Wave.find(deal => deal.id === bank.baseId)!;

export const equalityPreviewDeal: Deal = {
  ...base, id: bank.id, initial: bank.initial as Board, winningPath: bank.route as BoardCommand[], recoveryPaths: undefined,
};
export const equalityPreviewPolicy: EqualityPreviewPolicy | undefined = EQUALITY_PREVIEW ? {
  enabled: true, minLevel: 16, version: 'controlled-r2', maxIssued: 1,
  cohortEvidence: 'controlled-fixture', segment: 'NonPayer', enabledSegments: ['NonPayer'], seed: bank.seed,
  candidates: [{
    baseId: base.id, deal: equalityPreviewDeal,
    proof: { version: 1, scope: 'PRODUCT_ADAPTED', winningSteps: bank.route.length, lateLossPaths: bank.lateLossPaths },
  }],
} : undefined;
export const isEqualityVariant = (id: string, baseId: string) => id === bank.id && baseId === bank.baseId;
