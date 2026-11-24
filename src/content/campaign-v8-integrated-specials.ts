import { content8Late, content8Wave, decodeRoute } from './campaign-v8-dealer';
import { content8Special } from './campaign-v8-special';
import type { Deal } from '../domain/types';

const bases = new Map([...content8Wave, ...content8Late, ...content8Special].map(deal => [deal.campaignLevel, deal]));
export const coreSpecialBaseIds = new Map<string, string>();

function compose(level: number, special: Partial<Deal>): Deal {
  const base = bases.get(level)!;
  const id = base.id + '-core-special-r1';
  coreSpecialBaseIds.set(id, base.id);
  return { ...base, recoveryPaths: undefined, editorialStatus: 'product-adapted-core', ...special, id };
}

const locked = bases.get(26)!;
const oneKey = locked.lock!.requiredKeys[0];

export const coreSpecialDeals: readonly Deal[] = [
  compose(17, { puzzle: { version: 1, pairs: [{ bottom: 'berries_3', top: 'berries_5' }] } }),
  compose(19, { frozen: { version: 1, layers: { air_6: 2 } } }),
  compose(24, { bound: { version: 1, scissorsByCard: { soups_2: 'computer_2' } } }),
  compose(26, {
    lock: { version: 2, column: locked.lock!.column, requiredKeys: [oneKey] },
    cards: Object.fromEntries(Object.values(locked.cards).map(card => [card.id,
      card.keyId && card.keyId !== oneKey ? { ...card, keyId: undefined } : card])),
  }),
  compose(27, { golden: { version: 1, ids: ['fruit_4', 'fruit_5'], coinsPerCard: 5, rewardGroup: 'campaign-c8-golden-027-r1' } }),
  compose(28, {
    starter: { version: 1, cards: { kitchen_2: 'magnet' } },
    // Kitchen 5 enters the waste through the magnet. Transfer it before continuing the base route.
    winningPath: decodeRoute('t0>f0 t1>f0 t2>f0 t3>f0 t3>f1 t0>f1 t2>f1 t0>f2 t2>f2 d d d d w0>f0 w0>f0 d w0>f3 t1>f3 t1>t3 t1>f2 d d d w0>f3 d d w0>f1 d w0>f3 d w0>f3 d d d d w0>f2 d w0>f2 d d d w0>f1 d d w0>f3 d w0>f1 d d d d w0>f2 d w0>f0 t1>f0 t2>t1 t2>f2 t1>f2 t3>t1 t3>f0 d d d w0>f0 d d w0>f1 d w0>f3 t3>t0 t3>f1 t2>f1 w0>f1 d d w0>f0 d w0>f2 d d d d w0>f3 t0>f3 t0>f3 w0>f3 w0>t1 w0>t0 w0>t0 w0>f3 w0>t0 w0>f1 w0>t0 w0>f3 t0>f3 w0>t1 w0>f2 w0>t1 w0>f2 w0>f3 w0>f2 w0>f3 w0>f2 t1>f2 w0>f0 w0>f1 w0>f0 w0>f1'),
  }),
  compose(32, { starter: { version: 1, cards: { boardgames_4: 'hammer' } } }),
];
