import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../state/AuthContext'
import { setAuthToken } from '../../lib/api'

export default function LoginPage() {
  const { login } = React.useContext(AuthContext)
  const navigate = useNavigate()

  // start blank; do NOT prefill
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // anti-autofill: keep real inputs readOnly until user focuses
  const [emailReadonly, setEmailReadonly] = React.useState(true)
  const [passwordReadonly, setPasswordReadonly] = React.useState(true)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password) // calls /api/auth/login
      setAuthToken(localStorage.getItem('auth_token'))
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-extrabold tracking-tight mb-4">Sign in</h1>

      <form
        onSubmit={onSubmit}
        className="card p-5 space-y-4"
        autoComplete="off"
      >
        {/* If there's an error */}
        {error && (
          <div className="rounded-md bg-rose-50 text-rose-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {/* --- DECOY FIELDS (autofill will target these) --- */}
        <div
          aria-hidden="true"
          // Chrome ignores display:none for autofill heuristics; use visually-hidden offscreen
          style={{
            position: 'absolute',
            left: '-10000px',
            top: 'auto',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          <input
            type="text"
            tabIndex={-1}
            name="username"
            autoComplete="username"
            value=""
            readOnly
          />
          <input
            type="password"
            tabIndex={-1}
            name="password"
            autoComplete="current-password"
            value=""
            readOnly
          />
        </div>
        {/* --- END DECOY --- */}

        <div>
          <label className="label">Email</label>
          <input
            className="input w-full"
            type="email"
            // IMPORTANT: no common 'name' like "email"/"username"
            name="login-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoFocus
            // non-standard token is harder for Chrome to use
            autoComplete="new-email"
            readOnly={emailReadonly}
            onFocus={() => setEmailReadonly(false)}
          />
        </div>

        <div>
          <label className="label">Password</label>
          <input
            className="input w-full"
            type="password"
            name="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            // non-standard token prevents password managers from injecting
            autoComplete="new-password"
            readOnly={passwordReadonly}
            onFocus={() => setPasswordReadonly(false)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-70"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
