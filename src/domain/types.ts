import type { LavaRun } from './events/campaign-liveops';
import type { CampaignLives } from './campaign-lives';
import type { StoreProgress } from './commerce/storefront';
import type { CampaignAdsState } from './campaign-advertising';
import type { DailyTaskJournal } from './events/daily-tasks';
import type { PictureState } from './events/picture';
import type { EventLedger } from './events/ledger';
import type { CommerceJournal } from './commerce/orders';
import type { RewardOffers } from './reward-offers';

export const RULES_VERSION = 3;
export const CONTENT8_PREVIEW = import.meta.env?.VITE_CONTENT8_PREVIEW === '1';
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
  lock?: { column: number; requiredKeys: string[] };
  frozen?: { version: 1; layers: Readonly<Record<string, number>> };
  bound?: { version: 1; scissorsByCard: Readonly<Record<string, string>> };
  puzzle?: { version: 1; pairs: readonly { top: string; bottom: string }[] };
  golden?: { version: 1; ids: readonly string[]; coinsPerCard: number };
  starter?: { version: 1; cards: Readonly<Record<string, 'magnet' | 'hammer'>> };
  shufflePreview?: 1;
  randomJokerPreview?: 1;
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
export interface Attempt {
  id: string; dealId: string; board: Board; undo: Board[];
  streak: { tier: number; progress: number; coins: number; counted: string[] };
  continued?: boolean;
  director?: { restarts: number; previousLosses: number; exhausted?: true };
  sourceDifficulty?: CampaignOutcome;
  jokerUsed?: boolean;
  randomJokerUsed?: true;
  lostLife?: true;
  adBreakShown?: true;
  coffeeRequested?: true;
  stockRestores?: number;
  revive?: { version: 1; channel: 'coins' | 'earned'; moves: number; price: number };
  unlimited?: { version: 1; id: string; issuedAt: number; until?: number; expired?: true };
  shuffleUsed?: true;
  verifiedTaskHints?: number;
  lessonHint?: BoardCommand;
  daily?: { dayId: string; contentVersion: number };
  payout?: RewardGrant[];
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
  last?: { attemptId: string; dealId: string; dealVersion: number; policyVersion: string; segment?: 'NonPayer' | 'Payer' | 'PotentialPayer' | 'SleepPayer'; cohortEvidence?: 'controlled-fixture' | 'verified-provider'; seed?: number; lost: boolean; completed: boolean };
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
  rewardOffers?: RewardOffers;
  campaignAds?: CampaignAdsState;
  campaignLives?: CampaignLives;
  lavaRun?: LavaRun;
  commerce?: CommerceJournal;
  commerceAccount?: string;
  storeProgress?: StoreProgress;
  events?: EventLedger;
  picture?: PictureState;
  dailyTasks?: DailyTaskJournal;
}
export interface GameEvent {
  type: 'transfer' | 'draw' | 'recycle' | 'flip' | 'complete' | 'coins' | 'win' | 'undo' | 'invalid' | 'hint' | 'restart' | 'joker' | 'key' | 'unlock' | 'meta-reward';
  cards?: string[]; category?: string; amount?: number; reason?: string;
}
export interface Result { next: Save; accepted: boolean; events: GameEvent[]; reason?: string }
