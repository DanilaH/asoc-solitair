import { legalCommands } from '../domain/engine';
import { knownContinuation } from '../domain/solver';
import { freeHintDemo, seenTutorial } from '../domain/progression';
import type { BoardCommand, Deal, Save } from '../domain/types';

/** Observe accepted state: teaching never moves cards or spends resources. */
export function lesson(save: Save, deal: Deal): { action?: BoardCommand; attention?: 'hint' | 'undo' | 'joker' } | undefined {
  if (save.attempt.board.phase !== 'playing') return;
  if (deal.campaignLevel === 21 && !save.attempt.jokerUsed && save.profile.jokers > 0) return { attention: 'joker' };
  if (deal.campaignLevel === 3 && freeHintDemo(save, deal)) return { attention: 'hint' };
  if (deal.campaignLevel === 4 && !seenTutorial(save, 'undo-used') && save.attempt.undo.length) return { attention: 'undo' };
  if (!deal.campaignLevel || deal.campaignLevel > 2) return;
  if (save.platform?.completedCampaign.includes(deal.id)) return;
  const action = knownContinuation(save.attempt.board, deal)?.[0] ?? legalCommands(save.attempt.board, deal)[0];
  return action ? { action } : undefined;
}
