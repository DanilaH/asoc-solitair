import type { Deal } from '../../src/domain/types';
import type { MetaRecipe } from '../../src/content/campaign-meta-recipes';
import { emptyFeatures, prepareSourceInput, sourceCardOrder, type SourceFeatures, type SourceInput } from './hitapps-source-authoring';
const noRandom = () => { throw Error('Expected a recorded seed'); };

export function featuresFor(template: Deal, recipe: Pick<MetaRecipe, 'feature' | 'budget'>, seed: number, dealer?: SourceInput['dealer']): SourceFeatures | undefined {
  const rule = recipe.feature;
  const pattern = { enabled: true, index: 0, seed: seed + 1 };
  const tops = template.initial.tableau.map((pile, column) => ({ column, position: pile.length - 1 }));
  const input = { ...emptyFeatures };
  if (rule === 'ordered') return { ...input, ordered: [Object.values(template.cards)[0].category] };
  if (rule === 'ice') return { ...input, frozen: { ...pattern, data: [{ ...tops[1], layers: 2 }] } };
  if (rule === 'lock') return { ...input, lockers: { ...pattern, data: [{ lock: tops[0], keys: [{ ...tops[2], amount: 1 }], required: 1, type: 1 }] } };
  if (rule === 'bound') {
    const probe = prepareSourceInput(template, { version: 'hitapps-input-v2', layout: 'random', stable: true, levelPenalty: 0,
      cardOrder: sourceCardOrder(template), features: input, ...(dealer && { dealer }) }, recipe.budget).prepare(pattern.seed, 'None', noRandom).deal!;
    const pair = tops.find(point => {
      const pile = probe.initial.tableau[point.column];
      const lower = probe.cards[pile[point.position - 1]], upper = probe.cards[pile[point.position]];
      return !lower.leader && !upper.leader && lower.category !== upper.category;
    });
    if (!pair) return;
    return { ...input, bound: { ...pattern, data: { pairs: [pair], scissors: [tops.find(point => point.column !== pair.column)!] } } };
  }
  if (rule === 'puzzle') {
    const card = Object.values(template.cards).find(card => !card.leader && card.image)
      ?? Object.values(template.cards).find(card => !card.leader)!;
    return { ...input, puzzle: [{ assembled: card.id, tag: 1,
      halves: [{ ...card, id: card.id + '-meta-top' }, { ...card, id: card.id + '-meta-bottom' }] }] };
  }
  if (rule === 'magnet' || rule === 'hammer') return { ...input, starter: [{
    kind: rule === 'magnet' ? 5 : 6, seed: seed + 7,
    card: { id: `meta-${template.campaignLevel}-${rule}`, category: 'starter', text: rule === 'magnet' ? 'Магнит' : 'Молоток', explanation: 'Стартовый помощник' },
  }] };
  if (rule === 'gold') return { ...input, gold: { seed: seed + 5, first: 1, initial: 1, total: 1, coinsPerActivation: 5,
    rewardGroup: `campaign-meta-gold-${template.campaignLevel}` } };
  return input;
}

