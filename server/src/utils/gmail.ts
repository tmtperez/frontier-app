import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

const TOKENS_PATH = path.join(process.cwd(), 'server', 'uploads', 'google-tokens.json')

type StoredTokens = {
  access_token?: string
  refresh_token?: string
  scope?: string
  token_type?: string
  expiry_date?: number
}

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  if (fs.existsSync(TOKENS_PATH)) {
    const raw = fs.readFileSync(TOKENS_PATH, 'utf8')
    const tokens: StoredTokens = JSON.parse(raw)
    client.setCredentials(tokens)
  }
  return client
}

export function getAuthUrl() {
  const client = getOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.send']
  })
}

export async function saveTokensFromCode(code: string) {
  const client = getOAuth2Client()
  const { tokens } = await client.getToken(code)
  fs.mkdirSync(path.dirname(TOKENS_PATH), { recursive: true })
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2))
}

export async function sendEmail(opts: { to: string; subject: string; html: string; fromName?: string; fromEmail?: string }) {
  const client = getOAuth2Client()
  const gmail = google.gmail({ version: 'v1', auth: client })

  const fromName = opts.fromName || process.env.MAIL_FROM_NAME || 'Bid Tracker'
  const fromEmail = opts.fromEmail || process.env.MAIL_FROM_EMAIL || 'no-reply@localhost'

  const message = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${opts.to}`,
    'Content-Type: text/html; charset=utf-8',
    `Subject: ${opts.subject}`,
    '',
    opts.html
  ].join('\n')

  const encoded = Buffer.from(message).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded }
  })
}
