import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { createStorage } from './storage';
export { buildQ2Save, q2Positions } from '../app/q2-positions';

export async function createQ2Storage() {
  if (Capacitor.isNativePlatform()) {
    // The app ID owns the native save directory and WebView profile.
    const info = await App.getInfo().catch(() => undefined);
    return info?.id === 'com.danilah.asocsolitair.debug.q2' ? createStorage() : undefined;
  }
  const storage = createStorage();
  return {
    getItem: (key: string) => storage.getItem('q2:' + key),
    setItem: (key: string, value: string) => storage.setItem('q2:' + key, value),
    removeItem: (key: string) => storage.removeItem('q2:' + key),
  };
}
