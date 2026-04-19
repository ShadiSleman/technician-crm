import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'il.technician.mazganim',
  appName: 'מעקב לקוחות',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
}

export default config
