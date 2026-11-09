import { Capacitor, registerPlugin } from '@capacitor/core';
export type HapticCue = 'button' | 'transfer' | 'complete' | 'invalid' | 'hint' | 'undo' | 'coins' | 'win';
export interface FeedbackBridge {
  pulse(options: { cue: HapticCue; issuedAt: number; generation: number }): Promise<void>;
  cancel(options: { generation: number }): Promise<void>;
}
export function createHaptics(bridge?: FeedbackBridge) {
  const native = bridge ?? (Capacitor.isNativePlatform() ? registerPlugin<FeedbackBridge>('SolitaireFeedback') : undefined);
  let generation = Date.now() * 1000, blocked = true, enabled = true, disposed = false;
  const cancel = () => { generation++; void native?.cancel({ generation }).catch(() => undefined); };
  return {
    setEnabled(value: boolean) { enabled = value; if (!value) cancel(); },
    setBlocked(value: boolean) { blocked = value; if (value) cancel(); },
    pulse(cue: HapticCue) { if (!disposed && enabled && !blocked) void native?.pulse({ cue, issuedAt: Date.now(), generation }).catch(() => undefined); },
    destroy() { disposed = true; cancel(); },
  };
}
