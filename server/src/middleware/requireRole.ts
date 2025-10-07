import type { Request, Response, NextFunction } from 'express'
import type { AuthUser } from './auth.js'

// Allow any of these roles to pass; else 403.
export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).user?.role as AuthUser['role'] | undefined
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
