/**
 * הגדרת סביבת פיתוח: יצירת משתמש admin אם חסר (סיסמה מוגדרת ב-setupDev.js)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const { getMongoUri } = require('../src/mongoUri')
const User = require('../src/models/User')

const DEFAULT_USER = 'admin'
const DEFAULT_PASS = 'HvacCrm_local_dev_9xK2'

async function run() {
  await mongoose.connect(getMongoUri())
  const existing = await User.countDocuments({})
  if (existing > 0) {
    console.log('setup: כבר קיימים משתמשים — דילוג על seed')
    await mongoose.disconnect()
    return
  }
  const passwordHash = await bcrypt.hash(DEFAULT_PASS, 10)
  await User.create({ username: DEFAULT_USER, passwordHash })
  console.log('setup: נוצר משתמש', DEFAULT_USER, '/', DEFAULT_PASS)
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
