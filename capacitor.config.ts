import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'il.technician.mazganim',
  appName: 'Mazganim CRM',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
}

export default config
