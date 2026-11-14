import {readFileSync} from 'node:fs';
import {decodePcm16,recordedCues} from '../../src/platform/recorded-sounds';
export function recordedSamples(name:string,variant=0){const files=recordedCues[name],file=files[variant%files.length];const data=readFileSync(`public/audio/${file}.wav`);return decodePcm16(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)as ArrayBuffer).samples;}
