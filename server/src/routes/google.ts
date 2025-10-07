import { Router } from 'express'
import { getAuthUrl, saveTokensFromCode, sendEmail } from '../utils/gmail'
import { runFollowUpsNow } from '../jobs/followups'

const r = Router()

r.get('/google/oauth/start', (_req, res) => res.redirect(getAuthUrl()))

r.get('/google/oauth/callback', async (req, res) => {
  const code = req.query.code as string | undefined
  if (!code) return res.status(400).send('Missing code')
  await saveTokensFromCode(code)
  res.send('✅ Gmail connected for localhost! You can close this tab.')
})

r.get('/google/send-test', async (req, res) => {
  const to = String(req.query.to || '')
  if (!to) return res.status(400).send('Provide ?to=email')
  await sendEmail({ to, subject: 'Bid Tracker test email', html: '<p>Hello from your local Bid Tracker 👋</p>' })
  res.send('✅ Test email sent.')
})

// manual trigger for follow-ups
r.post('/google/run-followups', async (_req, res) => {
  await runFollowUpsNow()
  res.send('✅ Follow-ups executed.')
})

export default r
