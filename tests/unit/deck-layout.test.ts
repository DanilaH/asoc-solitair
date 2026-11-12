import { expect, it } from 'vitest';
import { introDeal } from '../../src/content/intro';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, freshSave } from '../../src/domain/engine';
import { cardMetrics, layout } from '../../src/game/layout';
import type { BoardCommand, Deal } from '../../src/domain/types';
const overlap = (a: {x:number;y:number;width:number;height:number}, b: {x:number;y:number;width:number;height:number}) => Math.abs(a.x-b.x) < (a.width+b.width)/2 && Math.abs(a.y-b.y) < (a.height+b.height)/2;
it('the first waste card lands beside the stock and later cards open away without pushing earlier cards', () => {
  for (const side of ['left','right'] as const) for (const row of ['top','bottom'] as const) {
    let save = freshSave(introDeal, 'opening-fan');
    const positions = new Map<string,number>();
    for(let draw=0;draw<3;draw++) {
      save = dispatch(save,{type:'draw'},introDeal).next;
      const g = layout(save.attempt.board,introDeal,780,side,row);
      for(const [id,x] of positions)expect(g.poses.find(p=>p.id===id)!.x).toBe(x);
      const front = g.poses.find(p=>p.id===save.attempt.board.waste.at(-1))!;
      if(draw===0)expect(Math.abs(front.x-g.stock.x)).toBe(cardMetrics(introDeal).width+14);
      else expect((front.x-[...positions.values()].at(-1)!)*(side==='left'?1:-1)).toBeGreaterThan(0);
      expect(g.waste.x).toBe(front.x); positions.set(front.id,front.x);
    }
  }
});
function withFan(deal: Deal) {
  let s = freshSave(deal, 'alternate-slot-and-three-draws');
  for (const a of deal.winningPath) {
    const firstFoundation = a.type === 'transfer' && a.to.kind === 'foundation';
    const command: BoardCommand = firstFoundation ? { ...a, to: { kind: 'foundation', index: deal.initial.foundations.length - 1 } } : a;
    const next = dispatch(s, command, deal); expect(next.accepted).toBe(true); s = next.next;
    if (firstFoundation) break;
  }
  for (let i = 0; s.attempt.board.waste.length < 3 && i < 20; i++) {
    const result = dispatch(s, { type: s.attempt.board.stock.length ? 'draw' : 'recycle' }, deal);
    expect(result.accepted).toBe(true); s = result.next;
  }
  expect(s.attempt.board.waste.length).toBeGreaterThanOrEqual(3); return s.attempt.board;
}
it('three-card waste and the full stock stack stay clear of an occupied foundation title in every placement', () => {
  const dense = campaignDeals.find(d => d.initial.tableau.length === 4 && d.initial.foundations.length === 3 && d.initial.stock.length >= 6)!;
  expect(dense).toBeDefined();
  for (const deal of [introDeal, dense]) {
    const board = withFan(deal), {width,height:cardH} = cardMetrics(deal);
    for (const height of [650,900]) for (const side of ['left','right'] as const) for (const row of ['top','bottom'] as const) {
      const g = layout(board,deal,height,side,row), fan = g.poses.filter(p=>board.waste.includes(p.id));
      expect(fan).toHaveLength(3); expect(new Set(fan.map(p=>p.x)).size).toBe(3);
      const cards = fan.map(p=>({x:p.x,y:p.y+2,width:width+4,height:cardH+8}));
      if(board.stock.length)cards.push({x:g.stock.x,y:g.stock.y+g.stock.thickness/2,width:width+4,height:cardH+g.stock.thickness+4});
      for(const t of g.targets.filter(t=>t.location.kind==='foundation'&&board.foundations[t.location.index].length)) {
        const title = {x:t.x,y:t.y-cardH/2-26+14.5,width:width-10,height:29};
        for(const card of cards)expect(overlap(card,title), `${deal.id} ${side}/${row}: deck obscures category`).toBe(false);
      }
    }
  }
});
