import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/** Haptics (§10): ticks, pulses and a rolling pulse for a murmuration. */
class Haptic {
  enabled = true;
  private native = Capacitor.isNativePlatform();
  private last = 0;

  private impact(style: ImpactStyle, webMs: number): void {
    if (!this.enabled) return;
    if (this.native) void Haptics.impact({ style }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(webMs);
  }

  tick(): void {
    const now = performance.now();
    if (now - this.last < 40) return;
    this.last = now;
    this.impact(ImpactStyle.Light, 6);
  }

  firm(): void {
    this.impact(ImpactStyle.Heavy, 30);
  }

  double(): void {
    this.impact(ImpactStyle.Medium, 15);
    window.setTimeout(() => this.impact(ImpactStyle.Medium, 15), 130);
  }

  /** A long soft pulse. */
  long(): void {
    if (!this.enabled) return;
    if (this.native) for (let i = 0; i < 5; i++) window.setTimeout(() => void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}), i * 70);
    else if (navigator.vibrate) navigator.vibrate(300);
  }

  /** A rolling pulse that swells and fades. */
  rolling(): void {
    if (!this.enabled) return;
    const styles = [ImpactStyle.Light, ImpactStyle.Medium, ImpactStyle.Heavy, ImpactStyle.Medium, ImpactStyle.Light];
    if (this.native) styles.forEach((s, i) => window.setTimeout(() => void Haptics.impact({ style: s }).catch(() => {}), i * 110));
    else if (navigator.vibrate) navigator.vibrate([40, 60, 60, 60, 40]);
  }

  single(): void {
    if (!this.enabled) return;
    if (this.native) void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(60);
  }
}

export const haptic = new Haptic();
