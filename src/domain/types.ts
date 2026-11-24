import type { ProductOffers } from './commerce/product-offers';
import type { Combo } from './events/combo';
import type { DailyBonus } from './events/daily-bonus';
import { releaseProfile } from '../config/profile';
import type { LavaRun } from './events/campaign-liveops';
import type { CampaignLives } from './campaign-lives';
import type { StoreProgress } from './commerce/storefront';
import type { CampaignAdsState } from './campaign-advertising';
import type { DailyTaskJournal } from './events/daily-tasks';
import type { PictureState } from './events/picture';
import type { EventLedger } from './events/ledger';
import type { OfferCampaignJournal } from './commerce/offer-campaigns';
import type { CommerceJournal } from './commerce/orders';
import type { RewardOffers } from './reward-offers';

export const RULES_VERSION = 3;
export const CONTENT8_PREVIEW = Boolean(releaseProfile) || import.meta.env?.VITE_CONTENT8_PREVIEW === '1';
export const LEGACY_OWNER_PREVIEW = releaseProfile ? undefined : import.meta.env?.VITE_C8_OWNER_PREVIEW;
export const OWNER_ACCEPTANCE_PREVIEW = LEGACY_OWNER_PREVIEW === 'acceptance';
export const CONTENT_VERSION = CONTENT8_PREVIEW ? 8 : 7;
export const BALANCE_VERSION = 3;
export interface Card {
  id: string; category: string; text: string; leader?: boolean; image?: string; rank?: number; ordered?: boolean; keyId?: string; explanation: string;
}
export interface Board {
  /** Persisted per board/Undo snapshot so active and parked attempts can differ. */
  rulesVersion?: 2 | 3;
  tableau: string[][]; foundations: string[][]; stock: string[]; waste: string[];
  faceUp: string[]; collected: string[]; movesLeft: number | null;
  phase: 'playing' | 'exhausted' | 'won';
  joker?: { column: number; boundary: number; card?: { version: 1; id: string; nativeType: 2; faceUp: true } };
  keys?: string[];
  recyclesLeft?: number;
  retainedMoves?: number;
}
export interface Location { kind: 'tableau' | 'waste' | 'foundation'; index: number }
export type BonusKind = 'foundation' | 'tableau';
export type BoardCommand = { type: 'transfer'; from: Location; to: Location }
  | { type: 'draw' } | { type: 'recycle' };
export type Command = BoardCommand | { type: 'place-joker'; column: number } | { type: 'undo' } | { type: 'restart'; attemptId: string }
  | { type: 'hint'; revision: number; action: BoardCommand };
export type DifficultyTier = 'normal' | 'hard' | 'superhard';
export type OpeningLesson = 'first' | 'stock' | 'hint' | 'undo' | 'planning' | 'joker' | 'ordered' | 'keys';
export interface Deal {
  id: string; version: number; title: string; cards: Record<string, Card>; initial: Board;
  winningPath: BoardCommand[]; editorialStatus: string;
  /** Frozen pre-v3 witness, only used when continuing an existing v2 attempt. */
  legacyWinningPath?: BoardCommand[];
  campaignLevel?: number;
  tags?: string[];
  lock?: { version?: 2; column: number; requiredKeys: string[] };
  frozen?: { version: 1; layers: Readonly<Record<string, number>> };
  bound?: { version: 1; scissorsByCard: Readonly<Record<string, string>> };
  puzzle?: { version: 1; pairs: readonly { top: string; bottom: string; illustration?: string }[] };
  golden?: { version: 1; ids: readonly string[]; coinsPerCard: number; rewardGroup?: string };
  starter?: { version: 1; cards: Readonly<Record<string, 'magnet' | 'hammer'>> };
  shufflePreview?: 1;
  shufflePolicy?: 'hidden-pool-r1';
  shuffleCost?: 'charge';
  randomJokerPreview?: 1;
  randomJokerCost?: 1;
  extraHelpers?: { version: 1; randomJokerCoins?: number; unlimitedCoins: number; unlimitedMs: number };
  recovery?: { version: 1; freeRecycles: number; restoreBase: number; restoreIncrement: number };
  adaptive?: { version: 1; profile: string; baseId: string; direction: 'tight' | 'relief'; scope: 'PRODUCT_ADAPTED'; proof: string };
  bonusSlots?: Partial<Record<BonusKind, { coins: number }>>;
  difficultyTier?: DifficultyTier;
  training?: OpeningLesson;
  recoveryPaths?: BoardCommand[][];
  tutorialPath?: Command[];
  legacyTutorialPath?: Command[];
  daily?: { dayId: string; contentVersion: number; poolId: string };
}
export interface CampaignOutcome {
  outcome: 'Clean' | 'ExtraSteps' | 'Restart';
  restarts: number;
}
export interface CampaignIssuance {
  version: 1;
  profile: string;
  policy: string;
  baseId: string;
  dealId: string;
  baseBudget: number | null;
  effectiveBudget: number | null;
  source: 'authored' | 'director-r1' | 'budget-r2' | 'certified-seed';
  seed?: { value: number; inputHash: string; boardHash: string; routeHash: string };
  equality: 'unknown-cohort' | 'not-eligible';
}
type UnlimitedClock = { timeline: string; elapsed: number; wall: number };
export interface RecoveryClockReading { timeline: string; elapsed: number; native?: true }
export interface RandomJokerAccess {
  version: 1; id: string; source: 'coins'; cost: number; issuedAt: number; consumed?: true;
}

export interface Attempt {
  id: string; dealId: string; board: Board; undo: Board[];
  issuance?: CampaignIssuance;
  streak: { tier: number; progress: number; coins: number; counted: string[] };
  continued?: boolean;
  director?: { restarts: number; previousLosses: number; exhausted?: true };
  sourceDifficulty?: CampaignOutcome;
  jokerUsed?: boolean;
  randomJokerUsed?: true;
  randomJokerAccess?: RandomJokerAccess;
  lostLife?: true;
  adBreakShown?: true;
  coffeeRequested?: true;
  stockRestores?: number;
  revive?: { version: 1; channel: 'coins' | 'earned'; moves: number; price: number };
  unlimitedAccess?: {
    version: 1; id: string; attemptId: string; source: 'rewarded' | 'campaign' | 'coins';
    issuedAt: number; until: number; consumed?: true; expired?: true; clock?: UnlimitedClock;
  };
  unlimited?: { version: 1; id: string; issuedAt: number; until?: number; expired?: true; purchaseRef?: string;
    clock?: UnlimitedClock };
  shuffleUsed?: true;
  verifiedTaskHints?: number;
  combo?: Combo;
  lessonHint?: BoardCommand;
  daily?: { dayId: string; contentVersion: number };
  payout?: RewardGrant[];
  victory?: {
    version: 1; rewardKey: string; policy: string; tier: number;
    tierBase: number; movesBonus: number; contentVersion: number; balanceVersion: number;
  };
  telemetry?: { started: boolean; finished: boolean; activeMs: number };
}
export interface PlatformState {
  receipts: string[];
  continuedAttempts: string[];
  continueCredits: number;
  completedCampaign: string[];
  winsSinceInterstitial: number;
  lastFullscreenAt: number;
  fullscreenCadence?: { version: 1; lastShownId: string };
}
export interface RewardGrant { key: string; reason: 'win' | 'campaign_milestone' | 'campaign_win_cycle' | 'daily_completion' | 'daily_streak_milestone' | 'golden_cards'; label: string; coins: number; hints?: number; undos?: number }
export interface MetaState { version: 1; winCycle: number; cycles: number; dailyDates: string[]; dailyStreak: number; lastDaily?: string }
export interface EqualityIssuanceState {
  version: 1;
  eligible: number; attempted: number; selected: number; issued: number; lost: number; completed: number;
  last?: { attemptId: string; dealId: string; dealVersion: number; policyVersion: string; segment?: 'NonPayer' | 'Payer' | 'PotentialPayer' | 'SleepPayer'; cohortEvidence?: 'controlled-fixture' | 'verified-provider'; seed?: number; attestation?: string; providerRevision?: string; lost: boolean; completed: boolean };
}
export interface Save {
  schema: 1; rulesVersion: number; contentVersion: number; balanceVersion: number; revision: number;
  profile: { coins: number; hints: number; undos: number; jokers: number; rewards: string[]; wins: number };
  attempt: Attempt;
  settings: { sfx: boolean; haptics: boolean; reducedMotion: boolean; palette?: 'green' | 'ink'; cardBack?: 'classic' | 'diamonds'; deckSide?: 'right' | 'left'; deckPosition?: 'top' | 'bottom'; contentLanguage?: 'ru' | 'en' };
  meta?: MetaState;
  parked?: { campaign?: Attempt; daily?: Attempt };
  platform?: PlatformState;
  campaign?: { version: 1; tutorials: string[] };
  difficultyHistory?: CampaignOutcome[];
  equality?: EqualityIssuanceState;
  difficultyPenalty?: number;
  sourceDifficultyHistory?: CampaignOutcome[];
  sourceDifficultyPenalty?: number;
  rewardOffers?: RewardOffers;
  campaignAds?: CampaignAdsState;
  campaignLives?: CampaignLives;
  lavaRun?: LavaRun;
  commerce?: CommerceJournal;
  offerCampaigns?: OfferCampaignJournal;
  productOffers?: ProductOffers;
  commerceAccount?: string;
  storeProgress?: StoreProgress;
  events?: EventLedger;
  picture?: PictureState;
  dailyTasks?: DailyTaskJournal;
  dailyBonus?: DailyBonus;
  /** Separate paid-with-coins rights; unused grants outlive any one attempt. */
  randomJokers?: { version: 1; grants: RandomJokerAccess[] };
}
export interface GameEvent {
  type: 'transfer' | 'draw' | 'recycle' | 'flip' | 'complete' | 'coins' | 'win' | 'undo' | 'invalid' | 'hint' | 'restart' | 'joker' | 'key' | 'unlock' | 'meta-reward';
  cards?: string[]; category?: string; amount?: number; reason?: string;
}
export interface Result { next: Save; accepted: boolean; events: GameEvent[]; reason?: string }
