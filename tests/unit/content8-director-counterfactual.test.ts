import { afterEach, expect, it, vi } from 'vitest';
import { C8_DIFFICULTY, difficultyStats, nextPenalty } from '../../src/domain/difficulty';
import type { Attempt, CampaignOutcome, Deal } from '../../src/domain/types';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const clean: CampaignOutcome={outcome:'Clean',restarts:0};
const extra: CampaignOutcome={outcome:'ExtraSteps',restarts:0};
const restart: CampaignOutcome={outcome:'Restart',restarts:1};
const repeated=(item:CampaignOutcome,n=10)=>Array.from({length:n},()=>({...item}));
const balanced=()=>[...repeated(clean,6),...repeated(restart,4)];

it('reports 5×5 source-shaped R1 outcome window counterfactuals (not human difficulty)',async()=>{
  vi.stubEnv('VITE_CONTENT8_PREVIEW','1');
  const { campaignDeals, selectCampaignDeal }=await import('../../src/content/campaign');
  const { freshSave }=await import('../../src/domain/engine');
  const { campaignId }=await import('../../src/domain/progression');
  const catalog=[
    {id:'no-history',history:[] as CampaignOutcome[],expected:'base'},
    {id:'9-clean',history:repeated(clean,9),expected:'base'},
    {id:'10-clean',history:repeated(clean),expected:'tight'},
    {id:'10-extra',history:repeated(extra),expected:'tight'},
    {id:'10-restarts',history:repeated(restart),expected:'relief'},
    {id:'6-clean-4-restarts',history:balanced(),expected:'base'},
  ] as const;
  const output=[];
  for(const level of [11,12,13,14,15]){
    const deal=campaignDeals[level-1],save=freshSave(deal,'scenario');
    save.platform={receipts:[],continuedAttempts:[],continueCredits:0,
      completedCampaign:Array.from({length:10},(_,i)=>campaignId(i+1)),
      winsSinceInterstitial:0,lastFullscreenAt:0};
    const cases=[];
    for(const entry of catalog){
      save.difficultyHistory=entry.history;
      delete save.difficultyPenalty;
      const chosen=selectCampaignDeal(save,deal);
      const actual=chosen.id===deal.id?'base':chosen.id.endsWith('-tight-r1')?'tight':'relief';
      expect(actual,entry.id+' at L'+level).toBe(entry.expected);
      const stats=difficultyStats(entry.history);
      cases.push({window:entry.id,outcome:actual,budget:chosen.initial.movesLeft,
        adjustedRate:stats?.adjustedRate??null});
    }
    output.push({level,defaultBudget:deal.initial.movesLeft,cases});
  }
  console.log('C8_DIRECTOR_COUNTERFACTUAL '+JSON.stringify({
    schema:'director-r1-what-if-v1',
    source:'game model R1, 5 fresh levels, no real-human or original-runtime inputs',
    currentConfig:C8_DIFFICULTY,levels:output,
  }));
});

it('separates EasyDeals retry from DynamicDifficulty and exposes relief→tight risk',async()=>{
  vi.stubEnv('VITE_CONTENT8_PREVIEW','1');
  const { campaignDeals, findDeal, selectCampaignDeal }=await import('../../src/content/campaign');
  const { freshSave, freshAttempt }=await import('../../src/domain/engine');
  const rows=[];
  for(const level of [11,12,13,14,15]){
    const deal=campaignDeals[level-1],save=freshSave(deal,'scenario');
    const previous=freshAttempt(deal,'earlier');
    previous.board={...previous.board,movesLeft:0,phase:'exhausted'};
    previous.director={restarts:2,previousLosses:2,exhausted:true};
    const afterThree=selectCampaignDeal(save,deal,previous);
    expect(afterThree.id).toBe(deal.id+'-relief-r1');
    const notYet={...previous,director:{restarts:1,previousLosses:1,exhausted:true}} as Attempt;
    expect(selectCampaignDeal(save,deal,notYet).id).toBe(deal.id);
    save.difficultyHistory=repeated(clean);
    save.difficultyPenalty=nextPenalty(save.difficultyHistory,0,C8_DIFFICULTY);
    expect(save.difficultyPenalty).toBe(-5);
    // This is a diagnostic only, NOT a desired-behavior contract:
    // after failing the relief variant, the next new start can become tight,
    // because EasyDeals is skipped for the previous relief and R1 falls back to hard penalty.
    const failedRelief=freshAttempt(findDeal(afterThree.id)!,'failed-relief');
    failedRelief.board={...failedRelief.board,movesLeft:0,phase:'exhausted'};
    failedRelief.director={restarts:3,previousLosses:3,exhausted:true};
    const next=selectCampaignDeal(save,deal,failedRelief);
    rows.push({level,relief:afterThree.id,afterFailingRelief:next.id,
      mayTightenAfterReliefFailure:next.id===deal.id+'-tight-r1'});
    // No assertion of the problematic target: future approved fixes may change it.
  }
  console.log('C8_DIRECTOR_LOSS_RECOVERY '+JSON.stringify({
    schema:'director-r1-streak-observation-v1',
    evidence:'current game selector with synthetic history and exhausted active attempt, not player behavior',
    rows,
  }));
});

it('does not count raw exhaustion as a completed DynamicDifficulty outcome',async()=>{
  vi.stubEnv('VITE_CONTENT8_PREVIEW','1');
  const { campaignDeals }=await import('../../src/content/campaign');
  const { freshSave }=await import('../../src/domain/engine');
  const { recordCampaignExhaustion }=await import('../../src/domain/difficulty');
  const save=freshSave(campaignDeals[10],'exhaustion');
  recordCampaignExhaustion(save.attempt);
  expect(save.attempt.director?.exhausted).toBe(true);
  expect(save.difficultyHistory).toBeUndefined();
  expect(save.difficultyPenalty).toBeUndefined();
});
