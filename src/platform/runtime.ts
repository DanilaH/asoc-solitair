import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { GameplayActivityCoordinator, installDocumentVisibilityBlocker } from '@danilah/mini-games-kit/platform';
import { OneShotPlayer } from '@danilah/mini-games-kit/audio';
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { cueSamples } from './sounds';
import { createHaptics, type HapticCue } from './haptics';
export { decodeSave } from './storage';
interface AudioBridge {
  configure(options: { enabled: boolean }): Promise<{ focused: boolean }>;
  addListener(name: 'audioFocus', cb: (event: { focused: boolean }) => void): Promise<PluginListenerHandle>;
}

export function createRuntime(onCancel: () => void, onBack: () => void) {
  if (Capacitor.isNativePlatform()) document.body.classList.add('platform-native');
  const activity = new GameplayActivityCoordinator(() => undefined, () => undefined);
  const visibility = installDocumentVisibilityBlocker(activity);
  const audio = new OneShotPlayer({
    maxVoices: 4,
    groups: { card: { minIntervalMs: 45 }, flip: { minIntervalMs: 70 }, reward: { minIntervalMs: 80 }, ui: { minIntervalMs: 40 } },
  });
  const haptics = createHaptics();
  const nativeAudio = Capacitor.isNativePlatform() ? registerPlugin<AudioBridge>('SolitaireAudio') : undefined;
  let audioFocused = !nativeAudio;
  let disposed = false;
  let mute = false;
  const handles: { remove: () => Promise<void> }[] = [];
  const buffers = new Map<string, AudioBuffer>();
  const variants = new Map<string, number>();
  const eligibility = () => {
    const reasons = activity.getBlockReasons();
    audio.setEligibility({ gameplay: audioFocused && !mute && reasons.length === 0, ui: audioFocused && !mute && reasons.every(r => r === 'modal' || r === 'screen') });
    haptics.setBlocked(reasons.some(reason => reason !== 'modal' && reason !== 'screen'));
    if (reasons.length) onCancel();
    void nativeAudio?.configure({ enabled: !mute && !reasons.some(reason => reason !== 'modal' && reason !== 'screen') }).then(({ focused }) => {
      if (disposed) return;
      audioFocused = focused;
      const current = activity.getBlockReasons();
      audio.setEligibility({ gameplay: focused && !mute && current.length === 0, ui: focused && !mute && current.every(r => r === 'modal' || r === 'screen') });
    }).catch(() => undefined);
  };
  const removeBlocker = activity.onBlockReasonsChange(eligibility);
  if (Capacitor.isNativePlatform()) {
    let stateEvents = 0;
    const retain = (pending: ReturnType<typeof App.addListener>) => {
      void pending.then(handle => { if (disposed) void handle.remove(); else handles.push(handle); }).catch(console.warn);
    };
    retain(App.addListener('appStateChange', ({ isActive }) => { stateEvents++; if (!disposed) activity.setBlocked('native-background', !isActive); }));
    retain(App.addListener('backButton', () => { if (!disposed) onBack(); }));
    void App.getState().then(({ isActive }) => { if (!disposed && stateEvents === 0) activity.setBlocked('native-background', !isActive); }).catch(console.warn);
  }
  if (nativeAudio) void nativeAudio.addListener('audioFocus', ({ focused }) => {
    if (disposed) return;
    audioFocused = focused;
    const reasons = activity.getBlockReasons();
    audio.setEligibility({ gameplay: focused && !mute && reasons.length === 0, ui: focused && !mute && reasons.every(r => r === 'modal' || r === 'screen') });
  }).then(handle => { if (disposed) void handle.remove(); else handles.push(handle); }).catch(() => undefined);
  activity.setGameplayDesired(true);
  return {
    activity,
    setMute(value: boolean) { mute = value; eligibility(); },
    setHaptics(value: boolean) { haptics.setEnabled(value); },
    pulse(cue: HapticCue) { haptics.pulse(cue); },
    play(name: string) {
      const variant = (variants.get(name) ?? 0) % 3; variants.set(name, variant + 1);
      const key = `${name}:${variant}`;
      const group = ['coins', 'win', 'complete'].includes(name) ? 'reward' : name === 'flip' ? 'flip' : name === 'ui' ? 'ui' : 'card';
      audio.play({ group, channel: name === 'ui' ? 'ui' : 'gameplay', gain: .32, buffer(ctx) {
        let buffer = buffers.get(key);
        if (!buffer) {
          const samples = cueSamples(name, ctx.sampleRate, variant);
          buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
          buffer.copyToChannel(samples, 0);
          buffers.set(key, buffer);
        }
        return buffer;
      } });
    },
    destroy() { disposed = true; visibility(); removeBlocker(); handles.forEach(h => { void h.remove().catch(console.warn); }); audio.dispose(); haptics.destroy(); void nativeAudio?.configure({ enabled: false }).catch(() => undefined); activity.setGameplayDesired(false); },
  };
}
