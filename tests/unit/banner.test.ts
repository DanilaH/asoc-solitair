import { afterEach, expect, it, vi } from 'vitest';
import { NativeBanner } from '../../src/platform/banner';
import type { AdsBridge } from '../../src/platform/ads';

afterEach(() => { vi.unstubAllGlobals(); });
function harness(fractional = false) {
  let frame: FrameRequestCallback | undefined;
  let focused = true;
  const listeners = new Map<string, () => void>();
  vi.stubGlobal('window', {
    addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  });
  vi.stubGlobal('innerWidth', 360); vi.stubGlobal('innerHeight', 800);
  const width = fractional ? 360.25 : 360, height = fractional ? 800.25 : 800;
  vi.stubGlobal('document', { hasFocus: () => focused, documentElement: { getBoundingClientRect: () => ({ width, height }) } });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frame = cb; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => { frame = undefined; });
  const slot = { hidden: true, style: { height: '60px' }, getBoundingClientRect: () => ({ x: fractional ? 12.25 : 0, y: fractional ? 740.25 : 700, width: fractional ? width - 24.5 : width, height: parseInt(slot.style.height) }) } as unknown as HTMLElement;
  const geometry = { webView: { x: 0, y: 0, width: 360, height: 800 }, root: { width: 360, height: 800 }, adHeight: fractional ? 58 : 90 };
  const bridge = { measureBanner: vi.fn(async () => geometry), placeBanner: vi.fn(async () => undefined), hideBanner: vi.fn(async () => undefined) } as unknown as AdsBridge;
  const banner = new NativeBanner(bridge, slot);
  return { banner, slot, bridge, geometry,
    focus(value: boolean) { focused = value; listeners.get(value ? 'focus' : 'blur')?.(); },
    async frame() { const cb = frame; frame = undefined; cb?.(0); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); } };
}
it('reserves SDK-required height before attaching a banner and keeps the reservation through a modal', async () => {
  const h = harness(); h.banner.setEligible(true, false); await h.frame();
  expect(h.slot.style.height).toBe('90px'); expect(h.bridge.placeBanner).not.toHaveBeenCalled();
  await h.frame(); expect(h.bridge.placeBanner).toHaveBeenCalledTimes(1);
  h.banner.setEligible(true, true); expect(h.slot.hidden).toBe(false); expect(h.bridge.hideBanner).toHaveBeenCalled();
  h.banner.destroy();
});
it('does not let a late measurement redisplay a hidden banner and bounds unresolved measurements', async () => {
  const h = harness(); let resolve!: (value: typeof h.geometry) => void;
  h.bridge.measureBanner = vi.fn(() => new Promise<typeof h.geometry>(r => { resolve = r; }));
  h.banner.setEligible(true, false); await h.frame();
  for (let i = 0; i < 30; i++) { h.banner.schedule(); await h.frame(); }
  expect(h.bridge.measureBanner).toHaveBeenCalledTimes(1);
  h.banner.setEligible(true, true); resolve(h.geometry); await Promise.resolve(); await Promise.resolve();
  expect(h.bridge.placeBanner).not.toHaveBeenCalled(); expect(h.slot.hidden).toBe(false); h.banner.destroy();
});
it('uses one fractional WebView viewport and sends the padded slot edges for native measurement', async () => {
  const h = harness(true);
  h.banner.setEligible(true, false); await h.frame(); await h.frame();
  expect(h.bridge.measureBanner).toHaveBeenCalledWith({ viewportWidth: 360.25, slotX: 12.25, slotWidth: 335.75 });
  expect(h.bridge.placeBanner).toHaveBeenCalledWith(expect.objectContaining({
    placement: expect.objectContaining({ kind: 'place', rect: expect.objectContaining({ x: 13, width: 334 }) }),
  }));
  h.banner.destroy();
});

it('retains one placement for stable Home/Game geometry until focus is lost', async () => {
  const h = harness(true);
  h.banner.setEligible(true, false);
  await h.frame();
  for (let i = 0; i < 6; i++) { h.banner.setEligible(true, false); await h.frame(); }
  expect(h.bridge.placeBanner).toHaveBeenCalledTimes(1);
  expect(h.bridge.measureBanner).toHaveBeenCalledTimes(1);
  expect(h.bridge.hideBanner).not.toHaveBeenCalled();
  h.focus(false);
  expect(h.slot.hidden).toBe(false);
  expect(h.bridge.hideBanner).toHaveBeenCalledTimes(1);
  h.focus(true);
  await h.frame();
  expect(h.bridge.placeBanner).toHaveBeenCalledTimes(2);
  h.banner.destroy();
});
