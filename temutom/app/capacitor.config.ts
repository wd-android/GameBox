import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.promethica.temutom',
  appName: 'Temutom',
  webDir: 'dist',
  backgroundColor: '#180038',
  android: { minWebViewVersion: 80 },
  ios: { contentInset: 'never', backgroundColor: '#180038' },
};

export default config;
