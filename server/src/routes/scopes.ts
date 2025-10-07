import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

// List
router.get('/', async (_req, res) => {
  const rows = await prisma.scopeCatalog.findMany({ orderBy: { name: 'asc' } })
  // If your model still has defaultCost, it's fine; we just don't send/use it.
  res.json(rows.map(r => ({ id: r.id, name: r.name })))
})

// Create (name only)
router.post('/', async (req, res) => {
  const { name } = req.body as { name?: string }
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' })
  const row = await prisma.scopeCatalog.create({
    data: { name: name.trim() },
    select: { id: true, name: true },
  })
  res.json(row)
})

// Update (name only)
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { name } = req.body as { name?: string }
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' })
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' })

  const row = await prisma.scopeCatalog.update({
    where: { id },
    data: { name: name.trim() },
    select: { id: true, name: true },
  })
  res.json(row)
})

// Delete
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' })
  await prisma.scopeCatalog.delete({ where: { id } })
  res.json({ ok: true })
})

export default router
