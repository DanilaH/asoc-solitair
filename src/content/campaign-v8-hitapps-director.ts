import early from './campaign-v8-hitapps-016.json' with { type: 'json' };
import middle from './campaign-v8-hitapps-032.json' with { type: 'json' };
import later from './campaign-v8-hitapps-049.json' with { type: 'json' };
import final from './campaign-v8-hitapps-065.json' with { type: 'json' };
import retry from './campaign-v8-restart.json' with { type: 'json' };
import { content8Dealer, content8Late, content8Wave, decodeRoute } from './campaign-v8-dealer';
import type { Deal } from '../domain/types';

export interface HitappsDirectorRecord {
  baseId: string;
  id: string;
  direction: 'tight' | 'relief' | 'easy';
  tableau: string[][];
  stock: string[];
  budget: number;
  route: string;
  inputHash: string;
  seed: number;
  attempts: number;
  boardHash: string;
  routeHash: string;
  target: number;
  proof: string;
}

export const hitappsDirectorRecords = [...early, ...middle, ...later, ...final, ...retry] as HitappsDirectorRecord[];
const bases = new Map([...content8Dealer, ...content8Wave, ...content8Late].map(base => [base.id, base]));
export const hitappsDirectorDeals = hitappsDirectorRecords.map(record => {
  const base = bases.get(record.baseId)!;
  const direction = record.direction === 'easy' ? 'relief' : record.direction;
  const deal: Deal = { ...base, id: record.id,
    initial: { ...base.initial, tableau: record.tableau, stock: record.stock,
      faceUp: record.tableau.flatMap(pile => pile.slice(-1)), movesLeft: record.budget },
    winningPath: decodeRoute(record.route), recoveryPaths: undefined,
    adaptive: { version: 1, profile: 'c8-hitapps-authoring-v1', baseId: base.id, direction,
      scope: 'PRODUCT_ADAPTED', proof: record.proof },
  };
  return { deal, direction: record.direction };
});
