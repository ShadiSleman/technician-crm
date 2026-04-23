const express = require('express')
const mongoose = require('mongoose')
const Workspace = require('../models/Workspace')
const { authJwt } = require('../middleware/authJwt')

function toUserId(value) {
  if (value instanceof mongoose.Types.ObjectId) return value
  const s = value != null ? String(value) : ''
  if (mongoose.isValidObjectId(s)) {
    return new mongoose.Types.ObjectId(s)
  }
  return s
}

const router = express.Router()

const emptyPayload = () => ({
  customers: [],
  transactions: [],
  meetings: [],
  callLogs: [],
  priceList: [],
  quotes: [],
})

router.get('/', authJwt, async (req, res) => {
  try {
    const uid = toUserId(req.userId)
    const ws = await Workspace.findOne({ userId: uid })
    if (!ws) {
      return res.json({ data: emptyPayload() })
    }
    return res.json({ data: ws.data })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'שגיאת שרת' })
  }
})

router.put('/', authJwt, async (req, res) => {
  try {
    const data = req.body?.data
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'חסר שדה data' })
    }
    const uid = toUserId(req.userId)
    await Workspace.findOneAndUpdate(
      { userId: uid },
      { $set: { data }, $setOnInsert: { userId: uid } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'שגיאת שרת' })
  }
})

module.exports = router
