import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { sendEmail } from '../utils/gmail'

const prisma = new PrismaClient()

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23,59,59,999); return x }

type FollowUpBid = {
  id: number
  projectName: string
  proposalDate: Date | null
  dueDate: Date | null
  clientCompany: { name: string }
  contact: { email: string | null } | null
}

async function fetchTodayFollowUps(): Promise<FollowUpBid[]> {
  const today = new Date()
  return prisma.bid.findMany({
    where: {
      followUpOn: { gte: startOfDay(today), lte: endOfDay(today) },
      bidStatus: { in: ['Active', 'Hot', 'Cold'] },
    },
    select: {
      id: true,
      projectName: true,
      proposalDate: true,
      dueDate: true,
      clientCompany: { select: { name: true } },
      contact:       { select: { email: true } },
    },
  }) as unknown as FollowUpBid[]
}

async function sendFollowUpsOnce() {
  const bids = await fetchTodayFollowUps()

  for (const b of bids) {
    const to = b.contact?.email  // company has no email field in your schema
    if (!to) {
      console.warn(`Skipping bid ${b.id} (${b.projectName}) — no contact email`)
      continue
    }

    const subject = `Follow-up: ${b.projectName}`
    const html = `
      <p>Hello,</p>
      <p>Following up on <b>${b.projectName}</b>.</p>
      <ul>
        <li>Client: ${b.clientCompany?.name ?? '—'}</li>
        <li>Proposal Date: ${b.proposalDate ?? '—'}</li>
        <li>Due Date: ${b.dueDate ?? '—'}</li>
      </ul>
      <p>Please let us know if you have any questions.</p>
    `
    try {
      await sendEmail({ to, subject, html })
      console.log(`Follow-up sent for bid ${b.id} → ${to}`)
    } catch (e) {
      console.error('Follow-up email failed for bid', b.id, e)
    }
  }
}

export function scheduleFollowUps() {
  // Every day at 09:00 local time
  cron.schedule('0 9 * * *', async () => {
    await sendFollowUpsOnce()
  })
}

// expose a manual trigger for testing
export async function runFollowUpsNow() {
  await sendFollowUpsOnce()
}
