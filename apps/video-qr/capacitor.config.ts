import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'studio.marcandre.videoqr',
  appName: 'Video QR',
  webDir: 'dist',
  server: { hostname: 'localhost', androidScheme: 'https', iosScheme: 'capacitor' },
};
export default config;
