import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifeline.bloodapp',
  appName: 'LifeLine',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
