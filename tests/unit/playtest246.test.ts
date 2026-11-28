import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Deal, Save } from '../../src/domain/types';

let content: typeof import('../../src/content/campaign');
let bank: typeof import('../../src/content/campaign-playtest');
let engine: typeof import('../../src/domain/engine');
let storage: typeof import('../../src/platform/storage');
let retry: typeof import('../../src/app/campaign-retry');
let checkpoint: typeof import('../../src/app/playtest-checkpoint');
let ordinaryBank: typeof import('../../src/content/campaign-meta-bank');
let hints: typeof import('../../src/domain/hint-rights');
let sessions: typeof import('../../src/domain/sessions');
let daily: typeof import('../../src/content/daily');
let services: typeof import('../../src/domain/services');
let tasks: typeof import('../../src/domain/events/daily-tasks');
beforeAll(async()=>{
  vi.stubEnv('VITE_ASOC_PROFILE','c8-release-v1');
  vi.stubEnv('VITE_ASOC_CAMPAIGN_PLAYTEST','azur21-v1');
  for(const key of ['VITE_ASOC_ARCHIVE_227','VITE_ASOC_ARCHIVE_229','VITE_ASOC_ARCHIVE_230'])vi.stubEnv(key,'0');
  vi.resetModules();
  [content,bank,engine,storage,retry,checkpoint,ordinaryBank,hints,sessions,daily,services,tasks]=await Promise.all([import('../../src/content/campaign'),
    import('../../src/content/campaign-playtest'),import('../../src/domain/engine'),import('../../src/platform/storage'),
    import('../../src/app/campaign-retry'),import('../../src/app/playtest-checkpoint'),import('../../src/content/campaign-meta-bank'),
    import('../../src/domain/hint-rights'),import('../../src/domain/sessions'),import('../../src/content/daily'),import('../../src/domain/services'),
    import('../../src/domain/events/daily-tasks')]);
},30000);
afterAll(()=>{vi.unstubAllEnvs();vi.resetModules();});
const canonical=(level:number)=>`campaign-${String(level).padStart(3,'0')}`;
function context(level:number){const save=engine.freshSave(content.campaignDeals[level-1],'246');
  save.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,
    completedCampaign:Array.from({length:level-1},(_,i)=>canonical(i+1))};return save;}
const reload=(save:Save)=>storage.decodeSave(JSON.stringify(save),content.findDeal);
describe('versioned playtest admission and historical saves',()=>{
  it('retains200 campaign levels and starts a separate fresh test checkpoint with unchanged M1 resources',()=>{
    expect(content.campaignDeals).toHaveLength(200);
    const save=checkpoint.newPlaytestCheckpoint('new-test')!;
    const ordinary=engine.freshSave(content.campaignDeals[0],'ordinary').profile;
    expect({...save.profile,rewards:[]}).toEqual(ordinary);
    expect(save.profile.rewards).toEqual(Array.from({length:8},(_,i)=>`milestone:${(i+1)*10}`));
    expect(save.profile.coins).toBe(100);
    expect(save.platform!.completedCampaign).toHaveLength(80);
    expect(save.attempt.issuance?.admission).toEqual({version:'campaign-playtest246-v1',profile:'azur21-v1',reserve:25});
    expect(content.findDeal(save.attempt.dealId)?.campaignLevel).toBe(81);
    expect(reload(save).attempt).toEqual(save.attempt);
  });
  it.each([81,87,94,101])('retains old ordinary and both candidate definitions at L%i without remapping',level=>{
    const ordinaryId=ordinaryBank.extendedRecords(level)[0].deal.id+'-core-stage1-v1-m1';
    const old=content.findDeal(ordinaryId)!;
    expect(old).toBeDefined();
    expect(reload(engine.freshSave(old,'old')).attempt.board).toEqual(old.initial);
    for(const mode of ['azur21-v1','hybrid21-v1'] as const)for(const reserve of [15,25] as const){
      const entries=bank.playtestCore(level,mode,reserve)!.byLevel.get(level)!;
      const distinct=new Set(entries.map(e=>e.geometry));expect(distinct.size).toBe(3);
      for(const entry of entries){
        const id=entry.deal.id+'-m1', deal=content.findDeal(id)!;
        expect(deal?.initial).toEqual(entry.deal.initial);
        expect(reload(engine.freshSave(deal,'retain')).attempt.board).toEqual(deal.initial);
        expect(deal.initial.rulesVersion).toBe(4);
        expect(deal.extraHelpers).toMatchObject({randomJokerCoins:300,unlimitedCoins:800,unlimitedMs:60000});
      }
    }
  });
  it('rotates three exact layouts through real retries, retaining losses, source history, lives and rights',()=>{
    const save=context(81), base=content.campaignDeals[80], first=content.selectCampaignDeal(save,base);
    save.attempt=engine.freshSave(first,'first').attempt;
    save.attempt.issuance=content.campaignIssuance(save,base,first);
    save.attempt.director={previousLosses:2,restarts:2};save.attempt.sourceDifficulty={outcome:'Restart',restarts:2};
    save.platform!.bonusSlotCredits={version:1,foundation:1,tableau:1};
    save.randomJokers={version:1,grants:[{version:1,id:'unused',source:'coins',cost:300,issuedAt:1000}]};
    const seen=new Set([content.layoutFingerprint(first)]);
    for(let turn=0;turn<2;turn++){
      const q=retry.quoteLayoutRetry(save)!;expect(q).toBeDefined();
      expect(retry.commitAdaptiveRetry(save,q,'retry-'+turn,2000+turn,retry.quoteLayoutRetry)).toBe('started');
      seen.add(content.layoutFingerprint(content.findDeal(save.attempt.dealId)!));
      expect(save.attempt.director).toEqual({previousLosses:2,restarts:3+turn});
      expect(save.attempt.sourceDifficulty).toEqual({outcome:'Restart',restarts:3+turn});
      expect(save.campaignLives?.remaining??5).toBe(5);
      expect(reload(save).randomJokers?.grants[0].consumed).toBeUndefined();
      expect(reload(save).platform!.bonusSlotCredits).toEqual({version:1,foundation:1,tableau:1});
    }
    expect(seen.size).toBe(3);
  });
  it('never pays the skipped prefix milestones or a second reward for a completed candidate level',()=>{
    let save=checkpoint.newPlaytestCheckpoint('checkpoint-win')!;
    const deal=content.findDeal(save.attempt.dealId)!;
    for(const action of deal.winningPath){const result=engine.dispatch(save,action,deal);expect(result.accepted).toBe(true);save=result.next;}
    expect(save.attempt.board.phase).toBe('won');
    expect(save.attempt.payout?.some(r=>r.reason==='campaign_milestone')).toBe(false);
    const coins=save.profile.coins;
    save=engine.dispatch(save,{type:'restart',attemptId:'completed-replay'},deal).next;
    for(const action of deal.winningPath){const result=engine.dispatch(save,action,deal);expect(result.accepted).toBe(true);save=result.next;}
    expect(save.profile.coins).toBe(coins);expect(save.attempt.payout).toEqual([]);
  });
  it('keeps historical FTUE identities and L80/81, L101/102 and L200 boundaries',()=>{
    for(const level of [1,3,4,5,80,102,200]){
      const save=context(level), deal=content.selectCampaignDeal(save,content.campaignDeals[level-1]);
      expect(deal.id.includes('-pt246-')).toBe(false);
      expect(reload(engine.freshSave(deal,'boundary')).attempt.board).toEqual(deal.initial);
    }
    expect(content.selectCampaignDeal(context(81),content.campaignDeals[80]).id).toContain('-pt246-r25-');
    expect(content.selectCampaignDeal(context(101),content.campaignDeals[100]).id).toContain('-pt246-r25-');
  });
});
describe('candidate Hint settles only with the suggested action',()=>{
  function ready(){let save=context(81);const deal=content.selectCampaignDeal(save,content.campaignDeals[80]);
    save.attempt=engine.freshSave(deal,'hint-stage').attempt;save.profile.hints=1;return{save,deal};}
  it('preserves an unused purchased charge on offer, repeat and reload; spends once on accepted application',()=>{
    let {save,deal}=ready();const action=deal.winningPath[0];
    for(let i=0;i<2;i++){
      const result=engine.dispatch(save,{type:'hint',revision:save.revision,action},deal);
      expect(result.accepted).toBe(true);save=reload(result.next);expect(save.profile.hints).toBe(1);
      expect(save.attempt.stagedHint?.action).toEqual(action);expect(save.attempt.verifiedTaskHints).toBe(0);
    }
    const used=engine.dispatch(save,action,deal);expect(used.accepted).toBe(true);
    expect(used.next.profile.hints).toBe(0);expect(used.next.attempt.stagedHint).toBeUndefined();
    expect(used.events.filter(e=>e.type==='hint')).toEqual([{type:'hint',reason:'applied'}]);
    expect(used.next.attempt.verifiedTaskHints).toBe(1);
    const undo=engine.dispatch(used.next,{type:'undo'},deal);expect(undo.accepted).toBe(true);
    expect(undo.next.profile.hints).toBe(0);expect(reload(undo.next).attempt.stagedHint).toBeUndefined();
  });
  it('does not spend when a different legal action is chosen or a stale offer arrives',()=>{
    let {save,deal}=ready();let at=0;
    while(engine.legalCommands(save.attempt.board,deal).length<2&&at<deal.winningPath.length-1)
      save=engine.dispatch(save,deal.winningPath[at++],deal).next;
    const action=deal.winningPath[at];
    const staged=engine.dispatch(save,{type:'hint',revision:save.revision,action},deal).next;
    const other=engine.legalCommands(staged.attempt.board,deal).find(a=>JSON.stringify(a)!==JSON.stringify(action))!;
    expect(other).toBeDefined();const moved=engine.dispatch(staged,other,deal);
    expect(moved.accepted).toBe(true);expect(moved.next.profile.hints).toBe(1);
    expect(moved.next.attempt.stagedHint).toBeUndefined();
    const stale=engine.dispatch(moved.next,{type:'hint',revision:save.revision,action},deal);
    expect(stale.accepted).toBe(false);expect(stale.next.profile.hints).toBe(1);
  });
  it('reserves across Campaign/Daily and applies both charges exactly once after acquisition',()=>{
    let {save,deal}=ready();const action=deal.winningPath[0];
    save=engine.dispatch(save,{type:'hint',revision:save.revision,action},deal).next;
    const d=daily.dailyForDay('2026-11-28');
    sessions.switchMode(save,'daily',d,'day');
    expect(hints.availableHintCharges(save)).toBe(0);
    expect(engine.dispatch(save,{type:'hint',revision:save.revision,action:d.winningPath[0]},d).accepted).toBe(false);
    save.profile.coins=300;expect(services.purchaseHelper(save,'hint')).toBe(true);
    expect(save.profile.hints).toBe(2);expect(hints.availableHintCharges(save)).toBe(1);
    save=engine.dispatch(save,{type:'hint',revision:save.revision,action:d.winningPath[0]},d).next;
    save=engine.dispatch(save,d.winningPath[0],d).next;expect(save.profile.hints).toBe(1);
    sessions.switchMode(save,'campaign',deal,'return');save=reload(save);
    expect(hints.stagedHint(save.attempt)?.action).toEqual(action);
    save=engine.dispatch(save,action,deal).next;expect(save.profile.hints).toBe(0);
    expect(save.profile.coins).toBe(0);
  });
  it('counts a winning suggested action as Hint use and never as a no-Hint win',()=>{
    let {save,deal}=ready();for(const action of deal.winningPath.slice(0,-1))save=engine.dispatch(save,action,deal).next;
    const action=deal.winningPath.at(-1)!;save=engine.dispatch(save,{type:'hint',revision:save.revision,action},deal).next;
    const result=engine.dispatch(save,action,deal);expect(result.accepted).toBe(true);expect(result.next.attempt.board.phase).toBe('won');
    const signals=tasks.acceptedTaskSignals(save,result,action,deal);
    expect(signals.some(s=>s.kind==='UseHints'&&s.amount===1)).toBe(true);
    expect(signals.some(s=>s.kind==='WinNoHints')).toBe(false);
  });
  it('settles the same normative transfer when the UI omits an explicit whole-packet root',()=>{
    let {save,deal}=ready();let checked=false;
    for(const action of deal.winningPath){
      if(action.type==='transfer'&&action.from.kind==='tableau'&&action.root===undefined){
        const root=save.attempt.board.tableau[action.from.index].length-engine.sourceCards(save.attempt.board,action.from,deal).length;
        const explicit={...action,root},a=engine.applyBoard(save.attempt.board,explicit,deal),b=engine.applyBoard(save.attempt.board,action,deal);
        if(typeof a!=='string'&&typeof b!=='string'&&JSON.stringify(a.board)===JSON.stringify(b.board)){
          save=engine.dispatch(save,{type:'hint',revision:save.revision,action:explicit},deal).next;
          const result=engine.dispatch(save,action,deal);expect(result.accepted).toBe(true);expect(result.next.profile.hints).toBe(0);
          expect(result.events).toContainEqual({type:'hint',reason:'applied'});checked=true;break;
        }
      }
      save=engine.dispatch(save,action,deal).next;
    }
    expect(checked).toBe(true);
  });
});
