import { it } from 'vitest';
import { campaignDeals, selectCampaignDeal } from '../../src/content/campaign';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { proveShuffle } from '../../src/game/shuffle-proof';
it('probes early L30 with bounded reference search', () => {
  const deal=selectCampaignDeal(freshSave(campaignDeals[29],'probe'),campaignDeals[29]);
  for(const prefix of [0,6,12,24,36]) {
    let board=deal.initial;
    for(const move of deal.winningPath.slice(0,prefix)) { const next=applyBoard(board,move,deal);if(typeof next==='string')throw Error(next);board=next.board; }
    for(let seed=0;seed<4;seed++) {
      const now=performance.now(),path=proveShuffle({attemptId:'probe',revision:0,dealId:deal.id,deal,board,seed});
      console.log(JSON.stringify({prefix,seed,budget:board.movesLeft,path:path?.length,ms:Math.round(performance.now()-now)}));
      if(path)break;
    }
  }
},90000);
