import { legalCommands, sourceCards } from '../domain/engine';
import { knownContinuation } from '../domain/solver';
import { completedLevels, freeHintDemo, markTutorial, seenTutorial } from '../domain/progression';
import type { Board, BoardCommand, Deal, Save } from '../domain/types';

type Skill = 'category' | 'match' | 'stock';
const marker = (skill: Skill) => `learn:${skill}`;
function skillFor(board: Board, action: BoardCommand, deal: Deal): Skill {
  if (action.type !== 'transfer') return 'stock';
  return action.to.kind === 'foundation' && sourceCards(board, action.from, deal).some(id => deal.cards[id].leader) ? 'category' : 'match';
}
/** Called inside the accepted SaveStore transition; Undo does not erase a learned skill. */
export function recordLearning(save: Save, before: Board, action: BoardCommand, deal: Deal): void {
  if (deal.campaignLevel && deal.campaignLevel <= 2) markTutorial(save, marker(skillFor(before, action, deal)));
}
export type RuleIntro = 'joker' | 'ordered' | 'keys';
const isJokerLesson = (deal: Deal) => deal.tags?.includes('joker') && deal.tags.includes('teaching');
export function ruleIntroduction(save: Save, deal: Deal): RuleIntro | undefined {
  if (deal.daily || save.attempt.board.phase !== 'playing') return;
  const rules: RuleIntro[] = [];
  if (isJokerLesson(deal)) rules.push('joker');
  if (deal.tags?.includes('ordered')) rules.push('ordered');
  if (deal.lock) rules.push('keys');
  return rules.find(rule => !seenTutorial(save, `intro:${rule}`) &&
    (deal.id.startsWith('campaign-c6-') || deal.id.startsWith('campaign-c7-') || completedLevels(save) < { joker: 21, ordered: 23, keys: 26 }[rule]));
}
/** Observe accepted state: teaching never moves cards or spends resources. */
export function lesson(save: Save, deal: Deal): { action?: BoardCommand; delay?: number; attention?: 'hint' | 'undo' | 'joker' } | undefined {
  if (save.attempt.board.phase !== 'playing') return;
  if (isJokerLesson(deal) && !save.attempt.jokerUsed && save.profile.jokers > 0) return { attention: 'joker' };
  if (deal.campaignLevel === 3 && freeHintDemo(save, deal)) return { attention: 'hint' };
  if (deal.campaignLevel === 4 && !seenTutorial(save, 'undo-used') && save.attempt.undo.length) return { attention: 'undo' };
  if (!deal.campaignLevel || deal.campaignLevel > 2 || completedLevels(save) >= deal.campaignLevel) return;
  if ((['category', 'match', 'stock'] as const).every(skill => seenTutorial(save, marker(skill)))) return;
  const action = knownContinuation(save.attempt.board, deal)?.[0] ?? legalCommands(save.attempt.board, deal)[0];
  return action ? { action, delay: seenTutorial(save, marker(skillFor(save.attempt.board, action, deal))) ? 6000 : 650 } : undefined;
}
