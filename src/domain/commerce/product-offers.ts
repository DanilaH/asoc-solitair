import { BALANCE } from '../balance';
import { definitionCount } from '../reward-offers';
import { boardKey, canReachTransfer } from '../engine';
import type { Deal, Save } from '../types';
import { createOfferCampaignDispatcher, OfferTrigger, type OfferCampaignDefinition, type OfferEvent } from './offer-campaigns';

type Cause = { trigger: 0 | 1 | 3 | 5 | 7 } | { trigger: 2; completedLevel: number } |
  { trigger: 4; movesRemaining: number } | { trigger: 6; booster: 'definition' | 'hint' };
type Resource = 'hint' | 'undo' | 'joker' | 'definition' | 'coins';
export type ContextFact = Cause & { key: string; resource?: Resource };
type Surface = 'resources' | 'result' | 'definition';

export interface ProductOffers {
  version: 1;
  installedAt: number;
  session: number;
  reservation?: { attemptId: string; eventId: string; surface: Surface; resource?: Resource };
}

const accountId = 'local-c8-profile';
const nat = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
const resources = ['hint', 'undo', 'joker', 'definition', 'coins'] as const;

export function validProductOffers(value: ProductOffers): boolean {
  const offer = value?.reservation;
  return Boolean(value?.version === 1 && nat(value.installedAt) && nat(value.session) && value.session > 0 &&
    (offer === undefined || (offer && ['resources', 'result', 'definition'].includes(offer.surface) &&
      (offer.resource === undefined || resources.includes(offer.resource)) &&
      typeof offer.attemptId === 'string' && /^[\w-]{1,100}$/.test(offer.attemptId) &&
      typeof offer.eventId === 'string' && offer.eventId.length > 0 && offer.eventId.length <= 128)));
}

export function startOfferSession(save: Save, now: number) {
  const profile = save.productOffers;
  if (!profile) save.productOffers = { version: 1, installedAt: now, session: 1 };
  else profile.session++;
}

export function noUsefulMoveFact(save: Save, deal: Deal, check = canReachTransfer): ContextFact | undefined {
  const { board } = save.attempt;
  if (save.attempt.daily || board.phase !== 'playing' || board.movesLeft === null || board.movesLeft <= 0 || check(board, deal)) return;
  return { trigger: OfferTrigger.NoValidMoves, movesRemaining: board.movesLeft, key: 'no-valid-moves' };
}

const routes = [
  { id: 'c8-local-welcome', window: 'welcome_offer', triggers: [OfferTrigger.SessionStarted, OfferTrigger.LevelStarted] },
  { id: 'c8-local-resources', window: 'boosters_coins_offer', triggers: [OfferTrigger.OutOfCoins, OfferTrigger.NoValidMoves, OfferTrigger.Manual] },
  { id: 'c8-local-helper', window: 'boosters_hint_offer', triggers: [OfferTrigger.OutOfBooster] },
  { id: 'c8-local-result', window: 'c8-result-guidance', triggers: [OfferTrigger.LevelCompleted, OfferTrigger.LevelFailed] },
] as const;

const definitions: OfferCampaignDefinition[] = routes.map((route, index) => ({
  version: 1, campaignId: route.id, windowId: route.window, revision: 'c8-context-r1',
  provenance: 'PRODUCT_ADAPTED', priority: routes.length - index, enabled: true,
  skus: [route.id], activationTriggers: route.triggers, displayTriggers: route.triggers,
  minLevel: 3, maxLevel: 0, minSession: 1, minInstallAgeSeconds: 0, lifetimeSeconds: 900,
  activationCooldownSeconds: 0, repeatShowCooldownSeconds: 0, maxTotalShows: 0, maxActivations: 0, maxShowsPerActivation: 0,
}));

export function createProductOfferAdapter(store: { mutate<T>(update: (save: Save) => T): Promise<T> }) {
  return (snapshot: Save, deal: Deal, fact: ContextFact, at: number) => {
    const profile = snapshot.productOffers;
    if (!profile || deal.campaignLevel === undefined || snapshot.attempt.daily || deal.id !== snapshot.attempt.dealId) return;
    const attemptId = snapshot.attempt.id;
    const suffix = fact.trigger === OfferTrigger.SessionStarted ? `session-${profile.session}` : fact.key;
    const id = `${suffix}:${attemptId}`.slice(0, 128);
    const event: OfferEvent = { ...fact, id, accountId, at, installedAt: profile.installedAt, session: profile.session, level: deal.campaignLevel };
    const surface: Surface = fact.trigger === OfferTrigger.LevelCompleted || fact.trigger === OfferTrigger.LevelFailed
      ? 'result' : fact.resource === 'definition' ? 'definition' : 'resources';

    const present = (_definition: OfferCampaignDefinition, _event: OfferEvent, current: Readonly<Save>) => {
      if (current.attempt.id !== attemptId || !current.productOffers) return;
      if (fact.trigger === OfferTrigger.NoValidMoves && (current.attempt.board.phase !== 'playing' ||
          current.attempt.board.movesLeft !== fact.movesRemaining || boardKey(current.attempt.board) !== boardKey(snapshot.attempt.board))) return;
      if (fact.trigger === OfferTrigger.OutOfCoins && (fact.resource === 'hint' || fact.resource === 'undo' || fact.resource === 'joker') &&
          current.profile.coins >= BALANCE.helperPrices[fact.resource]) return;
      if (fact.trigger === OfferTrigger.OutOfBooster &&
          (fact.booster === 'definition' ? definitionCount(current) : current.profile.hints) > 0) return;
      if (fact.trigger === OfferTrigger.LevelCompleted && current.attempt.board.phase !== 'won') return;
      if (fact.trigger === OfferTrigger.LevelFailed && current.attempt.board.phase !== 'exhausted') return;
      // The ordinary screen is opened by the player, so a reservation never interrupts a move.
      return {
        persist(next: Save) { next.productOffers!.reservation = { attemptId, eventId: id, surface, resource: fact.resource }; },
        reveal() {},
      };
    };
    return createOfferCampaignDispatcher(store, { enabled: true, definitions, recentEvents: 256,
      presenters: { named: { welcome_offer: present, boosters_coins_offer: present, boosters_hint_offer: present }, fallback: present },
    })(event);
  };
}
