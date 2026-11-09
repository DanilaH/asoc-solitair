import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AnalyticsParams } from '@danilah/mini-games-kit/platform';
import contract from './analytics-contract.json';

export type AnalyticsEvent = keyof typeof contract;
export interface AnalyticsBridge {
  report(options: { event: string; params: AnalyticsParams }): Promise<void>;
}
export function validEvent(event: string, params: AnalyticsParams): boolean {
  if (!Object.hasOwn(contract, event)) return false;
  const fields = contract[event as AnalyticsEvent] as Record<string, string>;
  return Object.keys(params).length === Object.keys(fields).length && Object.entries(fields).every(([key, type]) => {
    const value = params[key];
    return typeof value === type && (type !== 'number' || Number.isFinite(value)) &&
      (type !== 'string' || (value as string).length <= 160);
  });
}
export function createAnalytics(bridge?: AnalyticsBridge) {
  const native = bridge ?? (Capacitor.isNativePlatform() ? registerPlugin<AnalyticsBridge>('SolitaireAnalytics') : undefined);
  let disposed = false;
  let outstanding = 0;
  return {
    track(event: AnalyticsEvent, params: AnalyticsParams): void {
      if (disposed || !native || outstanding >= 32 || !validEvent(event, params)) return;
      outstanding += 1;
      try {
        void native.report({ event, params: { ...params } }).catch(() => undefined).finally(() => { outstanding -= 1; });
      } catch { outstanding -= 1; }
    },
    destroy(): void { disposed = true; },
  };
}
