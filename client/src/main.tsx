import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useNavigate,
  useLocation,
} from 'react-router-dom'

import './styles.css'
import Dashboard from './pages/dashboard/Dashboard'
import Bids from './pages/bids/List'
import AddBid from './pages/bids/Add'
import EditBid from './pages/bids/Edit'
import BidDetails from './pages/bids/Detail'
import Companies from './pages/companies/List'
import Contacts from './pages/contacts/List'
import AddCompany from './pages/companies/AddCompany'
import Scopes from './pages/scopes/List'   // ⬅️ Scopes page
import Admin from './pages/admin/Admin'

import { ProtectedRoute } from './ProtectedRoute'
import { AuthProvider, AuthContext } from './state/AuthContext'
import { onUnauthorized, setAuthToken } from './lib/api'

// Redirect to /login on 401s anywhere
onUnauthorized(() => {
  setAuthToken(null)
  localStorage.removeItem('user')
  window.location.href = '/login'
})

function Navbar() {
  const auth = React.useContext(AuthContext)
  const location = useLocation()
  const onLoginPage = location.pathname === '/login'

  return (
    <header className="topbar border-b border-slate-200">
      <div className="container-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-700 text-white flex items-center justify-center shadow-soft">
            FRC
          </div>
          <div className="text-lg font-semibold text-ink-900">
            Frontier Roofing and Construction LLC
          </div>
        </div>

        <nav className="flex gap-1 font-semibold">
          {onLoginPage ? (
            <NavLink to="/login" className="ml-3 btn-secondary px-3 py-1.5 rounded">
              Login
            </NavLink>
          ) : (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `navlink flex items-center px-3 py-1.5 rounded-md ${isActive ? 'navlink-active' : ''}`
                }
              >
                Dashboard
              </NavLink>

              <NavLink
                to="/bids"
                className={({ isActive }) =>
                  `navlink flex items-center px-3 py-1.5 rounded-md ${isActive ? 'navlink-active' : ''}`
                }
              >
                Bids
              </NavLink>

              <NavLink
                to="/companies"
                className={({ isActive }) =>
                  `navlink flex items-center px-3 py-1.5 rounded-md ${isActive ? 'navlink-active' : ''}`
                }
              >
                Companies
              </NavLink>

              <NavLink
                to="/contacts"
                className={({ isActive }) =>
                  `navlink flex items-center px-3 py-1.5 rounded-md ${isActive ? 'navlink-active' : ''}`
                }
              >
                Contacts
              </NavLink>

              <NavLink
                to="/scopes"
                className={({ isActive }) =>
                  `navlink flex items-center px-3 py-1.5 rounded-md ${isActive ? 'navlink-active' : ''}`
                }
              >
                Scopes
              </NavLink>

              {/* ⬅️ ADMIN TAB (only visible to admins) */}
              {auth.user?.role === 'ADMIN' && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `navlink flex items-center px-3 py-1.5 rounded-md ${isActive ? 'navlink-active' : ''}`
                  }
                >
                  Admin
                </NavLink>
              )}

              <NavLink to="/bids/new" className="ml-2">
                <span className="btn btn-primary">Add New Bid</span>
              </NavLink>

              {auth.user ? (
                <button
                  className="ml-3 btn-secondary px-3 py-1.5 rounded"
                  onClick={auth.logout}
                >
                  Logout
                </button>
              ) : (
                <NavLink
                  to="/login"
                  className="ml-3 btn-secondary px-3 py-1.5 rounded"
                >
                  Login
                </NavLink>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

// Minimal login screen (anti-autofill)
function LoginPage() {
  const auth = React.useContext(AuthContext)
  const navigate = useNavigate()

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [err, setErr] = React.useState<string>('')

  const [emailRO, setEmailRO] = React.useState(true)
  const [passRO, setPassRO] = React.useState(true)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    try {
      await auth.login(email, password)
      setAuthToken(localStorage.getItem('auth_token'))
      navigate('/dashboard')
    } catch (e: any) {
      setErr(e?.message || 'Login failed')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 card p-6">
      <h1 className="text-xl font-semibold mb-4">Login</h1>
      <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
        <div aria-hidden="true" style={{position:'absolute',left:'-10000px',top:'auto',width:'1px',height:'1px',overflow:'hidden'}}>
          <input type="text" tabIndex={-1} name="username" autoComplete="username" readOnly value="" />
          <input type="password" tabIndex={-1} name="password" autoComplete="current-password" readOnly value="" />
        </div>

        <div>
          <label className="label">Email</label>
          <input
            className="input w-full"
            type="email"
            name="login-email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="new-email"
            readOnly={emailRO}
            onFocus={() => setEmailRO(false)}
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input w-full"
            type="password"
            name="login-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            readOnly={passRO}
            onFocus={() => setPassRO(false)}
          />
        </div>
        {err && <div className="text-rose-600 text-sm">Login failed</div>}
        <button type="submit" className="btn btn-primary w-full">
          Sign in
        </button>
      </form>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50">
          <Navbar />
          <main className="container-7xl mx-auto px-4 py-6">
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/bids"
                element={
                  <ProtectedRoute>
                    <Bids />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/bids/new"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER', 'ESTIMATOR']}>
                    <AddBid />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/bids/:id"
                element={
                  <ProtectedRoute>
                    <BidDetails />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/bids/:id/edit"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER', 'ESTIMATOR']}>
                    <EditBid />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/companies"
                element={
                  <ProtectedRoute>
                    <Companies />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/companies/new"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
                    <AddCompany />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/contacts"
                element={
                  <ProtectedRoute>
                    <Contacts />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/scopes"
                element={
                  <ProtectedRoute roles={['ADMIN', 'MANAGER', 'ESTIMATOR']}>
                    <Scopes />
                  </ProtectedRoute>
                }
              />

              {/* ⬅️ ADMIN PAGE (ADMIN only) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={['ADMIN']}>
                    <Admin />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
