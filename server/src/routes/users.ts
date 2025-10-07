// server/src/routes/users.ts
import { Router } from 'express'
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
export const users = Router()

// String-based role type (matches your schema)
type AppRole = 'ADMIN' | 'MANAGER' | 'ESTIMATOR' | 'VIEWER'

function publicUser(u: any) {
  if (!u) return u
  // Remove passwordHash before sending to client
  const { passwordHash, ...rest } = u
  return rest
}

/** GET /api/users — list all users (admin only) */
users.get('/', async (_req, res, next) => {
  try {
    const list = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    })
    res.json(list.map(publicUser))
  } catch (e) {
    next(e)
  }
})

/** POST /api/users — create new user */
users.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {}
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' })
    }

    const hash = await bcrypt.hash(String(password), 10)

    const created = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: String(email).toLowerCase().trim(),
        role: (role as AppRole) || 'VIEWER',
        passwordHash: hash,
      },
    })

    res.status(201).json(publicUser(created))
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists.' })
    }
    next(e)
  }
})

/** PUT /api/users/:id — update user info/role, optionally password */
users.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { name, email, password, role, isActive } = req.body || {}

    const data: any = {}
    if (name != null) data.name = String(name).trim()
    if (email != null) data.email = String(email).toLowerCase().trim()
    if (role != null) data.role = role as AppRole
    if (typeof isActive === 'boolean') data.isActive = isActive
    if (password) data.passwordHash = await bcrypt.hash(String(password), 10)

    const updated = await prisma.user.update({ where: { id }, data })
    res.json(publicUser(updated))
  } catch (e) {
    next(e)
  }
})

/** PATCH /api/users/:id/password — change password only */
users.patch('/:id/password', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { password } = req.body || {}
    if (!password) return res.status(400).json({ error: 'Password required.' })

    const hash = await bcrypt.hash(String(password), 10)
    await prisma.user.update({ where: { id }, data: { passwordHash: hash } })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

/** DELETE /api/users/:id — remove user */
users.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    // Optional guard: prevent deleting yourself
    const me = (req as any).user as { id?: number }
    if (me?.id === id) {
      return res.status(400).json({ error: "You can't delete your own account." })
    }

    await prisma.user.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})
