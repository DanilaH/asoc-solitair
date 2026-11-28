import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Board, BoardCommand, Deal, Save } from '../../src/domain/types';
import { advance } from '../../tools/qa/gameplay-oracle';

let content: typeof import('../../src/content/campaign');
let engine: typeof import('../../src/domain/engine');
let tasks: typeof import('../../src/domain/events/daily-tasks');
let bonus: typeof import('../../src/domain/events/daily-bonus');
let progression: typeof import('../../src/domain/progression');
let retry: typeof import('../../src/app/campaign-retry');
let storage: typeof import('../../src/platform/storage');
let services: typeof import('../../src/domain/services');
let slots: typeof import('../../src/domain/bonus-slots');
let joker: typeof import('../../src/domain/random-joker');
const now = Date.UTC(2026, 10, 28), day = 86_400_000;
beforeAll(async () => {
  vi.stubEnv('VITE_ASOC_PROFILE', 'c8-release-v1');
  for (const key of ['VITE_ASOC_ARCHIVE_227','VITE_ASOC_ARCHIVE_229','VITE_ASOC_ARCHIVE_230']) vi.stubEnv(key, '0');
  vi.resetModules();
  [content,engine,tasks,bonus,progression,retry,storage,services,slots,joker] = await Promise.all([
    import('../../src/content/campaign'), import('../../src/domain/engine'), import('../../src/domain/events/daily-tasks'),
    import('../../src/domain/events/daily-bonus'), import('../../src/domain/progression'), import('../../src/app/campaign-retry'),
    import('../../src/platform/storage'), import('../../src/domain/services'), import('../../src/domain/bonus-slots'),
    import('../../src/domain/random-joker'),
  ]);
}, 30_000);
afterAll(() => { vi.unstubAllEnvs(); vi.resetModules(); });
function fixture(level: number) {
  const base = content.campaignDeals[level - 1], context = engine.freshSave(base, 'ca236');
  context.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: level - 1 }, (_, i) => progression.campaignId(i + 1)) };
  const deal = content.selectCampaignDeal(context, base);
  context.attempt = engine.freshSave(deal, 'ca236').attempt;
  return { save: context, deal };
}
function reload(save: Save) { return storage.decodeSave(JSON.stringify(save), content.findDeal); }
function frozenShuffle(save: Save, quantity: number) {
  save.dailyBonus = { version: 1, day: Math.floor(now/day), roundId: 'old-ready', catalog: 'azur-compiled-r1',
    columns: [{ kind: 'Shuffle', quantity }, { kind: 'Coins', quantity: 100 }, { kind: 'Undo', quantity: 2 }, { kind: 'Joker', quantity: 1 }],
    slots: [0,1,2,0,1,2,1,2,0,3,3,3], revealed: [0,3,8], won: 0 };
}
describe('CA-01 canonical inventory before scheduled Tasks', () => {
  it.each([2,3,4,5,6])('claims every old Shuffle size on L%i without unlocking Tasks', level => {
    for (const quantity of [2,3,5]) {
      let { save } = fixture(level); frozenShuffle(save, quantity); save = reload(save);
      expect(progression.dailyTasksAvailable(save)).toBe(false);
      expect(bonus.claimDailyBonus(save, 'old-ready', now + day)).toEqual({ kind: 'Shuffle', quantity });
      save = reload(save);
      expect(save.dailyTasks?.inventory.shuffles).toBe(quantity);
      expect(save.dailyTasks?.weeks).toEqual([]);
      expect(progression.dailyTasksAvailable(save)).toBe(false);
      expect(bonus.claimDailyBonus(save, 'old-ready', now + day)).toBeUndefined();
      expect(bonus.dailyBonusState(save, now + day).canStartRound).toBe(true);
    }
  });
  it('schedules L7 once while preserving earlier inventory and one intro grant', async () => {
    const { save } = fixture(2);
    expect(tasks.grantEventPrize(save, { kind: 'Shuffle', quantity: 5 })).toBe(true);
    save.platform!.completedCampaign = Array.from({ length: 6 }, (_, i) => progression.campaignId(i + 1));
    expect(progression.dailyTasksAvailable(save)).toBe(true);
    expect(tasks.scheduleTasks(save, now, tasks.azurTaskDays[0])).toBe(true);
    expect(tasks.scheduleTasks(save, now, tasks.azurTaskDays[0])).toBe(false);
    const { grantShuffleIntro } = await import('../../src/domain/shuffle-progression');
    expect(grantShuffleIntro(save)).toBe(true); expect(grantShuffleIntro(save)).toBe(false);
    expect(reload(save).dailyTasks?.inventory.shuffles).toBe(6);
  });
  it.each(['Coins','MoveHint','Undo','Definition','Joker','Shuffle'] as const)('grants %s before Tasks', kind => {
    const { save } = fixture(2);
    expect(tasks.grantEventPrize(save, { kind, quantity: 2 })).toBe(true);
    expect(progression.dailyTasksAvailable(reload(save))).toBe(false);
  });
});
describe('CA-02 retries retain level history', () => {
  it('retains two natural exhaustions and their life debits after a playing retry on L81', () => {
    let {save,deal}=fixture(81);
    for(let loss=0;loss<2;loss++) {
      while(save.attempt.board.phase==='playing') {
        const action={type:save.attempt.board.stock.length?'draw':'recycle'} as const;
        const result=engine.dispatch(save,action,deal); expect(result.accepted).toBe(true); save=result.next;
      }
      expect(save.attempt.board.phase).toBe('exhausted');
      const quote=retry.quoteLayoutRetry(save)!;
      expect(retry.commitAdaptiveRetry(save,quote,'natural-'+loss,now,retry.quoteLayoutRetry)).toBe('started');
      deal=content.findDeal(save.attempt.dealId)!;
    }
    expect(save.attempt.director).toEqual({restarts:2,previousLosses:2});
    expect(save.campaignLives?.remaining).toBe(3);
    save=engine.dispatch(save,{type:'draw'},deal).next;
    const quote=retry.quoteLayoutRetry(save)!;
    expect(retry.commitAdaptiveRetry(save,quote,'voluntary',now,retry.quoteLayoutRetry)).toBe('started');
    expect(save.attempt.director).toEqual({restarts:3,previousLosses:2});
    expect(save.campaignLives?.remaining).toBe(3);
    expect(reload(save).attempt.director).toEqual(save.attempt.director);
  });
  it.each([6,16,23,39,80,81,150,200])('keeps losses and source slot through playing layout changes L%i', level => {
    let { save, deal } = fixture(level);
    save.attempt.director = { restarts: 2, previousLosses: 2 };
    save.attempt.sourceDifficulty = { outcome: 'Restart', restarts: 2 };
    for (let i = 0; i < 3; i++) {
      const quote = retry.quoteLayoutRetry(save)!;
      expect(quote).toBeDefined();
      expect(retry.commitAdaptiveRetry(save, quote, 'new-' + i, now, retry.quoteLayoutRetry)).toBe('started');
      expect(save.attempt.director).toEqual({ restarts: 3+i, previousLosses: 2 });
      expect(save.attempt.sourceDifficulty).toEqual({ outcome: 'Restart', restarts: 3+i });
      expect(save.campaignLives?.remaining ?? 5).toBe(5);
      expect(save.attempt.dealId).not.toBe(deal.id);
      save = reload(save); deal = content.findDeal(save.attempt.dealId)!;
    }
  });
  it('counts exhausted retry once, preserves through Continue/Undo and resets at the next level', async () => {
    let { save, deal } = fixture(16);
    save.attempt.director = { restarts: 2, previousLosses: 2, exhausted: true };
    save.attempt.sourceDifficulty = { outcome: 'Restart', restarts: 2 };
    save.attempt.board.phase = 'exhausted'; save.attempt.board.movesLeft = 0;
    const quote = retry.quoteLayoutRetry(save)!;
    expect(retry.commitAdaptiveRetry(save, quote, 'loss-retry', now, retry.quoteLayoutRetry)).toBe('started');
    expect(save.attempt.director).toEqual({ restarts: 3, previousLosses: 3 });
    expect(save.campaignLives?.remaining).toBe(4);
    const difficulty = await import('../../src/domain/difficulty');
    difficulty.recordCampaignOutcome(save);
    expect(save.difficultyHistory?.at(-1)).toEqual({ outcome: 'Restart', restarts: 3 });
    const campaign = await import('../../src/domain/campaign');
    save.platform!.completedCampaign.push(progression.campaignId(16));
    campaign.beginDeal(save, content.campaignDeals[16], 'next-level', content.findDeal(save.attempt.dealId));
    expect(save.attempt.director).toBeUndefined(); expect(save.attempt.sourceDifficulty).toBeUndefined();
  });
});
describe('CA-03 off-witness directed proof search', () => {
  it.each([2,3,6,10,12,16,23,39,66,80,81])('proves the complete continuation after a witnessed deviation L%i', async level => {
    const exact = level === 2 ? 'campaign-ha4-2-280006-4f50c85dae3c8c5f-272bb506-core-stage1-v1-m1'
      : level === 6 ? 'campaign-ha4-6-680057-a9d537d3500896af-9524f5b7-core-stage1-v1-m1' : undefined;
    const entry = [...content.campaignCoreDeals()].find(e => e.deal.campaignLevel === level);
    const deal = exact ? content.findDeal(exact)! : entry ? content.findDeal(entry.deal.id+'-m1') ?? entry.deal : fixture(level).deal;
    const { knownContinuation } = await import('../../src/domain/solver');
    const { resolveHintRoute } = await import('../../src/domain/hint');
    let board = deal.initial, off: Board | undefined;
    for (let i=0;i<deal.winningPath.length-1;i++) {
      const deviated = advance(board, deal.winningPath[i+1], deal);
      if (deviated && deviated.phase === 'playing' && !knownContinuation(deviated,deal)) {
        let witness: Board | null = deviated;
        for (const action of [deal.winningPath[i],...deal.winningPath.slice(i+2)]) witness = witness && advance(witness,action,deal);
        if (witness?.phase === 'won') { off = deviated; break; }
      }
      board = advance(board,deal.winningPath[i],deal)!;
    }
    expect(off).toBeDefined();
    const result = resolveHintRoute(off!,deal);
    expect(result.status).toBe('SOLVED');
    if (result.status !== 'SOLVED') throw Error('no verified hint');
    let oracle: Board | null = off!;
    for (const action of result.path) oracle = oracle && advance(oracle,action,deal);
    expect(oracle?.phase).toBe('won');
    expect(oracle?.movesLeft).toBeGreaterThanOrEqual(0);
  }, 10_000);
  it('keeps a finite-budget unknown free and rejects a stale paid hint', async () => {
    const { save, deal } = fixture(6), before = structuredClone(save);
    const { resolveHintRoute, resolveHint } = await import('../../src/domain/hint');
    const result = resolveHintRoute({ ...save.attempt.board, movesLeft: 1 },deal);
    expect(result.status).not.toBe('SOLVED'); expect(save).toEqual(before);
    const hint = resolveHint(save.attempt.board,deal);
    expect(hint.status).toBe('SOLVED');
    if (hint.status === 'SOLVED') {
      const stale = engine.dispatch(save,{ type: 'hint', revision: save.revision+1, action: hint.action },deal);
      expect(stale.accepted).toBe(false); expect(stale.next.profile.hints).toBe(before.profile.hints);
    }
  });
});
describe('CA-04 durable typed earned slots', () => {
  it.each(['active','parked','removed','won','coin-open'] as const)('settles %s receipt exactly once across reload', async state => {
    let { save, deal } = fixture(6);
    const receipt = { schema: 1, id: 'earned-slot', attempt: save.attempt.id, dealId: deal.id, mode: 'campaign', placement: 'bonus-tableau' } as const;
    if (state === 'parked') {
      const { switchMode } = await import('../../src/domain/sessions');
      const { dailyForDay } = await import('../../src/content/daily');
      switchMode(save, 'daily', dailyForDay('2026-11-28'), 'daily');
    } else if (state === 'removed') save.attempt.id = 'replacement';
    else if (state === 'won') {
      for (const action of deal.winningPath) { const result = engine.applyBoard(save.attempt.board, action, deal); if (typeof result === 'string') throw Error(result); save.attempt.board = result.board; }
    } else if (state === 'coin-open') {
      save.profile.coins = 1000;
      expect(slots.purchaseBonusSlot(save, deal, save.attempt.id, 'tableau')).toBe(true);
    }
    const coins = save.profile.coins;
    expect(services.applyReceipt(save, receipt, { deal })).toBe('applied');
    save = reload(save);
    expect(services.applyReceipt(save, receipt, { deal })).toBe('already-applied');
    expect(save.profile.coins).toBe(coins);
    const immediate = state === 'active' || state === 'parked';
    expect(slots.bonusSlotCreditCount(save, 'tableau')).toBe(immediate ? 0 : 1);
    expect(slots.bonusSlotCreditCount(save, 'foundation')).toBe(0);
    if (immediate) expect((state === 'parked' ? save.parked!.campaign! : save.attempt).board.tableau.length).toBe(deal.initial.tableau.length + 1);
    else {
      save.attempt = engine.freshSave(deal, 'credit-use').attempt;
      expect(save.attempt.board.tableau.length).toBe(deal.initial.tableau.length);
      expect(slots.useBonusSlotCredit(save, deal, 'credit-use', 'foundation')).toBe(false);
      expect(slots.useBonusSlotCredit(save, deal, 'credit-use', 'tableau')).toBe(true);
      expect(slots.useBonusSlotCredit(save, deal, 'credit-use', 'tableau')).toBe(false);
      expect(reload(save).platform?.bonusSlotCredits?.tableau).toBe(0);
    }
  });
  it('rejects malformed inventory and does not acknowledge a failed coordinated commit', async () => {
    const { save, deal } = fixture(6); save.attempt.id = 'replacement';
    let raw: string | null = JSON.stringify(save), fail = true;
    const store = new storage.SaveStore({ getItem: async () => raw, setItem: async (_key, value) => { if (fail) throw Error('disk'); raw = value; }, removeItem: async () => undefined }, content.findDeal, () => engine.freshSave(deal, 'fallback'));
    await store.open();
    const receipt = { schema: 1, id: 'late-write', attempt: 'old', dealId: deal.id, mode: 'campaign', placement: 'bonus-tableau' } as const;
    await expect(store.mutate(next => services.applyReceipt(next, receipt, { deal }))).rejects.toThrow();
    expect(JSON.parse(raw!).platform.receipts).not.toContain(receipt.id);
    fail = false; await store.mutate(next => services.applyReceipt(next, receipt, { deal }));
    const restored = storage.decodeSave(raw!, content.findDeal);
    expect(slots.bonusSlotCreditCount(restored, 'tableau')).toBe(1);
    restored.platform!.bonusSlotCredits!.tableau = -1;
    expect(() => reload(restored)).toThrow('запас слотов');
  });
});
describe('CA-05 randomized eligible Joker search', () => {
  it('rejects all unknown proofs without charging and includes a purchased eligible column', () => {
    const {save,deal}=fixture(6);
    expect(joker.buyRandomJokerAccess(save,deal,'joker-right',now)).toBe(false);
    save.profile.coins=1000;
    expect(joker.buyRandomJokerAccess(save,deal,'joker-right',now)).toBe(true);
    const before=structuredClone(save);
    const tight={...save.attempt,board:{...save.attempt.board,movesLeft:1}};
    expect(joker.findRandomJokerPlacement(tight,deal,'azj-unknown',()=>0,performance.now()+1000)).toBeUndefined();
    expect(save).toEqual(before);
    expect(joker.settleRandomJoker(save,deal,{attemptId:save.attempt.id,revision:save.revision,column:0,id:'azj-invalid',path:[]})).toBe(false);
    expect(joker.randomJokerCount(save)).toBe(1);
    expect(slots.openBonusSlot(save.attempt,deal,'tableau')).toBe(true);
    const extra=save.attempt.board.tableau.length-1;
    // Reach an occupied purchased slot with the normative command, not a synthetic card duplication.
    const action=engine.legalCommands(save.attempt.board,deal).find(a=>a.type==='transfer'&&a.to.kind==='tableau'&&a.to.index===extra);
    expect(action).toBeDefined();
    const result=engine.applyBoard(save.attempt.board,action!,deal); if(typeof result==='string')throw Error(result);
    save.attempt.board=result.board;
    expect(joker.randomJokerColumns(save.attempt,deal)).toContain(extra);
  });
  it('never samples empty targets and falls back to another proven column', () => {
    const deal = content.findDeal('campaign-ha4-2-280006-4f50c85dae3c8c5f-272bb506-core-stage1-v1-m1')!;
    const save = engine.freshSave(deal, 'joker');
    for (const action of deal.winningPath.slice(0,5)) { const result = engine.applyBoard(save.attempt.board, action, deal); if (typeof result === 'string') throw Error(result); save.attempt.board = result.board; }
    expect(joker.randomJokerColumns(save.attempt, deal)).toEqual([0,2]);
    expect(joker.placeRandomJoker(save.attempt, deal, () => 1, () => 'azj-choice')?.joker?.column).toBe(2);
    const proof = joker.findRandomJokerPlacement(save.attempt, deal, 'azj-fallback', () => 0, performance.now()+2500)!;
    expect(proof).toBeDefined(); expect([0,2]).toContain(proof.column);
    let board = joker.placeRandomJokerAt(save.attempt, deal, proof.column, proof.id)!;
    for (const action of proof.path) { const next = advance(board, action, deal); expect(next).not.toBeNull(); board = next!; }
    expect(board.phase).toBe('won');
    expect(joker.findRandomJokerPlacement(save.attempt, deal, 'azj-timeout', () => 0, performance.now()-1)).toBeUndefined();
    expect(save.attempt.randomJokerUsed).toBeUndefined();
  });
});

