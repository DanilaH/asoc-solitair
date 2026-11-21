import { boardRules, dispatch, freshSave } from '../domain/engine';
import { campaignId } from '../domain/progression';
import { platformState } from '../domain/services';
import type { Deal, Save } from '../domain/types';
import { recordLearning } from './tutorial';

export interface Q2Position {
  id: string;
  level: number;
  dealId: string;
  move: number;
  movesLeft: number;
}

export const q2Positions: readonly Q2Position[] = [
  { id: '15-97', level: 15, dealId: 'campaign-c8-dealer-015', move: 97, movesLeft: 22 },
  { id: '21-87', level: 21, dealId: 'campaign-c8-wave-021', move: 87, movesLeft: 84 },
  { id: '45-1', level: 45, dealId: 'campaign-c8-special-045', move: 1, movesLeft: 191 },
  { id: '70-1', level: 70, dealId: 'campaign-c8-wave-070', move: 1, movesLeft: 122 },
  { id: '70-38', level: 70, dealId: 'campaign-c8-wave-070', move: 38, movesLeft: 85 },
];

export function buildQ2Save(position: Q2Position, deal: Deal, id: string, settings: Save['settings']): Save {
  if (deal.id !== position.dealId || deal.campaignLevel !== position.level || !deal.winningPath[position.move - 1])
    throw Error('Эта версия раздачи не подходит для контрольной позиции.');
  let save = freshSave(deal, id);
  save.settings = { ...settings };
  platformState(save).completedCampaign = Array.from({ length: position.level - 1 }, (_, index) => campaignId(index + 1));
  for (const action of deal.winningPath.slice(0, position.move - 1)) {
    const before = save.attempt.board;
    const result = dispatch(save, action, deal);
    if (!result.accepted) throw Error('Не удалось воспроизвести ходы контрольной позиции.');
    save = result.next;
    recordLearning(save, before, action, deal);
  }
  const board = save.attempt.board;
  if (boardRules(board) !== 3 || board.phase !== 'playing' || board.movesLeft !== position.movesLeft)
    throw Error('Доска или лимит ходов отличаются от контрольной позиции.');
  if (position.move > 1) save.attempt.telemetry = { started: true, finished: false, activeMs: 0 };
  return save;
}
