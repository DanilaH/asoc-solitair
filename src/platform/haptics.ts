import { Capacitor, registerPlugin } from '@capacitor/core';
export type HapticCue = 'button' | 'transfer' | 'complete' | 'invalid' | 'hint' | 'undo' | 'coins' | 'win' | 'loss' | 'streak-break' | 'draw' | 'invalid-heavy' | 'coin-land';
export interface FeedbackBridge {
  pulse(options: { cue: HapticCue; issuedAt: number; generation: number }): Promise<void>;
  cancel(options: { generation: number }): Promise<void>;
}
export function createHaptics(bridge?: FeedbackBridge) {
  const native = bridge ?? (Capacitor.isNativePlatform() ? registerPlugin<FeedbackBridge>('SolitaireFeedback') : undefined);
  let generation = Date.now() * 1000, blocked = true, enabled = true, disposed = false;
  let lastCoinLanding = -Infinity;
  const cancel = () => { generation++; void native?.cancel({ generation }).catch(() => undefined); };
  return {
    setEnabled(value: boolean) { enabled = value; if (!value) cancel(); },
    setBlocked(value: boolean) { blocked = value; if (value) cancel(); },
    pulse(cue: HapticCue) {
      if (disposed || !enabled || blocked || !native) return;
      const issuedAt = Date.now();
      if (cue === 'coin-land') {
        if (issuedAt - lastCoinLanding < 350) return;
        lastCoinLanding = issuedAt;
      }
      void native.pulse({ cue, issuedAt, generation }).catch(() => undefined);
    },
    destroy() { disposed = true; cancel(); },
  };
}
