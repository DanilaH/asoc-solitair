import { abandonCampaign } from './meta';
import { freshAttempt } from './engine';
import { unlockedLevel } from './progression';
import type { Deal, Save } from './types';

/** A confirmed level change owns no wallet reset and no campaign reward. */
export function beginDeal(save: Save, deal: Deal, attemptId: string): void {
  if (save.attempt.daily) throw Error('Сначала переключите режим');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(attemptId) || attemptId === save.attempt.id) throw Error('Нужен новый номер попытки');
  if (deal.campaignLevel === undefined || deal.campaignLevel > unlockedLevel(save)) throw Error('Этот уровень пока закрыт');
  abandonCampaign(save);
  save.attempt = freshAttempt(deal, attemptId);
  save.campaign ??= { version: 1, tutorials: [] };
  save.revision++;
}
