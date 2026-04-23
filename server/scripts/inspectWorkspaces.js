/**
 * מציג אילו Workspaces יש ב-Mongo וכמה לקוחות ב-data.customers לכל userId.
 * אין טבלת "customers" נפרדת — הלקוחות שמורים בתוך מסמך ה-workspace.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const { getMongoUri } = require('../src/mongoUri')
const Workspace = require('../src/models/Workspace')
const User = require('../src/models/User')

async function run() {
  const uri = getMongoUri()
  await mongoose.connect(uri)
  const dbName = mongoose.connection.name
  const cols = await mongoose.connection.db
    .listCollections()
    .toArray()
  const names = cols.map((c) => c.name).sort()
  console.log('מסד נתונים:', dbName)
  console.log('אוספים:', names.join(', '))
  if (!names.includes(Workspace.collection.name)) {
    console.warn(
      'הערה: אוסף ה-workspace הצפוי הוא',
      Workspace.collection.name,
      '(Mongoose ממפה את המודל לשם האוסף)',
    )
  }
  const n = await Workspace.countDocuments()
  console.log('מסמכי workspace:', n)
  const wss = await Workspace.find()
    .sort({ updatedAt: -1 })
    .lean()
  for (const ws of wss) {
    const cust = ws.data?.customers
    const nCust = Array.isArray(cust) ? cust.length : 0
    let uname = ''
    if (ws.userId) {
      const u = await User.findById(ws.userId).lean()
      if (u) uname = u.username
    }
    console.log(
      '— userId:',
      String(ws.userId),
      uname ? `(${uname})` : '',
      '| לקוחות ב-data.customers:',
      nCust,
      '| עודכן:',
      ws.updatedAt?.toISOString?.() || '',
    )
  }
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
