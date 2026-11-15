import '@fontsource/readex-pro/400.css';
import '@fontsource/readex-pro/500.css';
import '@fontsource/readex-pro/700.css';
import './ui/styles.css';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { APP } from './config/app';
import { loadSave } from './state/save';
import { App } from './ui/app';

async function boot(): Promise<void> {
  document.title = APP.DISPLAY_NAME;
  const save = await loadSave();
  const app = new App(save);
  // Straight into play on first launch; afterwards resume a level in progress, else home.
  if (!save.seenTutorial) {
    save.seenTutorial = true;
    app.playLevel(1);
  } else if (!app.resume()) app.goHome();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) app.background();
    else app.foreground();
  });
  window.addEventListener('pagehide', () => app.background());

  if (Capacitor.isNativePlatform()) {
    void CapApp.addListener('pause', () => app.background());
    void CapApp.addListener('resume', () => app.foreground());
    void CapApp.addListener('backButton', () => {
      const overlay = app.ui.querySelector('.overlay');
      if (overlay) overlay.remove();
      else {
        app.current?.saveProgress?.();
        app.goHome();
      }
    });
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    void SplashScreen.hide().catch(() => {});
  }
}

void boot();
