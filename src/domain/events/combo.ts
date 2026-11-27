export interface MoveSummary {
  IsCardRelocation: boolean;
  IsDeckDraw: boolean;
  InvolvesWildCard: boolean;
  PlacedOnCardOrFoundation: boolean;
  SkippedPlayableWasteCard: boolean;
}
export const COMBO_STAGES = [2, 4, 7, 10, 15].map((coins, index) => ({ count: index + 4, coins }));
export interface Combo {
  version: 1;
  policy: 'azur-combo-candidate-r1' | 'azur-combo-deferred-r2';
  pending?: number;
  stage: number;
  progress: number;
}

export function comboDisposition(move: MoveSummary): 'reset' | 'advance' | 'neutral' {
  if (move.IsDeckDraw && move.SkippedPlayableWasteCard) return 'reset';
  if (move.IsCardRelocation && move.PlacedOnCardOrFoundation && !move.InvolvesWildCard) return 'advance';
  return 'neutral';
}

export function validCombo(combo: Combo) {
  const deferred = combo?.policy === 'azur-combo-deferred-r2';
  return Boolean(combo && combo.version === 1 && (deferred || combo.policy === 'azur-combo-candidate-r1') &&
    (deferred ? Number.isSafeInteger(combo.pending) && combo.pending! >= 0 && combo.pending! <= 2_000_000_000 &&
      combo.stage < COMBO_STAGES.length : combo.pending === undefined) &&
    Number.isSafeInteger(combo.stage) && combo.stage >= 0 && combo.stage <= COMBO_STAGES.length &&
    Number.isSafeInteger(combo.progress) && combo.progress >= 0 &&
    combo.progress < (COMBO_STAGES[combo.stage]?.count ?? 1));
}
