const jwt = require('jsonwebtoken')

function authJwt(req, res, next) {
  const h = req.headers.authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  if (!m) {
    return res.status(401).json({ error: 'נדרש התחברות' })
  }
  const secret = process.env.JWT_SECRET
  if (!secret) {
    return res.status(500).json({ error: 'שרת לא מוגדר (JWT_SECRET)' })
  }
  try {
    const payload = jwt.verify(m[1], secret)
    req.userId = payload.sub
    req.username = payload.username
    next()
  } catch {
    return res.status(401).json({ error: 'פג תוקף או אסימון לא תקין' })
  }
}

module.exports = { authJwt }
