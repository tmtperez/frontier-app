// server/src/routes/import.ts
import { Router } from 'express'
import multer from 'multer'
import { parseImportCSV } from '../utils/csv.js'
import { prisma } from '../db.js'
import path from 'path'
import fs from 'fs'

export const importer = Router()

// In-memory upload for CSV
const upload = multer({ storage: multer.memoryStorage() })

// Disk upload for attachments
const uploadDisk = multer({ dest: 'uploads/' })

/* =========================
 * Helpers
 * ========================= */
function parseDateLoose(s?: string) {
  if (!s) return null
  const t = String(s).trim()

  // ISO: YYYY-MM-DD or starts with it
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t)
    return isNaN(+d) ? null : d
  }

  // DD/MM/YYYY or MM/DD/YYYY (also supports '-')
  const m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (m) {
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    const y = parseInt(m[3], 10)

    // Your sheets are day-first; default to DD/MM
    const day = a
    const month = b

    const dt = new Date(Date.UTC(y, month - 1, day))
    return isNaN(+dt) ? null : dt
  }

  // Fallback: let JS try
  const d = new Date(t)
  return isNaN(+d) ? null : d
}

function cleanStatus(s?: string) {
  const v = String(s ?? '').trim()
  if (!v) return undefined
  const norm = v.toLowerCase()
  if (['pending', 'won', 'lost'].includes(norm)) {
    return (norm[0].toUpperCase() + norm.slice(1)) as 'Pending' | 'Won' | 'Lost'
  }
  return undefined
}

function cleanBidStatus(s?: string) {
  const v = String(s ?? '').trim().toLowerCase()
  const map: Record<string, 'Active' | 'Complete' | 'Archived' | 'Hot' | 'Cold'> = {
    active: 'Active',
    complete: 'Complete',
    completed: 'Complete',
    archive: 'Archived',
    archived: 'Archived',
    hot: 'Hot',
    cold: 'Cold',
  }
  return map[v] ?? 'Active'
}

function toNumberOrZero(x: any) {
  const n = Number(String(x ?? '').replace(/[, ]+/g, ''))
  return isFinite(n) ? n : 0
}

/* =========================
 * CSV Import
 * ========================= */
importer.post('/bids', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })

  const rows = parseImportCSV(req.file.buffer)

  // Group by projectName + clientCompany (so multiple scope lines combine into one bid)
  const grouped: Record<
    string,
    {
      projectName: string
      clientCompany: string
      contactName: string | null
      proposalDate: string
      dueDate: string
      jobLocation: string | null
      leadSource: string | null
      bidStatus: string
      scopes: Array<{ name: string; cost: number; status?: 'Pending' | 'Won' | 'Lost' }>
    }
  > = {}

  for (const r of rows as any[]) {
    const projectName = String(r.projectName ?? '').trim()
    const clientCompany = String(r.clientCompany ?? '').trim()
    if (!projectName || !clientCompany) continue

    const key = `${projectName}||${clientCompany}`

    // Initialize group if missing
    if (!grouped[key]) {
      grouped[key] = {
        projectName,
        clientCompany,
        contactName: String(r.contactName ?? '').trim() || null,
        proposalDate: String(r.proposalDate ?? '').trim(),
        dueDate: String(r.dueDate ?? '').trim(),
        jobLocation: String(r.jobLocation ?? '').trim() || null,
        leadSource: String(r.leadSource ?? '').trim() || null,
        bidStatus: cleanBidStatus(r.bidStatus),
        scopes: [],
      }
    } else {
      // If a later row has a stronger bidStatus (e.g., Hot, Complete),
      // upgrade it from Active.
      const incomingStatus = cleanBidStatus(r.bidStatus)
      const cur = grouped[key].bidStatus
      if (cur === 'Active' && incomingStatus !== 'Active') {
        grouped[key].bidStatus = incomingStatus
      }
    }

    grouped[key].scopes.push({
      name: String(r.scopeName ?? '').trim(),
      cost: toNumberOrZero(r.scopeCost),
      status: cleanStatus(r.scopeStatus),
    })
  }

  const results: any[] = []
  const errors: Array<{ key: string; message: string }> = []

  for (const key of Object.keys(grouped)) {
    const g = grouped[key]

    try {
      const proposalDate = parseDateLoose(g.proposalDate)
      const dueDate = parseDateLoose(g.dueDate)

      if (!proposalDate || !dueDate) {
        throw new Error(
          `Invalid date(s). proposalDate="${g.proposalDate}" dueDate="${g.dueDate}". Use YYYY-MM-DD or DD/MM/YYYY.`
        )
      }

      // Upsert company
      let company = await prisma.company.findFirst({ where: { name: g.clientCompany } })
      if (!company) {
        company = await prisma.company.create({ data: { name: g.clientCompany } })
      }

      // Upsert contact
      let contact: { id: number } | null = null
      if (g.contactName) {
        contact = await prisma.contact.findFirst({
          where: { name: g.contactName, companyId: company.id },
        })
        if (!contact) {
          contact = await prisma.contact.create({
            data: { name: g.contactName, companyId: company.id },
          })
        }
      }

      // Sanitize scopes
      const scopeCreates = g.scopes
        .filter((s) => s.name)
        .map((s) => ({
          name: s.name,
          cost: toNumberOrZero(s.cost),
          status: cleanStatus(s.status) ?? 'Pending',
        }))

      const created = await prisma.bid.create({
        data: {
          projectName: g.projectName,
          clientCompanyId: company.id,
          contactId: contact?.id ?? null,
          proposalDate,
          dueDate,
          jobLocation: g.jobLocation,
          leadSource: g.leadSource,
          bidStatus: g.bidStatus || 'Active',
          scopes: { create: scopeCreates },
        },
      })

      results.push(created)
    } catch (e: any) {
      errors.push({ key, message: e?.message ?? String(e) })
    }
  }

  res.json({ imported: results.length, errors })
})

/* =========================
 * Attachment Upload
 * ========================= */
importer.post('/bids/:id/attachments', uploadDisk.single('file'), async (req, res) => {
  const id = Number(req.params.id)
  if (!req.file) return res.status(400).json({ error: 'No file' })

  const created = await prisma.attachment.create({
    data: {
      bidId: id,
      originalName: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
  })

  res.json(created)
})
