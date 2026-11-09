export const RULES_VERSION = 1;
export const CONTENT_VERSION = 2;
export const BALANCE_VERSION = 1;
export interface Card {
  id: string; category: string; text: string; leader?: boolean; image?: string; explanation: string;
}
export interface Board {
  tableau: string[][]; foundations: string[][]; stock: string[]; waste: string[];
  faceUp: string[]; collected: string[]; movesLeft: number | null;
  phase: 'playing' | 'exhausted' | 'won';
}
export interface Location { kind: 'tableau' | 'waste' | 'foundation'; index: number }
export type BoardCommand = { type: 'transfer'; from: Location; to: Location }
  | { type: 'draw' } | { type: 'recycle' };
export type Command = BoardCommand | { type: 'undo' } | { type: 'restart'; attemptId: string }
  | { type: 'hint'; revision: number; action: BoardCommand };
export interface Deal {
  id: string; version: number; title: string; cards: Record<string, Card>; initial: Board;
  winningPath: BoardCommand[]; editorialStatus: string;
  campaignLevel?: number;
  tags?: string[];
}
export interface Attempt {
  id: string; dealId: string; board: Board; undo: Board[];
  streak: { tier: number; progress: number; coins: number; counted: string[] };
  continued?: boolean;
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
export interface Save {
  schema: 1; rulesVersion: number; contentVersion: number; balanceVersion: number; revision: number;
  profile: { coins: number; hints: number; undos: number; rewards: string[]; wins: number };
  attempt: Attempt;
  settings: { sfx: boolean; haptics: boolean; reducedMotion: boolean };
  platform?: PlatformState;
  campaign?: { version: 1; tutorials: string[] };
}
export interface GameEvent {
  type: 'transfer' | 'draw' | 'recycle' | 'flip' | 'complete' | 'coins' | 'win' | 'undo' | 'invalid' | 'hint' | 'restart';
  cards?: string[]; category?: string; amount?: number; reason?: string;
}
export interface Result { next: Save; accepted: boolean; events: GameEvent[]; reason?: string }
