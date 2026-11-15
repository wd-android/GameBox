import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/** Haptics (§13): every event has a twin in sound and on screen. */
class Haptic {
  enabled = true;
  private native = Capacitor.isNativePlatform();
  private last = 0;

  private impact(style: ImpactStyle, ms: number): void {
    if (!this.enabled) return;
    if (this.native) void Haptics.impact({ style }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(ms);
  }
  tick(): void {
    const now = performance.now();
    if (now - this.last < 25) return;
    this.last = now;
    this.impact(ImpactStyle.Light, 6);
  }
  light(): void {
    this.impact(ImpactStyle.Light, 10);
  }
  double(): void {
    this.impact(ImpactStyle.Medium, 14);
    window.setTimeout(() => this.impact(ImpactStyle.Medium, 14), 120);
  }
  firm(): void {
    if (!this.enabled) return;
    if (this.native) void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(40);
  }
  long(): void {
    if (!this.enabled) return;
    if (this.native) for (let i = 0; i < 6; i++) window.setTimeout(() => void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}), i * 70);
    else if (navigator.vibrate) navigator.vibrate(350);
  }
}

export const haptic = new Haptic();
