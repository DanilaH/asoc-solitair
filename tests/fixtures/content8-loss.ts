import { content8Late, content8Wave, decodeRoute } from '../../src/content/campaign-v8-dealer';
import { dispatch, freshSave } from '../../src/domain/engine';
import type { BoardCommand, Deal } from '../../src/domain/types';

export const recoverable = content8Wave[0];
export const unrecoverable = content8Late[6];
const parking = decodeRoute('t2>t0 t0>t2');
export const losingPath = [...recoverable.winningPath.slice(0, 128),
  ...Array.from({ length: 18 }, () => parking).flat()];
export const winningRescue = recoverable.winningPath.slice(128);

export function loadLoss(deal: Deal, id: string, stopBeforeLoss = false) {
  let save = freshSave(deal, id);
  const limit = deal.initial.movesLeft! - Number(stopBeforeLoss);
  for (let index = 0; index < limit; index++) {
    const action: BoardCommand = deal === recoverable ? losingPath[index]
      : { type: save.attempt.board.stock.length ? 'draw' : 'recycle' };
    const step = dispatch(save, action, deal);
    if (!step.accepted) throw Error(step.reason);
    save = step.next;
  }
  return save;
}
