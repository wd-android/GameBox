import '@fontsource/readex-pro/400.css';
import '@fontsource/readex-pro/500.css';
import '@fontsource/readex-pro/700.css';
import './ui/styles.css';
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
      await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true, preference: 'webgl' });
      return app;
    })(),
  ]);
  document.getElementById('stage')!.append(pixi.canvas);
  pixi.canvas.style.touchAction = 'none';
  const app = new App(save, pixi);
  // First launch opens directly in flight, with no menu (§9).
  if (!save.firstLaunchDone) app.fly();
  else app.goHome();
  if (new URLSearchParams(location.search).has('debug')) (window as unknown as { murmur: App }).murmur = app;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) app.background();
    else app.foreground();
  });
  if (Capacitor.isNativePlatform()) {
    void CapApp.addListener('pause', () => app.background());
    void CapApp.addListener('resume', () => app.foreground());
    void CapApp.addListener('backButton', () => {
      const overlays = app.ui.querySelectorAll('.overlay');
      const overlay = overlays[overlays.length - 1];
      // A sheet may handle 'back' itself; otherwise it just closes. With no sheet, the screen decides.
      if (overlay) {
        if (overlay.dispatchEvent(new CustomEvent('back', { cancelable: true }))) overlay.remove();
      } else if (app.current?.back) app.current.back();
      else app.goHome();
    });
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    void SplashScreen.hide().catch(() => {});
  }
}

void boot();
