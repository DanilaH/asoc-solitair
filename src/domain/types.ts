export const RULES_VERSION = 2;
export const CONTENT_VERSION = 5;
export const BALANCE_VERSION = 3;
export interface Card {
  id: string; category: string; text: string; leader?: boolean; image?: string; rank?: number; ordered?: boolean; keyId?: string; explanation: string;
}
export interface Board {
  tableau: string[][]; foundations: string[][]; stock: string[]; waste: string[];
  faceUp: string[]; collected: string[]; movesLeft: number | null;
  phase: 'playing' | 'exhausted' | 'won';
  joker?: { column: number; boundary: number };
  keys?: string[];
}
export interface Location { kind: 'tableau' | 'waste' | 'foundation'; index: number }
export type BoardCommand = { type: 'transfer'; from: Location; to: Location }
  | { type: 'draw' } | { type: 'recycle' };
export type Command = BoardCommand | { type: 'place-joker'; column: number } | { type: 'undo' } | { type: 'restart'; attemptId: string }
  | { type: 'hint'; revision: number; action: BoardCommand };
export interface Deal {
  id: string; version: number; title: string; cards: Record<string, Card>; initial: Board;
  winningPath: BoardCommand[]; editorialStatus: string;
  campaignLevel?: number;
  tags?: string[];
  lock?: { column: number; requiredKeys: string[] };
  tutorialPath?: Command[];
  daily?: { dayId: string; contentVersion: number; poolId: string };
}
export interface Attempt {
  id: string; dealId: string; board: Board; undo: Board[];
  streak: { tier: number; progress: number; coins: number; counted: string[] };
  continued?: boolean;
  jokerUsed?: boolean;
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
}
export interface RewardGrant { key: string; reason: 'win' | 'campaign_milestone' | 'campaign_win_cycle' | 'daily_completion' | 'daily_streak_milestone'; label: string; coins: number; hints?: number; undos?: number }
export interface MetaState { version: 1; winCycle: number; cycles: number; dailyDates: string[]; dailyStreak: number; lastDaily?: string }
export interface Save {
  schema: 1; rulesVersion: number; contentVersion: number; balanceVersion: number; revision: number;
  profile: { coins: number; hints: number; undos: number; jokers: number; rewards: string[]; wins: number };
  attempt: Attempt;
  settings: { sfx: boolean; haptics: boolean; reducedMotion: boolean; palette?: 'green' | 'ink'; cardBack?: 'classic' | 'diamonds'; deckSide?: 'right' | 'left'; deckPosition?: 'top' | 'bottom' };
  meta?: MetaState;
  parked?: { campaign?: Attempt; daily?: Attempt };
  platform?: PlatformState;
  campaign?: { version: 1; tutorials: string[] };
}
export interface GameEvent {
  type: 'transfer' | 'draw' | 'recycle' | 'flip' | 'complete' | 'coins' | 'win' | 'undo' | 'invalid' | 'hint' | 'restart' | 'joker' | 'key' | 'unlock' | 'meta-reward';
  cards?: string[]; category?: string; amount?: number; reason?: string;
}
export interface Result { next: Save; accepted: boolean; events: GameEvent[]; reason?: string }
