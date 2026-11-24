import { Capacitor, registerPlugin } from '@capacitor/core';
import type { RecoveryClockReading } from '../domain/types';
export type { RecoveryClockReading } from '../domain/types';

interface ClockBridge {
  readRecoveryClock(): Promise<{ boot: number; elapsed: number }>;
}

/** Android's elapsedRealtime includes suspend and persists across process death during a boot. */
export function createRecoveryClock() {
  const native = Capacitor.isNativePlatform() ? registerPlugin<ClockBridge>('SolitaireStorage') : undefined;
  const pageTimeline = `page-${crypto.randomUUID()}`;
  let anchor: { reading: RecoveryClockReading; sampledAt: number } | undefined;
  const clock = {
    async refresh(): Promise<boolean> {
      if (!native) return true;
      try {
        const { boot, elapsed } = await native.readRecoveryClock();
        if (Number.isSafeInteger(boot) && boot >= 0 && Number.isSafeInteger(elapsed) && elapsed >= 0) {
          anchor = { reading: { timeline: `android-${boot}`, elapsed }, sampledAt: performance.now() };
          return true;
        }
      } catch { /* Existing anchor still advances within this WebView. */ }
      return false;
    },
    read(): RecoveryClockReading {
      const now = performance.now();
      const source = native ? { native: true as const } : {};
      if (!anchor) return { timeline: pageTimeline, elapsed: Math.floor(now), ...source };
      return { timeline: anchor.reading.timeline, elapsed: anchor.reading.elapsed + Math.floor(Math.max(0, now - anchor.sampledAt)), ...source };
    },
    /** A new timed debit/consumption requires a fresh durable clock on Android. */
    async acquire(): Promise<RecoveryClockReading | undefined> {
      return await clock.refresh() ? clock.read() : undefined;
    },
  };
  return clock;
}
