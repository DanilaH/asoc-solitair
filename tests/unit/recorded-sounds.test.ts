import {test,expect} from 'vitest';import {readFileSync} from 'node:fs';
import {decodePcm16,recordedCues} from '../../src/platform/recorded-sounds';
test('bundled recorded cues are small, mono PCM, smooth at edges and safe within four voices',()=>{
 for(const name of new Set(Object.values(recordedCues).flat())){const b=readFileSync('public/audio/'+name+'.wav');const {samples,rate}=decodePcm16(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)as ArrayBuffer);expect(rate).toBe(22050);expect(samples.length/rate).toBeLessThan(.7);expect(Math.max(...samples.map(Math.abs))).toBeLessThan(.49);expect(Math.abs(samples[0])).toBe(0);expect(Math.abs(samples.at(-1)!)).toBe(0);expect(samples.some(x=>Math.abs(x)>.02)).toBe(true);}
});
test('bad/truncated WAV does not become garbage audio',()=>{expect(()=>decodePcm16(new ArrayBuffer(64))).toThrow();});
