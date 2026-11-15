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
  // First launch opens directly on a puzzle (§12); later, resume the puzzle in progress or go home.
  app.start();
  // Developer aid: `?debug` exposes the app for automated browser checks.
  if (new URLSearchParams(location.search).has('debug')) (window as unknown as { topple: App }).topple = app;

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
      else if (app.save.tutorialDone >= 2) {
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
