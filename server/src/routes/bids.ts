// server/routes/bids.ts
import { Router } from 'express'
import { prisma } from '../db.js'
import { aggregateScopeStatus, totalAmount } from '../utils/aggregate.js'
import type { BidInput } from '../types.js'
import { requireRole } from '../middleware/permissions.js'
import { canAccessBid } from '../middleware/permissions.js'
import { authRequired } from '../middleware/auth.js'

export const bids = Router()

// All bid routes require a valid JWT (req.user populated)
bids.use(authRequired)

/* ---------------------------
   Permission helpers (inline)
---------------------------- */
type Role = 'ADMIN' | 'MANAGER' | 'ESTIMATOR' | 'VIEWER'
type Action = 'read' | 'create' | 'update' | 'delete'

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: number; role: Role }
  }
}

const ROLE_PERMS: Record<Role, Action[]> = {
  ADMIN:     ['read', 'create', 'update', 'delete'],
  MANAGER:   ['read', 'create', 'update'],
  ESTIMATOR: ['read', 'create', 'update', 'delete'],
  VIEWER:    ['read'],
}

function can(req: any, action: Action) {
  const role: Role | undefined = req.user?.role
  if (!role) return false
  return ROLE_PERMS[role]?.includes(action) ?? false
}

function requirePerm(action: Action) {
  return (req: any, res: any, next: any) => {
    if (!can(req, action)) return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}

// Redact some fields for VIEWER role in list endpoints
function redactForViewer<T extends Record<string, any>>(req: any, rows: T[]) {
  if (req.user?.role !== 'VIEWER') return rows
  return rows.map(row => ({ ...row, amount: null, scopes: undefined }))
}

/* ---------------------------
   Helpers
---------------------------- */
const parseDateOrNull = (v: any) => (v ? new Date(v) : null)

type ScopeIn = { name?: string; cost?: any; status?: any }
const VALID_SCOPE_STATUS = new Set(['Pending', 'Won', 'Lost'])

function sanitizeScopes(raw: ScopeIn[] | undefined | null) {
  if (!raw || !Array.isArray(raw)) return []
  return raw
    .map(s => ({
      name: String(s.name ?? '').trim(),
      cost: Number(s.cost ?? 0) || 0,
      status: VALID_SCOPE_STATUS.has(String(s.status))
        ? (String(s.status) as 'Pending' | 'Won' | 'Lost')
        : 'Pending',
    }))
    .filter(s => s.name.length > 0)
}

/* ---------------------------------------------------------------------------
   GET /bids
--------------------------------------------------------------------------- */
bids.get('/', requirePerm('read'), async (req, res, next) => {
  try {
    const status = (req.query.status as string) || undefined
    const search = ((req.query.search as string) || '').trim()
    const createdFrom = (req.query.createdFrom as string) || undefined
    const createdTo   = (req.query.createdTo as string) || undefined

    const where: any = {}
    if (status) where.bidStatus = status

    if (search) {
      where.OR = [
        { projectName: { contains: search } },
        { clientCompany: { is: { name: { contains: search } } } },
        { contact: { is: { name: { contains: search } } } },
      ]
    }

    if (createdFrom || createdTo) {
      where.createdAt = {}
      if (createdFrom) where.createdAt.gte = new Date(createdFrom)
      if (createdTo)   where.createdAt.lte = new Date(createdTo)
    }

    const results = await prisma.bid.findMany({
      where,
      select: {
        id: true,
        projectName: true,
        proposalDate: true,
        dueDate: true,
        followUpOn: true,
        bidStatus: true,
        clientCompany: true,
        contact: true,
        scopes: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    let mapped = results.map(b => ({
      id: b.id,
      projectName: b.projectName,
      clientName: b.clientCompany?.name ?? '—',
      amount: totalAmount(b.scopes),
      proposalDate: b.proposalDate ?? null,
      dueDate: b.dueDate ?? null,
      followUpOn: b.followUpOn ?? null,
      scopeStatus: aggregateScopeStatus(b.scopes),
      bidStatus: b.bidStatus,
    }))

    mapped = redactForViewer(req, mapped)
    res.json(mapped)
  } catch (err) {
    next(err)
  }
})

/* ---------------------------------------------------------------------------
   GET /bids/:id
--------------------------------------------------------------------------- */
bids.get('/:id', requirePerm('read'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' })

    const b = await prisma.bid.findUnique({
      where: { id },
      include: {
        clientCompany: true,
        contact: true,
        scopes: true,
        notes: true,
        tags: { include: { tag: true } },
        attachments: true,
      },
    })

    if (!b) return res.status(404).json({ error: 'Not found' })

    if (req.user?.role === 'VIEWER') {
      const redacted = { ...b, scopes: undefined }
      return res.json(redacted)
    }

    res.json(b)
  } catch (err) {
    next(err)
  }
})

/* ---------------------------------------------------------------------------
   POST /bids  (ADMIN, MANAGER, ESTIMATOR)
--------------------------------------------------------------------------- */
bids.post('/', requireRole('ADMIN','MANAGER','ESTIMATOR'), async (req, res, next) => {
  try {
    const scopes = sanitizeScopes(req.body.scopes)

    const bid = await prisma.bid.create({
      data: {
        projectName: String(req.body.projectName ?? '').trim(),
        clientCompanyId: req.body.clientCompanyId,
        contactId: req.body.contactId ?? null,
        proposalDate: parseDateOrNull(req.body.proposalDate),
        dueDate: parseDateOrNull(req.body.dueDate),
        followUpOn: parseDateOrNull(req.body.followUpOn),
        jobLocation: req.body.jobLocation ?? null,
        leadSource: req.body.leadSource ?? null,
        bidStatus: req.body.bidStatus,
        scopes: {
          create: scopes.map(s => ({
            name: s.name,
            cost: s.cost,
            status: s.status,
          })),
        },
      },
      include: { scopes: true },
    })

    res.status(201).json(bid)
  } catch (e) {
    next(e)
  }
})

/* ---------------------------------------------------------------------------
   PUT /bids/:id  — replace scopes atomically
   (ADMIN, MANAGER, ESTIMATOR)
--------------------------------------------------------------------------- */
bids.put('/:id', canAccessBid, requireRole('ADMIN','MANAGER','ESTIMATOR'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' })

    const data = req.body as BidInput
    const scopes = sanitizeScopes(data.scopes)

    const [, updated] = await prisma.$transaction([
      prisma.scope.deleteMany({ where: { bidId: id } }),
      prisma.bid.update({
        where: { id },
        data: {
          projectName: String(data.projectName ?? '').trim(),
          clientCompanyId: data.clientCompanyId,
          contactId: data.contactId || null,
          proposalDate: parseDateOrNull(data.proposalDate),
          dueDate: parseDateOrNull(data.dueDate),
          followUpOn: parseDateOrNull(data.followUpOn),
          jobLocation: data.jobLocation || null,
          leadSource: data.leadSource || null,
          bidStatus: data.bidStatus,
          scopes: {
            create: scopes.map(s => ({
              name: s.name,
              cost: s.cost,
              status: s.status,
            })),
          },
        },
        include: { scopes: true },
      }),
    ])

    res.json(updated)
  } catch (e) {
    next(e)
  }
})

/* ---------------------------------------------------------------------------
   DELETE /bids/:id  (ADMIN, ESTIMATOR)
--------------------------------------------------------------------------- */
bids.delete('/:id', requireRole('ADMIN','ESTIMATOR'), async (req, res, next) => {
  try {
    const id = Number.parseInt(String(req.params.id), 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' })

    // Clean children first, then delete the bid using deleteMany (won’t throw)
    const result = await prisma.$transaction(async (tx) => {
      await tx.scope.deleteMany({ where: { bidId: id } })
      await tx.note.deleteMany({ where: { bidId: id } })
      await tx.attachment.deleteMany({ where: { bidId: id } })
      await tx.bidTag.deleteMany({ where: { bidId: id } })
      const del = await tx.bid.deleteMany({ where: { id } })  // <- safe
      return del.count
    })

    if (result === 0) {
      return res.status(404).json({ error: 'Not found' })
    }

    res.status(204).end()
  } catch (e) {
    next(e)
  }
})


export default bids
