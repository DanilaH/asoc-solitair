import { Kind, sourceCard, type SourceCard } from '../domain/hitapps-rules';
import type { Deal } from '../domain/types';
import type { SourceRecord } from './hitapps-r4-bank';

type Initial = SourceRecord['deal']['initial'];
export type PackedMetaDeal = Omit<SourceRecord, 'deal'> & {
  deal: Omit<SourceRecord['deal'], 'initial'> & {
    initial: Omit<Initial, 'hitapps'>;
    native: { changed: Record<string, SourceCard>; order: string[]; generatedGold: number };
  };
};

export function unpackMetaDeal(row: PackedMetaDeal, template: Deal): SourceRecord {
  const { native, ...deal } = row.deal;
  const cards = { ...template.cards, ...row.changedCards };
  const properties = Object.fromEntries(native.order.map(id => {
    const card = cards[id];
    return [id, native.changed[id] ?? sourceCard(card.leader ? Kind.category : Kind.word, card.rank ?? 0)];
  }));
  return { ...row, deal: { ...deal, initial: { ...deal.initial, hitapps: { move: 0, cards: properties, spent: [], generatedGold: native.generatedGold } } } };
}
