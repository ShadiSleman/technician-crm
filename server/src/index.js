require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const mongoose = require('mongoose')
const { getMongoUri } = require('./mongoUri')
const authRoutes = require('./routes/auth')
const workspaceRoutes = require('./routes/workspace')

const PORT = Number(process.env.PORT) || 5050

async function main() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error('JWT_SECRET חייב להיות מוגדר וארוך לפחות 16 תווים')
    process.exit(1)
  }

  const uri = getMongoUri()
  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 20_000,
  })
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err.message)
  })
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected, reconnecting…')
  })
  console.log('MongoDB:', mongoose.connection.name, `(readyState: ${mongoose.connection.readyState})`)

  const app = express()
  if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
  }
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '12mb' }))

  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
  })

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', loginLimit, authRoutes)
  app.use('/api/workspace', workspaceRoutes)

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HVAC CRM API listening on 0.0.0.0:${PORT}`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
