import { Router } from 'express'
import { prisma } from '../db.js'

export const charts = Router()

/** Format a date as YYYY-MM for month buckets */
function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Robust query date parsing: supports YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY */
function parseDate(raw?: string): Date | undefined {
  if (!raw) return undefined

  // ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00Z`)
    return isNaN(+d) ? undefined : d
  }

  // Slash formats
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [a, b, y] = raw.split('/').map(Number)
    const mm = a > 12 ? b : a
    const dd = a > 12 ? a : b
    const d = new Date(Date.UTC(y, mm - 1, dd))
    return isNaN(+d) ? undefined : d
  }

  const d = new Date(raw)
  return isNaN(+d) ? undefined : d
}

/** Build month buckets from start..end (UTC) */
function monthSpan(start: Date, end: Date) {
  const buckets: string[] = []
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
  while (cur <= last) {
    buckets.push(monthKey(cur))
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return buckets
}

/* Helper to compute [start, end] from query (defaults to last 12 months) */
function resolveRange(req: any) {
  const startQ = parseDate(req.query.start as string | undefined)
  const endQ   = parseDate(req.query.end as string | undefined)

  let start: Date
  let end: Date

  if (startQ && endQ) {
    start = new Date(startQ); start.setUTCHours(0, 0, 0, 0)
    end   = new Date(endQ);   end.setUTCHours(23, 59, 59, 999)
  } else {
    const now = new Date()
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
    start = new Date(end)
    start.setUTCMonth(start.getUTCMonth() - 11)
    start.setUTCDate(1)
    start.setUTCHours(0, 0, 0, 0)
  }

  return { start, end }
}

/** Pick the date we use for charts: proposalDate primarily (fallback to createdAt) */
function chartDateForBid(b: { proposalDate: Date | null; createdAt: Date }): Date {
  return (b.proposalDate ?? b.createdAt) as Date
}

/* =========================
 *  /charts/metrics
 *  KPIs:
 *   - Win/Loss Ratio (Completed bids only, within start..end)
 *   - Total Value Won (Completed bids only, within start..end)
 *   - Active Pipeline Value: bids with bidStatus ∈ {Active, Hot, Cold},
 *     counting scopes that are NOT 'Lost' (snapshot, no date filter)
 *   - pendingCount: number of non-Lost scopes under Active/Hot/Cold bids
 * ========================= */
// --- inside server/src/routes/charts.ts ---

charts.get('/metrics', async (req, res) => {
  const { start, end } = resolveRange(req)

  // Active Pipeline (snapshot): bids Active/Hot/Cold; include scopes that are NOT 'Lost'
  const activeHotColdBids = await prisma.bid.findMany({
    where: { bidStatus: { in: ['Active', 'Hot', 'Cold'] as any } },
    include: { scopes: { select: { status: true, cost: true } } },
  })

  let activePipelineValue = 0
  let pendingCount = 0
  for (const b of activeHotColdBids) {
    for (const s of b.scopes) {
      if (s.status !== 'Lost') {
        activePipelineValue += (s.cost || 0)
        pendingCount += 1
      }
    }
  }

  // Completed bids in [start..end] for Win/Loss + Total Won
  // Accept both 'Completed' and 'Complete'
  const COMPLETED_STATUSES = ['Completed', 'Complete'] as const

  const completedRows = await prisma.bid.findMany({
    where: {
      bidStatus: { in: COMPLETED_STATUSES as any },
      OR: [
        { proposalDate: { gte: start, lte: end } },
        { AND: [{ proposalDate: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    },
    include: { scopes: true },
    orderBy: { createdAt: 'asc' },
  })

  let wonCount = 0
  let lostCount = 0
  let totalValueWon = 0

  for (const b of completedRows) {
    const d = chartDateForBid(b as any)
    if (d < start || d > end) continue

    for (const s of b.scopes) {
      if (s.status === 'Won') {
        wonCount++
        totalValueWon += (s.cost || 0)
      } else if (s.status === 'Lost') {
        lostCount++
      }
    }
  }

  const denom = wonCount + lostCount
  const activeWinLossRatio = denom === 0 ? 0 : wonCount / denom

  res.json({
    activePipelineValue,                 // snapshot: non-Lost scopes under Active/Hot/Cold bids
    totalValueWonActiveBids: totalValueWon, // from Completed/Complete bids in range
    activeWinLossRatio,                  // from Completed/Complete bids in range
    activeWonCount: wonCount,
    activeLostCount: lostCount,
    pendingCount,
  })
})


/* =========================
 *  /charts/bids-over
 *  Buckets COUNT of bids by month of proposalDate
 * ========================= */
charts.get('/bids-over', async (req, res) => {
  const { start, end } = resolveRange(req)

  const rows = await prisma.bid.findMany({
    where: {
      OR: [
        { proposalDate: { gte: start, lte: end } },
        { AND: [{ proposalDate: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    },
    select: { createdAt: true, proposalDate: true },
    orderBy: { createdAt: 'asc' },
  })

  const byMonth = new Map<string, number>()
  for (const key of monthSpan(start, end)) byMonth.set(key, 0)

  for (const b of rows) {
    const d = chartDateForBid(b as any)
    if (d < start || d > end) continue
    const key = monthKey(d)
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) || 0) + 1)
  }

  const data = Array.from(byMonth.entries()).map(([month, count]) => ({ month, count }))
  res.json(data)
})

/* =========================
 *  /charts/value-over
 *  Buckets TOTAL bid value (sum of all scopes) by month of proposalDate
 * ========================= */
charts.get('/value-over', async (req, res) => {
  const { start, end } = resolveRange(req)

  const rows = await prisma.bid.findMany({
    where: {
      OR: [
        { proposalDate: { gte: start, lte: end } },
        { AND: [{ proposalDate: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    },
    include: { scopes: true },
    orderBy: { createdAt: 'asc' },
  })

  const byMonth = new Map<string, number>()
  for (const key of monthSpan(start, end)) byMonth.set(key, 0)

  for (const b of rows) {
    const d = chartDateForBid(b as any)
    if (d < start || d > end) continue

    const key = monthKey(d)
    const total = b.scopes.reduce((sum, s) => sum + (s.cost || 0), 0)
    byMonth.set(key, (byMonth.get(key) || 0) + total)
  }

  const data = Array.from(byMonth.entries()).map(([month, total]) => ({ month, total }))
  res.json(data)
})

/* =========================
 *  /charts/scope-totals
 *  Totals WON value by scope name in the range (by proposalDate month)
 * ========================= */
charts.get('/scope-totals', async (req, res) => {
  const { start, end } = resolveRange(req)

  const rows = await prisma.bid.findMany({
    where: {
      OR: [
        { proposalDate: { gte: start, lte: end } },
        { AND: [{ proposalDate: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    },
    include: { scopes: true },
    orderBy: { createdAt: 'asc' },
  })

  const totals = new Map<string, number>()

  for (const b of rows) {
    const d = chartDateForBid(b as any)
    if (d < start || d > end) continue

    for (const s of b.scopes) {
      if (s.status === 'Won') {
        totals.set(s.name, (totals.get(s.name) || 0) + (s.cost || 0))
      }
    }
  }

  const data = Array.from(totals.entries()).map(([scope, total]) => ({ scope, total }))
  res.json(data)
})
