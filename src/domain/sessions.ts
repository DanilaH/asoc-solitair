import { freshAttempt } from './engine';
import type { Deal, Save } from './types';
/** Active attempt is canonical. Only the other mode is parked; profile/economy are shared. */
export function switchMode(save: Save, mode: 'campaign' | 'daily', deal: Deal, attemptId: string): void {
  if (Boolean(deal.daily) !== (mode === 'daily') || !/^[a-zA-Z0-9_-]{1,100}$/.test(attemptId) || attemptId === save.attempt.id) throw Error('Некорректный переход режима');
  const active = save.attempt.daily ? 'daily' : 'campaign';
  if (active === mode && (mode === 'campaign' || save.attempt.dealId === deal.id)) return;
  const parked = save.parked ??= {};
  if (active !== mode) parked[active] = save.attempt;
  const target = parked[mode];
  save.attempt = target && (mode === 'campaign' || target.dealId === deal.id) ? target : freshAttempt(deal, attemptId);
  delete parked[mode]; save.revision++;
}
