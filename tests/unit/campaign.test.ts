import { describe, expect, it } from 'vitest';
import { campaignDeals, findDeal } from '../../src/content/campaign';
import { introDeal } from '../../src/content/intro';
import { dispatch, freshSave } from '../../src/domain/engine';
import { beginDeal } from '../../src/domain/campaign';
import { completedLevels, helperUnlocked, unlockedLevel } from '../../src/domain/progression';
import { markCampaignWin, applyReceipt } from '../../src/domain/services';
import { decodeSave, SaveStore } from '../../src/platform/storage';
import { CONTENT_VERSION, type Save } from '../../src/domain/types';

function win(save: Save, index: number) {
  const deal = campaignDeals[index];
  for (const cmd of deal.winningPath) {
    const result = dispatch(save, cmd, deal); expect(result.accepted).toBe(true); save = result.next;
    if (result.events.some(e => e.type === 'win')) markCampaignWin(save, deal.id, deal.campaignLevel);
  }
  return save;
}
describe('linear campaign ownership', () => {
  it('replays all 26 fixed witnesses in sequence, unlocks the next level once and retains economy', () => {
    let save = freshSave(campaignDeals[0], 'attempt-1');
    for (let index=0; index<campaignDeals.length; index++) {
      if (index) beginDeal(save, campaignDeals[index], `attempt-${index+1}`);
      expect(save.attempt.board).toEqual(campaignDeals[index].initial);
      const hints=save.profile.hints; save=win(save,index);
      expect(completedLevels(save)).toBe(index+1); expect(save.profile.hints).toBe(hints);
      expect(save.attempt.board.phase).toBe('won');
      expect(decodeSave(JSON.stringify(save),findDeal)).toEqual(save);
    }
    expect(save.platform!.completedCampaign).toHaveLength(26); expect(unlockedLevel(save)).toBe(26);
  });
  it('rejects locked levels and preserves wallet/receipts/settings through replay without another new win', () => {
    let save = freshSave(campaignDeals[0], 'a'); expect(() => beginDeal(save,campaignDeals[4],'b')).toThrow();
    save=win(save,0); save.settings.haptics=false;
    applyReceipt(save,{schema:1,id:'earned',attempt:'old',dealId:'intro-001',mode:'campaign',placement:'undo'});
    const profile=structuredClone(save.profile); beginDeal(save,campaignDeals[0],'replay');
    expect(save.profile).toEqual(profile); expect(save.platform!.receipts).toEqual(['earned']); expect(save.settings.haptics).toBe(false);
    save=win(save,0); expect(completedLevels(save)).toBe(1); expect(save.platform!.completedCampaign).toHaveLength(1);
    expect(save.profile.wins).toBe(2);
  });
  it('opens Hint on 3 / Undo on 4; the first valid Hint demo is free and durable', () => {
    let save=freshSave(campaignDeals[0],'a'); expect(helperUnlocked(save,'hint',campaignDeals[0])).toBe(false);
    expect(dispatch(save,{type:'hint',revision:0,action:campaignDeals[0].winningPath[0]},campaignDeals[0]).accepted).toBe(false);
    save=win(save,0);beginDeal(save,campaignDeals[1],'b');save=win(save,1);beginDeal(save,campaignDeals[2],'c');
    expect(helperUnlocked(save,'hint',campaignDeals[2])).toBe(true);expect(helperUnlocked(save,'undo',campaignDeals[2])).toBe(false);
    const hints=save.profile.hints, board=structuredClone(save.attempt.board);
    const first=dispatch(save,{type:'hint',revision:save.revision,action:campaignDeals[2].winningPath[0]},campaignDeals[2]);
    expect(first.accepted).toBe(true);save=decodeSave(JSON.stringify(first.next),findDeal);
    expect(save.profile.hints).toBe(hints);expect(save.attempt.board).toEqual(board);
    const paid=dispatch(save,{type:'hint',revision:save.revision,action:campaignDeals[2].winningPath[0]},campaignDeals[2]);expect(paid.next.profile.hints).toBe(hints-1);
    save=win(save,2);beginDeal(save,campaignDeals[3],'d');expect(helperUnlocked(save,'undo',campaignDeals[3])).toBe(true);
  });
  it('migrates the old control save without losing its attempt, rewards or spent helpers', async () => {
    const old=freshSave(introDeal,'legacy');old.contentVersion=1;old.rulesVersion=1;old.balanceVersion=1;old.profile.coins=378;old.profile.hints=0;old.profile.rewards=['win:old'];
    const migrated=decodeSave(JSON.stringify(old),findDeal);
    expect(migrated.contentVersion).toBe(CONTENT_VERSION);expect(migrated.profile).toEqual(old.profile);expect(migrated.attempt).toEqual(old.attempt);
    let raw=JSON.stringify(old);const store=new SaveStore({getItem:async()=>raw,setItem:async(_k,v)=>{raw=v},removeItem:async()=>undefined},findDeal,()=>freshSave(campaignDeals[0],'new'));
    await store.open();expect(store.state.attempt.id).toBe('legacy');
    await store.mutate(next=>beginDeal(next,campaignDeals[0],'campaign-start'));
    expect(store.state.profile.coins).toBe(378);expect(store.state.profile.hints).toBe(0);expect(JSON.parse(raw).attempt.dealId).toBe('campaign-001');
    const invalid=structuredClone(old);invalid.attempt.dealId='deleted-level';expect(()=>decodeSave(JSON.stringify(invalid),findDeal)).toThrow();
  });
});
