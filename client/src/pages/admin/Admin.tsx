// client/src/pages/admin/Admin.tsx
import React from 'react'
import { getJSON, postJSON, putJSON, delJSON } from '../../lib/api'

type AppRole = 'ADMIN' | 'MANAGER' | 'ESTIMATOR' | 'VIEWER'
type User = {
  id: number
  name: string | null
  email: string
  role: AppRole
}

type DialogState =
  | { kind: 'idle' }
  | { kind: 'add' }
  | { kind: 'edit'; user: User }
  | { kind: 'delete'; user: User }

const ROLES: AppRole[] = ['ADMIN', 'MANAGER', 'ESTIMATOR', 'VIEWER']

export default function Admin() {
  const [users, setUsers] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [dialog, setDialog] = React.useState<DialogState>({ kind: 'idle' })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const list = await getJSON<User[]>('/users')
      setUsers(list)
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [])

  return (
    <div className="font-sans space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Admin Panel</h1>

      <div className="card p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">User Management</h2>
          <button className="btn btn-primary" onClick={() => setDialog({ kind: 'add' })}>
            + Add User
          </button>
        </div>

        {loading ? (
          <div>Loading users…</div>
        ) : error ? (
          <div className="text-rose-600">{error}</div>
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2">{u.name || '—'}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.role}</td>
                  <td className="px-4 py-2 space-x-3">
                    <button className="text-blue-600 hover:underline" onClick={() => setDialog({ kind: 'edit', user: u })}>
                      Edit
                    </button>
                    <button className="text-rose-600 hover:underline" onClick={() => setDialog({ kind: 'delete', user: u })}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={4}>No users</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialogs */}
      {dialog.kind !== 'idle' && (
        <Modal onClose={() => setDialog({ kind: 'idle' })}>
          {dialog.kind === 'delete' ? (
            <DeleteConfirm
              user={dialog.user}
              onCancel={() => setDialog({ kind: 'idle' })}
              onConfirm={async () => {
                await delJSON(`/users/${dialog.user.id}`)
                await load()
                setDialog({ kind: 'idle' })
              }}
            />
          ) : (
            <UserForm
              mode={dialog.kind}
              initial={dialog.kind === 'edit' ? dialog.user : null}
              onCancel={() => setDialog({ kind: 'idle' })}
              onSubmit={async (values) => {
                if (dialog.kind === 'add') {
                  await postJSON('/users', values)
                } else {
                  const { password, ...rest } = values
                  await putJSON(`/users/${dialog.user.id}`, password ? values : rest)
                }
                await load()
                setDialog({ kind: 'idle' })
              }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}

/* ---------- Reusable Modal Shell ---------- */
function Modal(props: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={props.onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        {props.children}
      </div>
    </div>
  )
}

/* ---------- Add/Edit Form ---------- */
function UserForm(props: {
  mode: 'add' | 'edit'
  initial: User | null
  onSubmit: (payload: {
    name: string
    email: string
    role: AppRole
    password?: string
  }) => Promise<void>
  onCancel: () => void
}) {
  const isEdit = props.mode === 'edit'
  const [name, setName] = React.useState(props.initial?.name ?? '')
  const [email, setEmail] = React.useState(props.initial?.email ?? '')
  const [role, setRole] = React.useState<AppRole>(props.initial?.role ?? 'VIEWER')
  const [password, setPassword] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!name.trim() || !email.trim()) {
      setErr('Name and email are required.')
      return
    }
    if (!isEdit && !password) {
      setErr('Password is required for a new user.')
      return
    }
    setSaving(true)
    try {
      const payload: any = { name: name.trim(), email: email.trim().toLowerCase(), role }
      if (password) payload.password = password
      await props.onSubmit(payload)
    } catch (e: any) {
      setErr(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="text-lg font-semibold">{isEdit ? 'Edit User' : 'Add User'}</div>

      <label className="block">
        <div className="label">Name</div>
        <input className="input w-full" value={name} onChange={e => setName(e.target.value)} />
      </label>

      <label className="block">
        <div className="label">Email</div>
        <input className="input w-full" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </label>

      <label className="block">
        <div className="label">Role</div>
        <select className="select w-full" value={role} onChange={e => setRole(e.target.value as AppRole)}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>

      <label className="block">
        <div className="label">{isEdit ? 'New Password (optional)' : 'Password'}</div>
        <input className="input w-full" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </label>

      {err && <div className="text-sm text-rose-600">{err}</div>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={props.onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

/* ---------- Delete Confirm ---------- */
function DeleteConfirm(props: { user: User; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold">Delete User</div>
      <p>Are you sure you want to delete <strong>{props.user.email}</strong>? This cannot be undone.</p>
      <div className="flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={props.onCancel}>Cancel</button>
        <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={props.onConfirm}>Delete</button>
      </div>
    </div>
  )
}
