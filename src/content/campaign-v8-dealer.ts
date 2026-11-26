import data from './campaign-v8-dealer.json' with { type: 'json' };
import wave from './campaign-v8-wave.json' with { type: 'json' };
import late from './campaign-v8-late.json' with { type: 'json' };
import type { Deal } from '../domain/types';
import { decodeRoute } from './route';
export { decodeRoute } from './route';
import { content8Cards, type Content8TopicSelection } from './content8-words';

type DealerRecord = Omit<Deal, 'cards' | 'winningPath' | 'recoveryPaths'> & {
  topics: Content8TopicSelection[]; winningPath: string; recoveryPaths?: string[];
};

function decodeDeal({ topics, winningPath, recoveryPaths, ...deal }: DealerRecord): Deal {
  return {
    ...deal, cards: content8Cards(topics), winningPath: decodeRoute(winningPath), recoveryPaths: recoveryPaths?.map(decodeRoute),
  };
}

export const content8Dealer: readonly Deal[] = (data as DealerRecord[]).map(decodeDeal);
export const content8Wave: readonly Deal[] = (wave as DealerRecord[]).map(decodeDeal);
export const content8Late: readonly Deal[] = (late as DealerRecord[]).map(decodeDeal);
