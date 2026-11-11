import { expect, it } from 'vitest';
import { cueDurations, cueSamples } from '../../src/platform/sounds';
it('every cached sound is finite, bounded, fades to silence and varies without extra voices',()=>{
  for(const name of Object.keys(cueDurations))for(const rate of [22050,48000]){
    const a=cueSamples(name,rate,0),b=cueSamples(name,rate,1);
    expect(a.length).toBe(Math.ceil(cueDurations[name]*rate));expect([...a].every(Number.isFinite)).toBe(true);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(.721);expect(Math.abs(a[0])).toBe(0);expect(Math.abs(a.at(-1)!)).toBeLessThan(.005);
    expect(a.some(x=>Math.abs(x)>.01)).toBe(true);if(['lift','transfer','coins','draw'].includes(name))expect(a).not.toEqual(b);
  }
});
