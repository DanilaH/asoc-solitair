import data from './expansion.json' with { type: 'json' };
import { expansionCards, type ExpansionSelection } from './expansion-cards';
import type { Deal } from '../domain/types';
export interface ExpansionRecord extends ExpansionSelection, Omit<Deal, 'cards'> { authoringSeed: number; searchVisited: number }
export const expansionRecords = data as unknown as ExpansionRecord[];
export const expansionDeals: readonly Deal[] = expansionRecords.map(r => ({ ...r, cards: expansionCards(r) }));
