import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/** Haptics as silent audio (report §7). All calls are fire-and-forget and safe on the web. */
class HapticEngine {
  on = true;
  private rumbleTimer: number | null = null;
  private rumbleKind: 'purr' | 'scream' | null = null;
  private native = Capacitor.isNativePlatform();

  set(on: boolean) {
    this.on = on;
    if (!on) this.rumble(null);
  }

  private impact(style: ImpactStyle) {
    if (!this.on) return;
    if (this.native) void Haptics.impact({ style }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(style === ImpactStyle.Heavy ? 30 : style === ImpactStyle.Medium ? 18 : 8);
  }

  tick() { this.impact(ImpactStyle.Light); }
  pulse() { this.impact(ImpactStyle.Medium); }
  firm() { this.impact(ImpactStyle.Heavy); }
  double() { this.tick(); window.setTimeout(() => this.tick(), 110); }
  doublePulse() { this.pulse(); window.setTimeout(() => this.pulse(), 140); }
  sharp() {
    if (!this.on) return;
    if (this.native) void Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    else navigator.vibrate?.([20, 40, 20]);
  }
  long() {
    if (!this.on) return;
    if (this.native) void Haptics.vibrate({ duration: 400 }).catch(() => {});
    else navigator.vibrate?.(300);
  }

  /** Continuous rumble: a soft purr, or a strong buzz while screaming */
  rumble(kind: 'purr' | 'scream' | null) {
    if (kind === this.rumbleKind) return;
    if (this.rumbleTimer != null) window.clearInterval(this.rumbleTimer);
    this.rumbleTimer = null;
    this.rumbleKind = kind;
    if (!kind || !this.on) return;
    const every = kind === 'scream' ? 90 : 420;
    this.rumbleTimer = window.setInterval(() => {
      if (kind === 'scream') this.impact(ImpactStyle.Heavy);
      else this.impact(ImpactStyle.Light);
    }, every);
  }
}

export const haptics = new HapticEngine();
