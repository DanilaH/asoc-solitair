/** CC0 foley, preloaded as tiny PCM buffers; no decode/generation on a gesture. */
export const recordedCues: Record<string, readonly string[]> = {
  lift: ['card-lift-1','card-lift-2','card-lift-3'], transfer: ['card-place-1','card-place-2','card-place-3'],
  flip: ['card-flip-1','card-flip-2'], draw: ['card-draw-1','card-draw-2','card-draw-3'],
  gather: ['card-flip-2'], recycle: ['card-shuffle'], undo: ['card-undo'],
  ui: ['ui-tap'], win: ['card-flip-1'], complete: ['card-place-2'],
};
export function decodePcm16(raw: ArrayBuffer): { samples: Float32Array<ArrayBuffer>; rate: number } {
  const v = new DataView(raw), tag = (at: number) => String.fromCharCode(...new Uint8Array(raw, at, 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw Error('Not a WAV');
  let rate = 0, data = 0, size = 0;
  for (let at = 12; at + 8 <= v.byteLength;) {
    const length = v.getUint32(at + 4, true);
    if (at + 8 + length > v.byteLength) throw Error('Truncated WAV');
    if (tag(at) === 'fmt ') {
      if (length < 16 || v.getUint16(at + 8, true) !== 1 || v.getUint16(at + 10, true) !== 1 || v.getUint16(at + 22, true) !== 16) throw Error('Expected mono PCM16');
      rate = v.getUint32(at + 12, true);
    }
    if (tag(at) === 'data') { data = at + 8; size = length; }
    at += 8 + length + length % 2;
  }
  if (!rate || !data || size % 2) throw Error('Missing PCM');
  const samples = new Float32Array(size / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = v.getInt16(data + i * 2, true) / 32768;
  return { samples, rate };
}
export function preloadRecordedSounds() {
  const data = new Map<string, ReturnType<typeof decodePcm16>>(), controller = new AbortController();
  const ready = Promise.allSettled([...new Set(Object.values(recordedCues).flat())].map(async name => {
    const r = await fetch(`audio/${name}.wav`, { signal: controller.signal });
    if (!r.ok) return;
    data.set(name, decodePcm16(await r.arrayBuffer()));
  }));
  return { data, ready, dispose() { controller.abort(); data.clear(); } };
}
