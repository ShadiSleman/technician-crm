const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { authJwt } = require('../middleware/authJwt')

const router = express.Router()

function signToken(user) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET חסר')
  return jwt.sign(
    { sub: String(user._id), username: user.username },
    secret,
    { expiresIn: '30d' },
  )
}

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '')
      .trim()
      .toLowerCase()
    const password = String(req.body?.password || '')
    if (!username || !password) {
      return res.status(400).json({ error: 'נא למלא שם משתמש וסיסמה' })
    }
    const user = await User.findOne({ username })
    if (!user) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' })
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' })
    }
    const token = signToken(user)
    return res.json({ token, username: user.username })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'שגיאת שרת' })
  }
})

router.get('/me', authJwt, async (req, res) => {
  return res.json({ username: req.username, userId: req.userId })
})

module.exports = router
