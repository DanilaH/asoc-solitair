import type { GameplayActivityCoordinator, AnalyticsParams } from '@danilah/mini-games-kit/platform';
import { BALANCE_VERSION, CONTENT_VERSION, RULES_VERSION, type Save } from '../domain/types';
import { createAnalytics, type AnalyticsEvent } from './analytics';

/** Monotonic active play excludes dialogs, ads, visibility and Android background time. */
export function createTelemetry(getSave: () => Save, activity: GameplayActivityCoordinator, analytics = createAnalytics(), clock = () => performance.now()) {
  let accumulated = getSave().attempt.telemetry?.activeMs ?? 0;
  let attemptId = getSave().attempt.id;
  let since: number | undefined;
  let enabled = false;
  const elapsed = () => Math.max(0, Math.round(accumulated + (since === undefined ? 0 : clock() - since)));
  const sync = () => {
    if (getSave().attempt.id !== attemptId) { accumulated = getSave().attempt.telemetry?.activeMs ?? 0; attemptId = getSave().attempt.id; since = undefined; }
    const active = enabled && !activity.isBlocked() && getSave().attempt.board.phase === 'playing';
    if (!active && since !== undefined) { accumulated = elapsed(); since = undefined; }
    else if (active && since === undefined) since = clock();
  };
  const remove = activity.onBlockedChange(sync);
  return {
    activeMs: elapsed,
    sync,
    ready() { enabled = true; sync(); },
    track(event: AnalyticsEvent, params: AnalyticsParams = {}) {
      const save = getSave();
      analytics.track(event, { schema: 1, mode: save.attempt.daily ? 'daily' : 'campaign', attemptId: save.attempt.id, dealId: save.attempt.dealId,
        rulesVersion: RULES_VERSION, contentVersion: CONTENT_VERSION, balanceVersion: BALANCE_VERSION,
        movesLeft: save.attempt.board.movesLeft ?? -1, activeMs: elapsed(), ...params });
    },
    destroy() { remove(); analytics.destroy(); },
  };
}
