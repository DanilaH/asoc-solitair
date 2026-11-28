import {expect,it} from 'vitest';
import {campaignDeals} from '../../src/content/campaign';
import {cardCaption} from '../../src/game/captions';
import {boardFrame,layout} from '../../src/game/layout';
import {applyBoard} from '../../src/domain/engine';
import {cueSamples} from '../../src/platform/sounds';
import {recordedCues} from '../../src/platform/recorded-sounds';
it('editorial wraps preserve every canonical word and the category completion and win cues are distinct',()=>{
 for(const d of campaignDeals)for(const c of Object.values(d.cards))expect(cardCaption(c.text,true).replace(/-?\n/g,'').replace(/ /g,''),c.text).toBe(c.text.replace(/ /g,''));
 expect(recordedCues.complete).toBeUndefined();expect(recordedCues.win).toBeUndefined();
 expect(cueSamples('complete',22050,0)).not.toEqual(cueSamples('win',22050,0));
});
it('every shipped witness stays bounded in every deck placement',()=>{
 let poses=0;
 for(const d of campaignDeals){
  const states=[d.initial];for(const a of d.winningPath){const r=applyBoard(states.at(-1)!,a,d);if(typeof r==='string')throw Error(d.id+':'+r);states.push(r.board);}
  for(const[w,h]of [[296,268],[336,420],[616,190],[744,700]])for(const side of ['left','right']as const)for(const row of ['top','bottom']as const){
   const f=boardFrame(w,h,row,d);expect(f.offsetX).toBeGreaterThanOrEqual(-.01);
   for(const board of states)for(const p of layout(board,d,f,side,row).poses){
    poses++;if(p.x-69<-.01||p.x+69>f.width+.01||p.y+83>f.height+.01)throw Error(d.id+' '+side+'/'+row+' '+JSON.stringify(p));
   }
  }
 }
 expect(poses).toBeGreaterThan(100000);
},60000);
