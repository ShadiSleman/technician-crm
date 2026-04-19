/** בדיקת חיבור ל-Mongo בלי להריץ HTTP */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const { getMongoUri } = require('../src/mongoUri')

async function run() {
  const uri = getMongoUri()
  await mongoose.connect(uri)
  await mongoose.connection.db.admin().command({ ping: 1 })
  console.log('OK: MongoDB ping — מסד:', mongoose.connection.name)
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
