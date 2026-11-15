import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * Haptics (§11). The chain's ripple is a light tick per clack; ticks closer
 * than the motor can resolve merge into one continuous ripple.
 */
class Haptic {
  enabled = true;
  private native = Capacitor.isNativePlatform();
  private lastTick = 0;

  private impact(style: ImpactStyle, webMs: number): void {
    if (!this.enabled) return;
    if (this.native) void Haptics.impact({ style }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(webMs);
  }

  light(): void {
    this.impact(ImpactStyle.Light, 8);
  }

  medium(): void {
    this.impact(ImpactStyle.Medium, 16);
  }

  firm(): void {
    if (!this.enabled) return;
    if (this.native) void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(40);
  }

  /** One clack. Ticks under 28 ms apart merge into a ripple instead of queueing. */
  clack(strong = false): void {
    const now = performance.now();
    if (now - this.lastTick < 28) return;
    this.lastTick = now;
    if (strong) this.medium();
    else this.light();
  }

  soft(): void {
    this.impact(ImpactStyle.Light, 6);
  }
}

export const haptic = new Haptic();
