import { abandonCampaign } from './meta';
import { carryCampaignRestart } from './difficulty';
import { issueEqualityDeal, type EqualityPreviewPolicy } from './equality-issuance';
import { freshAttempt } from './engine';
import { unlockedLevel } from './progression';
import { CONTENT8_PREVIEW, type Deal, type Save } from './types';

/** A confirmed level change owns no wallet reset and no campaign reward. */
export function beginDeal(save: Save, deal: Deal, attemptId: string, previousDeal?: Deal, equality?: EqualityPreviewPolicy): void {
  if (save.attempt.daily) throw Error('Сначала переключите режим');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(attemptId) || attemptId === save.attempt.id) throw Error('Нужен новый номер попытки');
  if (deal.campaignLevel === undefined || deal.campaignLevel > unlockedLevel(save)) throw Error('Этот уровень пока закрыт');
  const previous = save.attempt;
  abandonCampaign(save);
  save.attempt = freshAttempt(CONTENT8_PREVIEW ? issueEqualityDeal(save, deal, attemptId, equality) : deal, attemptId);
  if (save.dailyTasks) save.attempt.verifiedTaskHints = 0;
  if (CONTENT8_PREVIEW && previous.board.phase === 'exhausted' && previousDeal?.id === previous.dealId &&
    previousDeal.campaignLevel === deal.campaignLevel) carryCampaignRestart(previous, save.attempt);
  save.campaign ??= { version: 1, tutorials: [] };
  save.revision++;
}
