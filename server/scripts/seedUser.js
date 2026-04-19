/**
 * יצירת משתמש ראשון (או נוסף):
 *   npm run seed:user -- myuser mypassword
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const { getMongoUri } = require('../src/mongoUri')
const User = require('../src/models/User')

async function run() {
  const username = String(process.argv[2] || process.env.SEED_USERNAME || '')
    .trim()
    .toLowerCase()
  const password = String(process.argv[3] || process.env.SEED_PASSWORD || '')
  if (!username || !password) {
    console.error('שימוש: npm run seed:user -- <username> <password>')
    process.exit(1)
  }

  await mongoose.connect(getMongoUri())
  const passwordHash = await bcrypt.hash(password, 10)
  await User.findOneAndUpdate(
    { username },
    { $set: { username, passwordHash } },
    { upsert: true, new: true },
  )
  console.log('משתמש נשמר:', username)
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
