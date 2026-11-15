import '@fontsource/readex-pro/400.css';
import '@fontsource/readex-pro/500.css';
import '@fontsource/readex-pro/700.css';
import './ui/styles.css';
import './ui/harbour.css';
import { Application } from 'pixi.js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { APP } from './config/app';
import { loadSave } from './state/save';
import { App } from './ui/app';

async function boot(): Promise<void> {
  document.title = APP.DISPLAY_NAME;
  const [save, pixi] = await Promise.all([
    loadSave(),
    (async () => {
      const app = new Application();
      await app.init({ resizeTo: window, background: 0x06122b, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true, preference: 'webgl' });
      return app;
    })(),
  ]);
  document.getElementById('stage')!.append(pixi.canvas);
  pixi.canvas.style.touchAction = 'none';
  const app = new App(save, pixi);
  // First launch opens directly on a night, with no menu (§10).
  if (save.tutorial < 2) app.playTutorial();
  else app.goHome();
  if (new URLSearchParams(location.search).has('debug')) (window as unknown as { harbour: App }).harbour = app;

  document.addEventListener('visibilitychange', () => (document.hidden ? app.background() : app.foreground()));
  if (Capacitor.isNativePlatform()) {
    void CapApp.addListener('pause', () => app.background());
    void CapApp.addListener('resume', () => app.foreground());
    void CapApp.addListener('backButton', () => {
      const overlay = app.ui.querySelector('.overlay');
      if (overlay) overlay.remove();
      else app.goHome();
    });
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    void SplashScreen.hide().catch(() => {});
  }
}

void boot();
