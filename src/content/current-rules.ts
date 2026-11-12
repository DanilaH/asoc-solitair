import witnesses from './rules-v3-paths.json' with { type: 'json' };
import { RULES_VERSION, type BoardCommand, type Command, type Deal } from '../domain/types';

/** The published orders/budgets and original witnesses remain in their original sources. */
export function withCurrentRules(deal: Deal): Deal {
  const paths = witnesses.paths as Record<string, BoardCommand[]>;
  const tutorials = witnesses.tutorialPaths as Record<string, Command[]>;
  return { ...deal, initial: { ...deal.initial, rulesVersion: RULES_VERSION },
    legacyWinningPath: deal.winningPath, winningPath: paths[deal.id] ?? deal.winningPath,
    ...(deal.tutorialPath ? { legacyTutorialPath: deal.tutorialPath, tutorialPath: tutorials[deal.id] ?? deal.tutorialPath } : {}) };
}
