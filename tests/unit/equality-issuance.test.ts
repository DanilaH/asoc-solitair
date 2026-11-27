import { afterEach, expect, it, vi } from 'vitest';
import type { Deal } from '../../src/domain/types';
import type { EqualityPreviewPolicy } from '../../src/domain/equality-issuance';

afterEach(() => vi.unstubAllEnvs());

it('leaves default and unverified cohorts unchanged and atomically issues a certified candidate', async () => {
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  const { campaignDeals, findDeal } = await import('../../src/content/campaign');
  const { dailyForDay } = await import('../../src/content/daily');
  const { beginDeal } = await import('../../src/domain/campaign');
  const { dispatch, freshSave } = await import('../../src/domain/engine');
  const { platformState } = await import('../../src/domain/services');
  const { campaignId } = await import('../../src/domain/progression');
  const { switchMode } = await import('../../src/domain/sessions');
  const { SaveStore } = await import('../../src/platform/storage');
  const { prepareEqualityPlan } = await import('../../tools/content/equality-provenance');
  const { advance } = await import('../../tools/qa/gameplay-oracle');
  const { equalityBoardBinding, registerBundledEquality } = await import('../../src/domain/equality-attestation');
  const { authoringHash } = await import('../../tools/content/hitapps-authoring');
  const { verifyEqualityBankEntry } = await import('../../tools/content/hitapps-equality-bank');
  const base = campaignDeals[15], daily = dailyForDay('2026-11-21');
  const deal = { ...base, id: base.id + '-equality-r1' } satisfies Deal;
  const config = { enabled: true, minLevel: 16, limit: 1, version: 'controlled-r1', segments: ['NonPayer' as const] };
  const control = prepareEqualityPlan({
    request: { level: 16, seed: 42, segment: 'NonPayer', issued: 0 },
    cohortEvidence: 'controlled-fixture', config, requests: [42], drawSeed: () => 0, deal: () => deal,
    policies: [
      { id: 'stock-first', choose: (board, moves) => moves.find(x => x.type === (board.stock.length ? 'draw' : 'recycle')) },
      { id: 'one-tableau-action', choose: (board, moves, deal) =>
        (board.movesLeft === deal.initial.movesLeft && moves.find(x => x.type === 'transfer')) ||
        moves.find(x => x.type === (board.stock.length ? 'draw' : 'recycle')) },
    ],
  });
  expect(control.result).toBe('SELECTED_CONTROLLED_CANDIDATE');
  let board = deal.initial;
  for (const action of deal.winningPath) {
    const next = advance(board, action, deal);
    expect(next).not.toBeNull();
    board = next!;
  }
  expect(board.phase).toBe('won');
  // The isolated transaction fixture supplies a test pin. The real authoring verifier
  // must reject these weak traces even if their bytes and metadata are consistent.
  const tested = {
    deal, manifest: {
      version: 2, provenanceTier: 'PRODUCT_ADAPTED', originalRuntime: 'UNOBSERVED', rulesVersion: 3,
      baseId: base.id, dealId: deal.id, dealVersion: deal.version, finalBoardHash: authoringHash(equalityBoardBinding(deal)),
      sourceSeed: 42, paywallSeed: 42, historyPenalty: 0, baseBudget: base.initial.movesLeft!, levelInputHash: authoringHash(base.initial), budget: deal.initial.movesLeft!, featureConfig: { revision: 'test', enabled: [], pairTransform: 'UNKNOWN' },
      engineAndOracle: 'rules3-gameplay-oracle-v1', runId: authoringHash(control),
      independentlyVerifiedWinningRouteHash: authoringHash(deal.winningPath),
      botTraces: control.trials[0].runs.map(run => ({ botStrategyId: run.policyId, version: 1, traceActions: run.path,
        traceDigest: run.traceDigest, stepCount: run.steps, lossReason: 'budget' as const })),
    },
  } as const;
  const pin = authoringHash(tested.manifest);
  expect(verifyEqualityBankEntry(base, tested, pin)).toBe(false);
  const candidate = await registerBundledEquality(tested, pin);
  expect(candidate).toBeDefined();
  expect(Object.isFrozen(candidate?.deal.initial.stock)).toBe(true);
  expect(await registerBundledEquality({ ...tested, deal: { ...deal, initial: {
    ...deal.initial, stock: [...deal.initial.stock].reverse(),
  } } }, pin)).toBeUndefined();
  expect(await registerBundledEquality({ ...tested, deal: { ...deal, winningPath: deal.winningPath.slice(1) } }, pin)).toBeUndefined();
  expect(await registerBundledEquality({ ...tested, manifest: { ...tested.manifest, runId: 'altered' } }, pin)).toBeUndefined();
  const wrongBudget = { ...tested, manifest: { ...tested.manifest, historyPenalty: 10 } };
  expect(await registerBundledEquality(wrongBudget, authoringHash(wrongBudget.manifest))).toBeUndefined();
  const policy: EqualityPreviewPolicy = {
    enabled: true, cohortEvidence: 'controlled-fixture', version: 'controlled-attested-test', maxIssued: 1,
    seed: 42, segment: 'NonPayer', enabledSegments: ['NonPayer'], candidates: [candidate!],
  };
  const fresh = () => {
    const save = freshSave(base, 'prior-attempt');
    platformState(save).completedCampaign = Array.from({ length: 15 }, (_, i) => campaignId(i + 1));
    return save;
  };
  for (const inactive of [undefined, { ...policy, enabled: false }, { ...policy, cohortEvidence: 'unknown' as const }]) {
    const save = fresh();
    beginDeal(save, base, 'next-attempt', base, inactive);
    expect(save.attempt.dealId).toBe(base.id);
    expect(save.equality).toBeUndefined();
  }

  for (const blocked of [{ ...policy, candidates: [tested] }, { ...policy, seed: 43 },
    { ...policy, enabledSegments: ['Payer' as const] }, { ...policy, cohortEvidence: 'verified-provider' as const }]) {
    const save = fresh();
    beginDeal(save, base, 'gate-refusal', base, blocked);
    expect(save.attempt.dealId).toBe(base.id);
    expect(save.equality?.issued ?? 0).toBe(0);
  }

  const changedDifficulty = fresh();
  changedDifficulty.difficultyPenalty = -5;
  beginDeal(changedDifficulty, base, 'different-difficulty', base, policy);
  expect(changedDifficulty.attempt.dealId).toBe(base.id);
  expect(changedDifficulty.equality?.issued ?? 0).toBe(0);

  let stored: string | null = null, fail = false;
  const storage = {
    async getItem() { return stored; },
    async setItem(_key: string, value: string) { if (fail) throw Error('storage write failed'); stored = value; },
    async removeItem() { stored = null; },
  };
  const lookup = (id: string) => id === deal.id ? deal : findDeal(id);
  const writer = new SaveStore(storage, lookup, fresh);
  const original = await writer.open();
  fail = true;
  await expect(writer.mutate(save => beginDeal(save, base, 'tested-issue', base, policy))).rejects.toThrow();
  expect(writer.state).toEqual(original);
  fail = false;
  await writer.mutate(save => beginDeal(save, base, 'tested-issue', base, policy));
  expect(writer.state.attempt.dealId).toBe(deal.id);
  expect(writer.state.profile).toEqual(original.profile);
  expect(writer.state.equality).toMatchObject({
    version: 1, eligible: 1, attempted: 1, selected: 1, issued: 1, lost: 0, completed: 0,
    last: { attemptId: 'tested-issue', dealId: deal.id, policyVersion: policy.version, dealVersion: deal.version, attestation: pin },
  });
  for (const segment of ['NonPayer', 'Payer', 'PotentialPayer', 'SleepPayer'] as const) {
    const save = fresh();
    beginDeal(save, base, 'cohort-gate', base, { ...policy, segment, enabledSegments: [segment] });
    expect(save.equality?.last?.segment).toBe(segment);
  }
  await writer.mutate(save => switchMode(save, 'daily', daily, 'parked-issue'));
  const reopened = new SaveStore(storage, lookup, fresh);
  await reopened.open();
  expect(reopened.state.parked?.campaign?.dealId).toBe(deal.id);
  await reopened.mutate(save => switchMode(save, 'campaign', deal, 'resumed-issue'));
  expect(reopened.state.attempt.id).toBe('tested-issue');

  let recovered = structuredClone(reopened.state);
  recovered.attempt.board.movesLeft = 1;
  recovered = dispatch(recovered, { type: 'draw' }, deal).next;
  expect(recovered.attempt.board.phase).toBe('exhausted');
  expect(recovered.equality?.lost).toBe(1);
  recovered = dispatch(recovered, { type: 'restart', attemptId: 'restart-issue' }, deal).next;
  expect(recovered.attempt.dealId).toBe(deal.id);
  expect(recovered.equality?.last?.attemptId).toBe('restart-issue');
  for (const action of deal.winningPath) {
    const result = dispatch(recovered, action, deal);
    expect(result.accepted, result.reason).toBe(true);
    recovered = result.next;
  }
  expect(recovered.equality).toMatchObject({ issued: 1, lost: 1, completed: 1 });
  expect(recovered.platform?.receipts).toEqual([]);
}, 20000);
