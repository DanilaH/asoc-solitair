import type { Save } from '../types';

export const OFFER_CAMPAIGNS_PREVIEW = import.meta.env?.VITE_C8_OWNER_PREVIEW === 'offer-campaigns';
export const OfferTrigger = {
  SessionStarted: 0, LevelStarted: 1, LevelCompleted: 2, LevelFailed: 3,
  NoValidMoves: 4, OutOfCoins: 5, OutOfBooster: 6, Manual: 7,
} as const;
export type Trigger = typeof OfferTrigger[keyof typeof OfferTrigger];
export const NamedOfferWindow = {
  boosters_coins_offer: 'ShowBoostersCoinsOffer',
  boosters_hint_offer: 'ShowBoostersHintOffer',
  welcome_offer: 'ShowWelcomeOffer',
} as const;
export type WindowId = keyof typeof NamedOfferWindow;

export type OfferEvent = {
  id: string; accountId: string; at: number; session: number; installedAt: number; level: number;
} & (
  { trigger: 0 | 1 | 3 | 5 | 7 } |
  { trigger: 2; completedLevel: number } |
  { trigger: 4; movesRemaining: number } |
  { trigger: 6; booster: 'definition' | 'hint' }
);

export interface OfferCampaignDefinition {
  version: 1;
  campaignId: string; revision: string; priority: number; enabled: boolean;
  provenance: 'PRODUCT_ADAPTED' | 'AZUR_BUILTIN_STATIC_WITH_LOCAL_SETTINGS';
  windowId: string; skus: readonly string[];
  activationTriggers: readonly Trigger[]; displayTriggers: readonly Trigger[];
  startsAt?: number; endsAt?: number;
  minLevel: number; maxLevel: number; minSession: number; minInstallAgeSeconds: number;
  lifetimeSeconds: number; activationCooldownSeconds: number; repeatShowCooldownSeconds: number;
  maxTotalShows: number; maxActivations: number; maxShowsPerActivation: number;
}

export function builtinWelcome(input: Pick<OfferCampaignDefinition, 'enabled' | 'campaignId' | 'revision' |
  'windowId' | 'skus' | 'lifetimeSeconds' | 'minLevel' | 'maxLevel' | 'minSession' | 'minInstallAgeSeconds' |
  'maxShowsPerActivation' | 'startsAt' | 'endsAt'>): OfferCampaignDefinition {
  const triggers = [OfferTrigger.OutOfCoins, OfferTrigger.SessionStarted] as const;
  return { ...input, version: 1, provenance: 'AZUR_BUILTIN_STATIC_WITH_LOCAL_SETTINGS',
    priority: 5000, maxTotalShows: 2, maxActivations: 2, activationCooldownSeconds: 0, repeatShowCooldownSeconds: 0,
    activationTriggers: triggers, displayTriggers: triggers };
}

export function withBuiltinWelcome(definitions: readonly OfferCampaignDefinition[], input?: Parameters<typeof builtinWelcome>[0]) {
  if (!input?.enabled) return definitions;
  return [...definitions.filter(definition => definition.campaignId !== input.campaignId), builtinWelcome(input)];
}

interface CampaignState {
  campaignId: string; revision: string;
  activations: number; shows: number; activationShows: number;
  active?: { from: number; until: number };
  lastShownAt?: number; cooldownUntil: number;
}

interface AccountState {
  accountId: string; clock: number;
  events: { id: string; trigger: Trigger; level: number; presented?: string; booster?: 'definition' | 'hint'; movesRemaining?: number }[];
  campaigns: CampaignState[];
}

export interface OfferCampaignJournal { version: 1; accounts: AccountState[] }

const nat = (x: number) => Number.isSafeInteger(x) && x >= 0;
const token = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 128;
const trigger = (x: number): x is Trigger => nat(x) && x <= 7;
const distinct = (xs: string[]) => new Set(xs).size === xs.length;
const ordinal = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const levelFor = (event: OfferEvent) => event.trigger === OfferTrigger.LevelCompleted ? event.completedLevel : event.level;

function validEvent(event: OfferEvent) {
  return token(event.id) && token(event.accountId) && trigger(event.trigger) &&
    [event.at, event.session, event.installedAt, event.level, levelFor(event)].every(nat) && event.at >= event.installedAt &&
    (event.trigger !== OfferTrigger.NoValidMoves || (nat(event.movesRemaining) && event.movesRemaining > 0)) &&
    (event.trigger !== OfferTrigger.OutOfBooster || event.booster === 'definition' || event.booster === 'hint');
}
function validDefinition(d: OfferCampaignDefinition) {
  return d.version === 1 && token(d.campaignId) && token(d.revision) && Number.isSafeInteger(d.priority) &&
    d.skus.length > 0 && d.skus.every(token) &&
    [d.minLevel, d.maxLevel, d.minSession, d.minInstallAgeSeconds, d.lifetimeSeconds, d.activationCooldownSeconds,
      d.repeatShowCooldownSeconds, d.maxTotalShows, d.maxActivations, d.maxShowsPerActivation].every(nat) &&
    (!d.maxLevel || d.maxLevel >= d.minLevel) &&
    (d.startsAt === undefined || nat(d.startsAt)) && (d.endsAt === undefined || nat(d.endsAt)) &&
    (d.startsAt === undefined || d.endsAt === undefined || d.startsAt < d.endsAt) &&
    d.activationTriggers.every(trigger) && d.displayTriggers.every(trigger);
}

export function validOfferCampaignJournal(journal: OfferCampaignJournal): boolean {
  return journal?.version === 1 && Array.isArray(journal.accounts) &&
    distinct(journal.accounts.map(account => account?.accountId)) &&
    journal.accounts.every(account => account && token(account.accountId) && nat(account.clock) &&
      Array.isArray(account.events) && distinct(account.events.map(event => event?.id)) &&
      account.events.every(event => event && token(event.id) && trigger(event.trigger) && nat(event.level) &&
        (event.presented === undefined || token(event.presented)) &&
        (event.booster === undefined || event.trigger === OfferTrigger.OutOfBooster && (event.booster === 'definition' || event.booster === 'hint')) &&
        (event.movesRemaining === undefined || event.trigger === OfferTrigger.NoValidMoves && nat(event.movesRemaining) && event.movesRemaining > 0)) &&
      Array.isArray(account.campaigns) && distinct(account.campaigns.map(state => state?.campaignId)) &&
      account.campaigns.every(state => state && token(state.campaignId) && token(state.revision) &&
        [state.activations, state.shows, state.activationShows, state.cooldownUntil].every(nat) &&
        state.activationShows <= state.shows && state.activations <= state.shows &&
        (state.lastShownAt === undefined || (nat(state.lastShownAt) && state.lastShownAt <= account.clock)) &&
        (state.active === undefined ? state.activationShows === 0 :
          nat(state.active?.from) && nat(state.active?.until) && state.active.from <= account.clock && state.active.until > state.active.from)));
}

interface CampaignStore {
  mutate<T>(update: (save: Save) => T): Promise<T>;
}
interface Presentation { reveal(): void }
type Presenter = (definition: OfferCampaignDefinition, event: OfferEvent) => Presentation | false | undefined;
export interface OfferPresenters {
  named: Partial<Record<WindowId, Presenter>>;
  fallback?: Presenter;
}
const reached = (count: number, max: number) => max > 0 && count >= max;

function deactivated(state: CampaignState, at: number, seconds: number): CampaignState {
  return { ...state, active: undefined, activationShows: 0, cooldownUntil: Math.min(Number.MAX_SAFE_INTEGER, at + seconds * 1000) };
}

function ownsSku(save: Save, accountId: string, skus: readonly string[], at: number) {
  return (save.commerce?.orders ?? []).some(order => order.accountId === accountId && order.status === 'paid' &&
    order.grant !== undefined && order.grant.issuedAt <= at && skus.includes(order.sku));
}

/** Presenter stages synchronously. The only visible effect is released after a durable SaveStore commit. */
export function createOfferCampaignDispatcher(store: CampaignStore, config: {
  enabled: boolean; definitions: readonly OfferCampaignDefinition[]; presenters: OfferPresenters;
}) {
  const definitions = config.definitions.filter(validDefinition)
    .sort((a, b) => b.priority - a.priority || ordinal(a.campaignId, b.campaignId));
  if (!distinct(definitions.map(definition => definition.campaignId))) throw Error('Duplicate offer campaign ID');
  return async (event: OfferEvent) => {
    if (!config.enabled || !validEvent(event)) return { status: 'unavailable' } as const;
    const outcome = await store.mutate(next => {
      const journal = next.offerCampaigns ??= { version: 1, accounts: [] };
      let account = journal.accounts.find(entry => entry.accountId === event.accountId);
      if (!account) { account = { accountId: event.accountId, clock: 0, events: [], campaigns: [] }; journal.accounts.push(account); }
      if (account.events.some(entry => entry.id === event.id)) return { status: 'duplicate' } as const;
      if (event.at < account.clock) return { status: 'clock-rollback' } as const;
      account.clock = event.at;
      const at = event.at, level = levelFor(event);
      const occurrence: AccountState['events'][number] = { id: event.id, trigger: event.trigger, level };
      if (event.trigger === OfferTrigger.OutOfBooster) occurrence.booster = event.booster;
      if (event.trigger === OfferTrigger.NoValidMoves) occurrence.movesRemaining = event.movesRemaining;
      account.events.push(occurrence);
      const eligible: string[] = [];
      const attempted: string[] = [];
      const candidates = definitions.map(d => {
        const index = account.campaigns.findIndex(state => state.campaignId === d.campaignId);
        let state = account.campaigns[index] ?? { campaignId: d.campaignId, revision: d.revision,
          activations: 0, shows: 0, activationShows: 0, cooldownUntil: 0 };
        const owned = ownsSku(next, event.accountId, d.skus, at);
        if (state.active && (at >= state.active.until || owned)) {
          state = deactivated(state, owned ? at : state.active.until, d.activationCooldownSeconds);
          account.campaigns[index] = state;
        }
        return { d, index, state, owned };
      });
      for (const { d, index, state, owned } of candidates) {
        if (owned || !d.enabled || level < d.minLevel || (d.maxLevel > 0 && level > d.maxLevel) ||
            (d.startsAt !== undefined && at < d.startsAt) || (d.endsAt !== undefined && at >= d.endsAt) ||
            reached(state.shows, d.maxTotalShows) || !d.displayTriggers.includes(event.trigger)) continue;
        const isActive = state.active !== undefined;
        if (!isActive && (!d.activationTriggers.includes(event.trigger) || event.session < d.minSession ||
            at - event.installedAt < d.minInstallAgeSeconds * 1000 || at < state.cooldownUntil ||
            reached(state.activations, d.maxActivations))) continue;
        if (isActive && (reached(state.activationShows, d.maxShowsPerActivation) ||
            (state.lastShownAt !== undefined && at - state.lastShownAt < d.repeatShowCooldownSeconds * 1000))) continue;
        const until = at + Math.max(1, d.lifetimeSeconds) * 1000;
        if (!nat(until)) continue;
        eligible.push(d.campaignId);
        const named = Object.hasOwn(NamedOfferWindow, d.windowId) ? config.presenters.named[d.windowId as WindowId] : undefined;
        attempted.push(d.campaignId);
        const presentation = named?.(d, event) || config.presenters.fallback?.(d, event);
        if (!presentation) continue;
        const committed: CampaignState = {
          ...state, revision: d.revision, active: state.active ?? { from: at, until },
          activations: state.activations + (isActive ? 0 : 1), shows: state.shows + 1,
          activationShows: state.activationShows + 1, lastShownAt: at,
        };
        if (index < 0) account.campaigns.push(committed);
        else account.campaigns[index] = committed;
        occurrence.presented = d.campaignId;
        return { status: 'presenter-accepted', campaignId: d.campaignId, eligible, attempted, presentation } as const;
      }
      return { status: 'no-presentation', eligible, attempted } as const;
    });
    if (outcome.status !== 'presenter-accepted') return outcome;
    const { presentation, ...committed } = outcome;
    presentation.reveal();
    return committed;
  };
}
