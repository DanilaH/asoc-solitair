import type { BoardCommand, Command, Location } from '../domain/types';

const locations = { t: 'tableau', f: 'foundation', w: 'waste' } as const;
function location(code: string): Location {
  if (!/^[tfw]\d+$/.test(code)) throw Error('Invalid campaign route location');
  return { kind: locations[code[0] as keyof typeof locations], index: Number(code.slice(1)) };
}

/** d = draw, r = recycle, t2>f0 = move tableau column 2 to foundation slot 0. */
export function decodeRoute(route: string): BoardCommand[] {
  return route.split(' ').map(step => {
    if (step === 'd') return { type: 'draw' };
    if (step === 'r') return { type: 'recycle' };
    const [from, to] = step.split('>');
    return { type: 'transfer', from: location(from), to: location(to) };
  });
}

export function decodeLessonRoute(route: string): Command[] {
  return route.split(' ').map(step => /^j\d+$/.test(step)
    ? { type: 'place-joker', column: Number(step.slice(1)) }
    : decodeRoute(step)[0]);
}
