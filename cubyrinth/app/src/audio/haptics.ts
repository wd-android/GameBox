import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { TUNING } from '../config/tuning';

/**
 * Haptics as silent audio (§11). Continuous vibration is emulated with rapid
 * light taps while pouring, which works on both iPhone and Android (§15).
 */
class Haptic {
  enabled = true;
  private native = Capacitor.isNativePlatform();
  private pourTimer: number | null = null;

  private impact(style: ImpactStyle, webMs: number): void {
    if (!this.enabled) return;
    if (this.native) void Haptics.impact({ style }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(webMs);
  }

  light(): void {
    this.impact(ImpactStyle.Light, 8);
  }

  medium(): void {
    this.impact(ImpactStyle.Medium, 18);
  }

  firm(): void {
    if (!this.enabled) return;
    if (this.native) void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(40);
  }

  double(): void {
    this.light();
    window.setTimeout(() => this.light(), 110);
  }

  /** Gentle buzz while pouring; stops the instant the thumb lifts. */
  setPouring(on: boolean): void {
    if (on && this.enabled && this.pourTimer === null) {
      this.light();
      this.pourTimer = window.setInterval(() => this.light(), TUNING.HAPTIC_ROLL_INTERVAL_MS);
    } else if (!on && this.pourTimer !== null) {
      window.clearInterval(this.pourTimer);
      this.pourTimer = null;
      if (!this.native && navigator.vibrate) navigator.vibrate(0);
    }
  }
}

export const haptic = new Haptic();
