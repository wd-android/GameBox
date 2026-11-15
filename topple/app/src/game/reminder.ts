import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/** Daily reminder notification (§13), scheduled on the device only. Returns false where unavailable. */
export async function scheduleReminder(on: boolean, time: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return !on;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    if (!on) return true;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return false;
    const [hour, minute] = time.split(':').map(Number);
    await LocalNotifications.schedule({
      notifications: [{ id: 1, title: "Today's Topple is ready", body: 'A new chain is waiting to fall.', schedule: { on: { hour, minute }, allowWhileIdle: true } }],
    });
    return true;
  } catch {
    return false;
  }
}
