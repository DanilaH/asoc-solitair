import { expect, it } from 'vitest';
import { dropTarget, type Target } from '../../src/game/layout';
const a:Target={location:{kind:'tableau',index:0},x:50,y:50,width:80,height:100};
const b:Target={location:{kind:'tableau',index:1},x:150,y:50,width:80,height:100};
it('accepts an isolated near edge but never guesses between two nearby columns',()=>{
  expect(dropTarget([a,b],50,108,12)?.location).toEqual(a.location);
  expect(dropTarget([a,b],50,120,12)).toBeNull();
  expect(dropTarget([a,b],100,50,12)).toBeNull();
  expect(dropTarget([a,b],110,50,12)?.location).toEqual(b.location);
  expect(dropTarget([a,b],50,108,0)).toBeNull();
});
