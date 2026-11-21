import bank from './campaign-v8-beyond-bank.json' with { type: 'json' };
import { beyondCards, beyondRecipes } from './beyond80-topics';
import { decodeRoute } from './campaign-v8-dealer';
import type { Deal } from '../domain/types';

type BankRecord = Omit<Deal, 'cards'|'winningPath'|'recoveryPaths'> & { winningPath: string; recoveryPaths: string[] };
export const beyond80Deals: readonly Deal[] = (bank as BankRecord[]).map(({ winningPath, recoveryPaths, ...record }) => {
  const recipe = beyondRecipes.find(recipe => recipe.level === record.campaignLevel);
  if (!recipe) throw Error('Unknown authored chapter topic set');
  return { ...record, cards: beyondCards(recipe), winningPath: decodeRoute(winningPath), recoveryPaths: recoveryPaths.map(decodeRoute) };
});
