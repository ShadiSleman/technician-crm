const express = require('express')
const Workspace = require('../models/Workspace')
const { authJwt } = require('../middleware/authJwt')

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
    const ws = await Workspace.findOne({ userId: req.userId })
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
    await Workspace.findOneAndUpdate(
      { userId: req.userId },
      { $set: { data } },
      { upsert: true, new: true },
    )
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'שגיאת שרת' })
  }
})

module.exports = router
