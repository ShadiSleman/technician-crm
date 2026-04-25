import { registerPlugin } from '@capacitor/core'

export type DeviceContactsListPluginType = {
  getPhoneRows(options: { max?: number }): Promise<{
    rows: { id: string; name: string; phoneRaw: string }[]
  }>
}

/**
 * אנדרואיד: ‎ContentResolver עבור רשימת אנשי קשר (מיושם ב־Java).
 */
export const DeviceContactsList = registerPlugin<DeviceContactsListPluginType>(
  'DeviceContactsList',
  {
    web: {
      getPhoneRows: async () => ({ rows: [] }),
    },
  },
)
