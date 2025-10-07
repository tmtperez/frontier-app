// server/src/routes/auth.ts
import { Router } from 'express'
import jwt from 'jsonwebtoken'

export const auth = Router()

auth.post('/login', async (_req, res) => {
  // TODO: real user check; hard-coded for demo
  const dbUser = { id: 1, role: 'ADMIN' as const }

  // 🔧 normalize secret here too (must match verify)
  const secret = (process.env.JWT_SECRET || '').trim()
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET missing' })
  }

  const payload = { id: dbUser.id, role: dbUser.role }
  const token = jwt.sign(payload, secret, { expiresIn: '7d' })

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  res.json({ ok: true, user: payload, token })
})
