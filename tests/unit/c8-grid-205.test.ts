import { expect, it } from 'vitest';
import { releaseProfile } from '../../src/config/profile';
import { campaignDeals, registeredCampaignDeals } from '../../src/content/campaign';
import { dailyPool } from '../../src/content/daily';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { bonusOffer, bonusKinds, purchaseBonusSlot } from '../../src/domain/bonus-slots';
import { boardFrame, cardMetrics, exceedsTapSlop, layout } from '../../src/game/layout';
import type { Board, Deal } from '../../src/domain/types';

/** An independent dimensional contract: constants below are the owner's
 * material proportions, not computed by the production layout function. */
it('classifies 6 and 12 CSS pixel excursions identically at all world scales', () => {
  for (const unit of [.18,.25,.31,.47,.6,.8,1,1.8,3]) {
    expect(exceedsTapSlop(6 / unit,0,unit)).toBe(false);
    expect(exceedsTapSlop(12 / unit,0,unit)).toBe(true);
    expect(exceedsTapSlop(6 / unit,6 / unit,unit)).toBe(false);
    expect(exceedsTapSlop(8 / unit,8 / unit,unit)).toBe(true);
  }
});

it.skipIf(releaseProfile?.id !== 'c8-release-v1')('C8 active bank, registered variants and all Daily: independent geometry and bonus stability matrix', () => {
  expect(campaignDeals).toHaveLength(80);
  expect(dailyPool).toHaveLength(28);
  expect(releaseProfile!.capabilities).toMatchObject({proofShuffle:'active',bonusSlots:'active',frozenBoundPuzzleGoldenStarter:'active',purchases:'off'});
  const bank = [...new Map([...campaignDeals,...registeredCampaignDeals(),...dailyPool].map(d=>[d.id,d])).values()];
  expect(bank.length).toBeGreaterThan(108);
  const sizes = [[296,148],[296,180],[296,240],[296,320],[336,330],[336,420],[336,560],[369,600],[388,650],[496,350],[744,780]];
  const failures:string[]=[]; let total=0, purchaseChecks=0, replaySteps=0, invalidWitnesses=0, minCard=Infinity, minStrip=Infinity;
  const check = (condition:boolean,label:string) => { if (!condition && failures.length<40) failures.push(label); };
  function samples(deal:Deal): Board[] {
    let board=structuredClone(deal.initial);
    let maxStack=board,maxFan=board,mostFoundations=board,last=board;
    const depth=(b:Board)=>Math.max(0,...b.tableau.map(p=>p.length));
    const count=(b:Board)=>b.foundations.filter(p=>p.length).length;
    for (const command of deal.winningPath) {
      const next=applyBoard(board,command,deal);
      if(typeof next==='string'){invalidWitnesses++;break;}
      board=next.board; replaySteps++;
      if(depth(board)>depth(maxStack)) maxStack=board;
      if(board.waste.length>maxFan.waste.length) maxFan=board;
      if(count(board)>count(mostFoundations)) mostFoundations=board;
      if(board.phase==='playing')last=board;
    }
    return [...new Set([deal.initial,maxStack,maxFan,mostFoundations,last])];
  }
  for(const deal of bank) {
    const states=samples(deal);
    for(const [width,height] of sizes) for(const side of ['left','right'] as const) for(const row of ['top','bottom'] as const) {
      const frame=boardFrame(width,height,row,deal), metrics=cardMetrics(deal);
      const key=deal.id+' '+width+'x'+height+' '+side+'/'+row;
      const hasDeck=Boolean(deal.initial.stock.length||deal.initial.waste.length);
      const origin=layout(deal.initial,deal,frame,side,row);
      check(metrics.width===138&&metrics.height===166,key+' material');
      check(frame.unit>0 && Number.isFinite(frame.unit),key+' scale');
      minCard=Math.min(minCard,138*frame.unit);
      for(const board of states) {
        const g=layout(board,deal,frame,side,row); total++;
        for(const t of g.targets) {
          check(Math.abs(t.x-(69+t.location.index*152))<.001,key+' axis '+t.location.kind+' '+t.location.index);
          check(t.x-69>=-.001&&t.x+69<=frame.width+.001,key+' target bounds');
          check(t.y-83>=-.001&&t.y+83<=frame.height+.001,key+' target height');
        }
        for(const p of g.poses) {
          check(p.x-69>=-.001&&p.x+69<=frame.width+.001&&p.y-83>=-.001&&p.y+83<=frame.height+.001,key+' pose '+p.id);
          if(board.tableau.some(ids=>ids.includes(p.id))) {
            const front=g.targets.find(t=>t.location.kind==='tableau'&&Math.abs(t.x-p.x)<.001)!;
            check(front.y>=p.y-.001,key+' front ordering');
            if(row==='bottom'&&hasDeck)check(p.y+83<=g.stock.y-83+.001,key+' bottom stock collision');
          }
        }
        const foundations=g.targets.filter(t=>t.location.kind==='foundation');
        const tableau=g.targets.filter(t=>t.location.kind==='tableau');
        if(foundations.length&&tableau.length)check(foundations[0].y+83<=tableau[0].y-83+.001,key+' row collision');
        if(hasDeck) {
          check(Math.abs((side==='left'?g.stock.x-69:g.stock.x+69-frame.width))<.001,key+' stock edge');
          check(g.stock.y-83>=-.001&&g.stock.y+83<=frame.height+.001,key+' stock bounds');
          const fan=g.poses.filter(p=>board.waste.includes(p.id));
          for(let i=1;i<fan.length;i++)check(Math.abs(Math.abs(fan[i].x-fan[i-1].x)-32)<.001,key+' fan pitch');
        }
        for(const col of board.tableau){
          const poses=g.poses.filter(p=>col.includes(p.id)).sort((a,b)=>a.y-b.y);
          for(let i=1;i<poses.length;i++)minStrip=Math.min(minStrip,(poses[i].y-poses[i-1].y)*frame.unit);
        }
      }
      for(const kind of bonusKinds) if(bonusOffer(deal,kind)) {
        const save=freshSave(deal,'layout-bonus-audit'); save.profile.coins=100000;
        if(!purchaseBonusSlot(save,deal,save.attempt.id,kind)){check(false,key+' purchase refused');continue;}
        const after=layout(save.attempt.board,deal,frame,side,row);
        const offered=origin.offers.find(x=>x.kind===kind)!;
        const purchased=after.targets.find(x=>x.location.kind===kind&&x.location.index===bonusOffer(deal,kind)!.index)!;
        check(Boolean(offered&&purchased&&offered.x===purchased.x&&offered.y===purchased.y),key+' reserved cell');
        check(JSON.stringify(origin.poses)===JSON.stringify(after.poses),key+' purchase shifts cards');
        for(const t of origin.targets)check(after.targets.some(x=>x.location.kind===t.location.kind&&x.location.index===t.location.index&&x.x===t.x&&x.y===t.y),key+' purchase shifts target');
        purchaseChecks++;
      }
    }
  }
  console.info('C8 grid matrix',JSON.stringify({active:campaignDeals.length,registered:registeredCampaignDeals().length,daily:dailyPool.length,unique:bank.length,layouts:total,purchaseChecks,replaySteps,invalidWitnesses,minCardCss:minCard,minStripCss:minStrip}));
  expect(failures).toEqual([]);
},120000);
