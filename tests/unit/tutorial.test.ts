import { describe, expect, it } from 'vitest';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, freshSave } from '../../src/domain/engine';
import { markTutorial } from '../../src/domain/progression';
import { lesson, recordLearning, ruleIntroduction } from '../../src/app/tutorial';

describe('action-based teaching', () => {
  it('observes the first two deals without changing them and advances after actual actions', () => {
    const actions = new Set<string>();
    for (const deal of campaignDeals.slice(0, 2)) {
      let save = freshSave(deal, 'teaching');
      for (const action of deal.winningPath) {
        const before = structuredClone(save), guidance = lesson(save, deal);
        expect(save).toEqual(before);
        expect(guidance?.action).toBeDefined();
        expect(dispatch(save, guidance!.action!, deal).accepted).toBe(true);
        actions.add(guidance!.action!.type);
        save = dispatch(save, action, deal).next;
      }
      expect(lesson(save, deal)).toBeUndefined();
    }
    expect(actions.has('transfer')).toBe(true); expect(actions.has('draw')).toBe(true);
  });
  it('does not turn ordinary or modifier levels into a free automatic hint stream', () => {
    for (const index of [4, 16, 22, 25, 29, 79]) {
      const deal = campaignDeals[index];
      expect(lesson(freshSave(deal, 'ordinary'), deal)).toBeUndefined();
    }
  });
});

it('learned skills survive restart and leave an independent stretch in the second deal',()=>{
  let save=freshSave(campaignDeals[0],'learning');
  for(const deal of campaignDeals.slice(0,2)){
    if(deal!==campaignDeals[0]){const next=freshSave(deal,'learning-two');next.campaign=save.campaign;save=next;}
    for(const action of deal.winningPath){const before=save.attempt.board;save=dispatch(save,action,deal).next;recordLearning(save,before,action,deal);
      if(deal.campaignLevel===2&&save.campaign!.tutorials.includes('learn:stock')){expect(lesson(save,deal)).toBeUndefined();expect(save.attempt.board.phase).toBe('playing');break;}
    }
  }
  expect(save.campaign!.tutorials).toEqual(expect.arrayContaining(['learn:category','learn:match','learn:stock']));
  const flags=[...save.campaign!.tutorials];save=dispatch(save,{type:'restart',attemptId:'again'},campaignDeals[1]).next;expect(save.campaign!.tutorials).toEqual(flags);expect(lesson(save,campaignDeals[1])).toBeUndefined();
});
it('new rule introductions are once-only metadata and never change resources',()=>{
  for(const [index,kind]of [[20,'joker'],[22,'ordered'],[25,'keys']] as const){
    const deal=campaignDeals[index],save=freshSave(deal,'intro');save.platform={receipts:[],continuedAttempts:[],continueCredits:0,lastFullscreenAt:0,winsSinceInterstitial:0,completedCampaign:campaignDeals.slice(0,index).map(d=>d.id)};
    const profile=structuredClone(save.profile),board=structuredClone(save.attempt.board);expect(ruleIntroduction(save,deal)).toBe(kind);markTutorial(save,`intro:${kind}`);expect(ruleIntroduction(save,deal)).toBeUndefined();expect(save.profile).toEqual(profile);expect(save.attempt.board).toEqual(board);
  }
});
