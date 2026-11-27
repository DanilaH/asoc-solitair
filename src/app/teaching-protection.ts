import { campaignCoreDealId } from '../config/hitapps-r4';
import { lesson, ruleIntroduction, specialRuleNote } from './tutorial';
import { hasReleaseLesson } from './c8-tutorial';
import { bonusOffer } from '../domain/bonus-slots';
import { releaseAdCadence } from '../domain/campaign-advertising';
import { completedLevels, seenTutorial } from '../domain/progression';
import type { Deal, Save } from '../domain/types';

export function firstBonusOffer(save: Save, deal: Deal) {
  if (campaignCoreDealId(deal.id)) {
    const kind = bonusOffer(deal, 'tableau') ? 'tableau' : 'foundation';
    const { board } = save.attempt;
    return bonusOffer(deal, kind) && !seenTutorial(save, 'intro:bonus-' + kind) &&
      board.foundations.every(pile => pile.length) && board.tableau.every(pile => pile.length) ? kind : undefined;
  }
  return (['foundation', 'tableau'] as const).find(kind => bonusOffer(deal, kind) &&
    !seenTutorial(save, `intro:bonus-${kind}`));
}

export function activelyTeaching(save: Save, deal: Deal, cue = lesson(save, deal)): boolean {
  const attempt = save.attempt;
  if (attempt.board.phase !== 'playing' || attempt.daily) return false;
  const level = deal.campaignLevel ?? 0;
  const special = specialRuleNote(save, deal);
  const protectOpening = campaignCoreDealId(deal.id) ? level === 1 : level > 0 && level <= 4;
  return protectOpening && completedLevels(save) < level || Boolean(cue || ruleIntroduction(save, deal) ||
    firstBonusOffer(save, deal) || special && (special.kind !== 'golden' || !seenTutorial(save, 'learn:golden')));
}

export function teachingProtected(save: Save, deal: Deal, teaching = activelyTeaching(save, deal)): boolean {
  const { attempt } = save;
  if (teaching) return true;
  if (attempt.teachingAds) return attempt.teachingAds.ordinary < releaseAdCadence.coffee.ordinaryActionsAfterLesson;
  if (campaignCoreDealId(deal.id)) return false;
  // An older saved tutorial may already be at its final action or result.
  return !attempt.daily && (hasReleaseLesson(deal) || Boolean(deal.training)) &&
    (attempt.board.phase === 'won' || completedLevels(save) < (deal.campaignLevel ?? 0));
}

export function recordTeachingAction(save: Save, deal: Deal, wasTeaching: boolean, ordinary: boolean) {
  const attempt = save.attempt;
  if (attempt.daily) return;
  if (wasTeaching || activelyTeaching(save, deal)) {
    attempt.teachingAds = { version: 1, ordinary: 0 };
    return;
  }
  if (!attempt.teachingAds && teachingProtected(save, deal)) attempt.teachingAds = { version: 1, ordinary: 0 };
  if (ordinary && attempt.teachingAds && attempt.teachingAds.ordinary < releaseAdCadence.coffee.ordinaryActionsAfterLesson) {
    attempt.teachingAds.ordinary++;
  }
}
