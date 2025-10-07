// server/src/app.ts
import express from 'express'
import cors from 'cors'
import path from 'path'
import cookieParser from 'cookie-parser'

import { auth } from './routes/auth.js'
import { authRequired } from './middleware/auth.js'
import { bids } from './routes/bids.js'
import { companies } from './routes/companies.js'
import { contacts } from './routes/contacts.js'
import { charts } from './routes/charts.js'
import { importer } from './routes/import.js'
import { errorHandler } from './middleware/error.js'
import googleRoutes from './routes/google'
import scopeRoutes from './routes/scopes.js'
import { users } from './routes/users.js'
import { requireRole } from './middleware/requireRole.js'

const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const corsOptions: cors.CorsOptions = {
  origin: ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}

export function createApp() {
  const app = express()

  // CORS then cookies then JSON — order matters
  app.use(cors(corsOptions))
  app.options('*', cors(corsOptions))
  app.use(cookieParser())
  app.use(express.json({ limit: '5mb' }))

  app.use('/uploads', express.static(path.resolve('uploads')))

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', auth)

  // 🔎 DEBUG: log auth input for /api/bids only (remove after it works)
  app.use('/api/bids', (req, _res, next) => {
    // Only log for DELETE to reduce noise
    if (req.method === 'DELETE') {
      console.log('[AUTH DEBUG] DELETE', req.originalUrl)
      console.log('  Authorization:', req.headers.authorization || '(none)')
      console.log('  Cookie token :', (req as any).cookies?.token || '(none)')
    }
    next()
  })  

  app.use('/api/bids', authRequired, bids)
  app.use('/api/companies', authRequired, companies)
  app.use('/api/contacts', authRequired, contacts)
  app.use('/api/charts', authRequired, charts)
  app.use('/api/import', authRequired, importer)
  app.use('/api/scopes', authRequired, scopeRoutes)
  app.use('/api', googleRoutes)
  app.use('/api/users', authRequired, requireRole('ADMIN'), users)

  app.use(errorHandler)

  return app
}

