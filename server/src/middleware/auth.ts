// server/src/middleware/auth.ts
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

export type AuthUser = { id: number; role: 'ADMIN' | 'MANAGER' | 'ESTIMATOR' | 'VIEWER' }

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

const isDev = process.env.NODE_ENV !== 'production'

function getTokenFromRequest(req: Request): string | null {
  const hdr = req.headers.authorization
  if (hdr?.startsWith('Bearer ')) return hdr.slice(7).trim()
  const cookieToken: string | undefined = (req as any)?.cookies?.token
  return cookieToken || null
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const token = getTokenFromRequest(req)
  if (!token) {
    return res.status(401).json({ error: isDev ? 'Unauthorized: no token (header/cookie)' : 'Unauthorized' })
  }

  // 🔧 normalize secret to avoid hidden spaces/quotes
  const secret = (process.env.JWT_SECRET || '').trim()
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET missing' })
  }

  try {
    const payload = jwt.verify(token, secret) as AuthUser
    if (!payload || typeof payload.id !== 'number' || !payload.role) {
      return res.status(401).json({ error: isDev ? 'Unauthorized: invalid payload shape' : 'Unauthorized' })
    }
    req.user = { id: payload.id, role: payload.role }
    next()
  } catch (e) {
    if (isDev) console.error('[AUTH ERROR] verify failed:', (e as Error).message)
    res.status(401).json({ error: isDev ? 'Unauthorized: token verify failed' : 'Unauthorized' })
  }
}
