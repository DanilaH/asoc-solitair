import data from './campaign-v8-dealer.json' with { type: 'json' };
import type { BoardCommand, Deal, Location } from '../domain/types';
import { content8Cards } from './content8-words';
import type { TopicSelection } from './topics';

type DealerRecord = Omit<Deal, 'cards' | 'winningPath' | 'recoveryPaths'> & {
  topics: TopicSelection[]; winningPath: string; recoveryPaths?: string[];
};

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

export const content8Dealer: readonly Deal[] = (data as DealerRecord[]).map(({ topics, winningPath, recoveryPaths, ...deal }) => ({
  ...deal, cards: content8Cards(topics), winningPath: decodeRoute(winningPath), recoveryPaths: recoveryPaths?.map(decodeRoute),
}));
