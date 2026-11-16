import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * Haptics (§7.14): a tap for each knock, scaled to its strength, and a firm
 * buzz for a turn and the finish. Works on both iPhone and Android.
 */
class Haptic {
  enabled = true;
  private native = Capacitor.isNativePlatform();

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
}

export const haptic = new Haptic();
