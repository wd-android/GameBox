import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import '@fontsource/readex-pro/400.css';
import '@fontsource/readex-pro/500.css';
import '@fontsource/readex-pro/700.css';
import './ui/styles.css';
import './ui/lockbox.css';
import { loadSave, writeSave } from './state/save';
import { sound } from './audio/sound';
import { DEBUG, StoreProvider, applySettings } from './ui/store';
import { chestById } from './chest/chest';
import { startChest, startDaily, startRoute } from './ui/flow';
import { App } from './ui/App';

async function boot() {
  const save = await loadSave();
  applySettings(save);
  let start = startRoute(save);
  const q = new URLSearchParams(location.search);
  if (DEBUG) {
    const id = q.get('chest');
    const chest = id ? chestById(id) : null;
    if (chest) start = startChest(save, chest, (q.get('mode') as 'relaxed' | 'locksmith') ?? 'relaxed');
    const screen = q.get('screen');
    if (screen === 'vault' || screen === 'home' || screen === 'chapters') start = { name: screen };
    if (screen === 'map') start = { name: 'chapter', id: Number(q.get('ch') ?? 1) };
    if (screen === 'daily') start = startDaily(save);
  }
  void writeSave(save);

  // Sound may only start after a user gesture.
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock, { once: false, capture: true });

  if (Capacitor.isNativePlatform()) {
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    void SplashScreen.hide().catch(() => undefined);
    void CapApp.addListener('appStateChange', ({ isActive }) => (isActive ? sound.resume() : sound.suspend()));
  } else {
    document.addEventListener('visibilitychange', () => (document.hidden ? sound.suspend() : sound.resume()));
  }

  createRoot(document.getElementById('ui')!).render(
    <StoreProvider initial={save} start={start}>
      <App />
    </StoreProvider>,
  );
}

void boot();
