import { Capacitor, registerPlugin } from '@capacitor/core';

export interface RecoveryClockReading {
  timeline: string;
  elapsed: number;
}

interface ClockBridge {
  readRecoveryClock(): Promise<{ boot: number; elapsed: number }>;
}

/** Android's elapsedRealtime includes suspend and persists across process death during a boot. */
export function createRecoveryClock() {
  const native = Capacitor.isNativePlatform() ? registerPlugin<ClockBridge>('SolitaireStorage') : undefined;
  const pageTimeline = `page-${crypto.randomUUID()}`;
  let anchor: { reading: RecoveryClockReading; sampledAt: number } | undefined;
  return {
    async refresh() {
      if (!native) return;
      try {
        const { boot, elapsed } = await native.readRecoveryClock();
        if (Number.isSafeInteger(boot) && boot >= 0 && Number.isSafeInteger(elapsed) && elapsed >= 0) {
          anchor = { reading: { timeline: `android-${boot}`, elapsed }, sampledAt: performance.now() };
        }
      } catch { /* Existing anchor still advances within this WebView. */ }
    },
    read(): RecoveryClockReading {
      const now = performance.now();
      if (!anchor) return { timeline: pageTimeline, elapsed: Math.floor(now) };
      return { timeline: anchor.reading.timeline, elapsed: anchor.reading.elapsed + Math.floor(Math.max(0, now - anchor.sampledAt)) };
    },
  };
}
