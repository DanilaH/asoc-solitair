import type { Card } from '../../src/domain/types';
import { dealOrdinary, EmbeddedRandom } from './plain-dealer';

export function distributeWave(cards: Record<string, Card>, stockSize: number, columns: number[],
  seed: number, strategy: 'ordinary' | 'guided-stock') {
  const { tableau, stock } = dealOrdinary(Object.keys(cards), stockSize, columns, seed);
  if (strategy === 'ordinary') return { tableau, stock };

  // Offline product authoring. Interleave neighbouring categories around the
  // starting tableau. Order deeper cards by the same coarse wave to avoid
  // circular locks when many categories are buried in a 5-column deal.
  const random = new EmbeddedRandom(seed ^ 0x6c2839);
  const exposed = new Map<string, number>();
  for (const column of tableau) for (const [depth, id] of column.slice().reverse().entries()) {
    const card = cards[id], priority = depth + (card.leader ? 0 : .6);
    exposed.set(card.category, Math.min(exposed.get(card.category) ?? Infinity, priority));
  }
  const categories = Object.values(cards).filter(card => card.leader).map(card => ({
    id: card.id, priority: (exposed.get(card.id) ?? 2.5) * 12 + random.next(24),
  })).sort((left, right) => left.priority - right.priority);
  const positions = new Map(categories.map(({ id }, index) => [id, index]));
  const rank = (id: string) => positions.get(cards[id].category)!;
  for (const column of tableau) {
    const entries = column.map(id => ({
      id, priority: rank(id) * 14 + random.next(5) - Number(cards[id].leader) * 6,
    })).sort((left, right) => right.priority - left.priority);
    column.splice(0, column.length, ...entries.map(entry => entry.id));
  }
  const guided = stock.map(id => ({
    id, priority: rank(id) * 6 + random.next(24) - (cards[id].leader ? 5 : 0),
  })).sort((left, right) => left.priority - right.priority).map(card => card.id);
  return { tableau, stock: guided };
}
