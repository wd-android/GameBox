import type { CapacitorConfig } from '@capacitor/cli';
import { APP } from './src/config/app';

const config: CapacitorConfig = {
  appId: APP.APP_ID,
  appName: APP.DISPLAY_NAME,
  webDir: 'dist',
  backgroundColor: '#1b043b',
  ios: { contentInset: 'never', backgroundColor: '#1b043b' },
  android: { backgroundColor: '#1b043b' },
  plugins: { SplashScreen: { launchShowDuration: 0, backgroundColor: '#1b043b', showSpinner: false } },
};

export default config;
