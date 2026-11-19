import data from './campaign-v8-preview.json' with { type: 'json' };
import type { Deal } from '../domain/types';
import type { TopicSelection } from './topics';
import { content8Cards } from './content8-words';

type ReferenceRecord = Omit<Deal, 'cards'> & { topics: TopicSelection[] };
export const content8Slice: readonly Deal[] = (data as unknown as ReferenceRecord[]).map(({ topics, ...deal }) => ({
  ...deal, cards: content8Cards(topics),
}));
