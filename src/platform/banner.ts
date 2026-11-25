import { resolveNativeBannerPlacement } from '@danilah/mini-games-kit/layout';
import type { AdsBridge } from './ads';

/** A single geometry flight; visibility epochs also cross the native bridge. */
export class NativeBanner {
  private generation = 0;
  private frame = 0;
  private alive = true;
  private visible = false;
  private eligible = false;
  private blocked = false;
  private oversized = false;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private appliedGeometry: string | undefined;
  private flight = false;
  private dirty = false;
  private observer: ResizeObserver;
  constructor(private bridge: AdsBridge, private slot: HTMLElement) {
    this.observer = new ResizeObserver(() => this.schedule()); this.observer.observe(slot);
    window.addEventListener('resize', this.resize);
    window.addEventListener('blur', this.focusChanged);
    window.addEventListener('focus', this.focusChanged);
    window.visualViewport?.addEventListener('resize', this.resize);
  }
  private hide() {
    this.appliedGeometry = undefined;
    void this.bridge.hideBanner({ generation: ++this.generation }).catch(() => undefined);
  }
  private resize = () => {
    this.oversized = false;
    this.hide();
    this.syncVisibility();
  };
  private focusChanged = () => this.syncVisibility();
  setEligible(eligible: boolean, blocked: boolean) {
    if (eligible !== this.eligible) this.oversized = false;
    this.eligible = eligible;
    this.blocked = blocked;
    this.syncVisibility();
  }
  retryAfterLoadError() {
    clearTimeout(this.retry);
    this.retry = setTimeout(() => {
      this.appliedGeometry = undefined;
      this.schedule();
    }, 61_000);
  }
  private syncVisibility() {
    const reserve = this.eligible && !this.oversized;
    this.slot.hidden = !reserve;
    const visible = reserve && !this.blocked && document.hasFocus();
    if (!visible && this.visible) this.hide();
    this.visible = visible;
    if (visible) this.schedule();
  }
  schedule() {
    if (!this.alive || !this.visible) return;
    if (this.flight) { this.dirty = true; return; }
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; void this.layout(); });
  }
  private async layout() {
    if (!this.alive || !this.visible || this.flight) return;
    this.flight = true; const generation = ++this.generation;
    try {
      // The full document root and the slot share one fractional CSS space in the native WebView.
      const rect = this.slot.getBoundingClientRect();
      const { width, height } = document.documentElement.getBoundingClientRect();
      const viewport = { width, height };
      if (rect.width <= 0 || rect.height <= 0) { this.hide(); return; }
      const geometry = [width, height, rect.x, rect.y, rect.width, rect.height].join(':');
      if (geometry === this.appliedGeometry) return;
      const measurement = await this.bridge.measureBanner({ viewportWidth: viewport.width, slotX: rect.x, slotWidth: rect.width });
      if (!this.alive || !this.visible || generation !== this.generation) return;
      if (!measurement) { this.hide(); this.retryAfterLoadError(); return; }
      const placement = resolveNativeBannerPlacement({ ...measurement, slot: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport });
      if (placement.kind === 'reserve') {
        this.hide();
        if (placement.heightCss > viewport.height * .16) {
          this.oversized = true;
          this.syncVisibility();
          return;
        }
        this.slot.style.height = `${placement.heightCss}px`; this.dirty = true; return;
      }
      if (placement.kind !== 'place') { this.hide(); return; }
      await this.bridge.placeBanner({ placement, generation });
      if (generation === this.generation) this.appliedGeometry = geometry;
    } catch {
      if (generation === this.generation) { this.hide(); this.retryAfterLoadError(); }
    }
    finally { this.flight = false; if (this.dirty) { this.dirty = false; this.schedule(); } }
  }
  destroy() {
    this.alive = false; clearTimeout(this.retry); cancelAnimationFrame(this.frame); this.observer.disconnect();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('blur', this.focusChanged);
    window.removeEventListener('focus', this.focusChanged); window.visualViewport?.removeEventListener('resize', this.resize);
    this.hide();
  }
}
