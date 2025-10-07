import React from 'react'
import { Link } from 'react-router-dom'
import { getJSON, uploadFile } from '../../lib/api'
import { AuthContext } from '../../state/AuthContext'

type Row = {
  id: number
  projectName: string
  clientName: string
  amount: number
  proposalDate?: string | null
  dueDate?: string | null
  followUpOn?: string | null
  scopeStatus: 'Pending' | 'Won' | 'Lost' | 'Unknown'
  bidStatus: 'Active' | 'Complete' | 'Archived' | 'Hot' | 'Cold'
}

function currency(n: number) {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function parseDate(v?: string | null): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}
const fmt = (v?: string | null) => {
  const d = parseDate(v)
  return d ? d.toISOString().slice(0, 10) : '—'
}
const daysBetween = (a?: string | null, b?: string | null) => {
  const A = parseDate(a)?.getTime()
  const B = parseDate(b)?.getTime()
  if (A == null || B == null) return null
  return Math.max(0, Math.ceil((B - A) / 86_400_000))
}

type SortBy = 'proposalDate' | 'dueDate' | 'dueIn'
type SortDir = 'asc' | 'desc'
type PendingDelete = { id: number; projectName: string } | null

export default function Bids() {
  const auth = React.useContext(AuthContext)

  const [tab, setTab] = React.useState<'Active' | 'Complete' | 'Archived' | 'Hot' | 'Cold'>('Active')
  const [rows, setRows] = React.useState<Row[]>([])
  const [search, setSearch] = React.useState('')
  const [from, setFrom] = React.useState<string>('')
  const [to, setTo] = React.useState<string>('')

  const [dueInMax, setDueInMax] = React.useState<string>('')
  const [sortBy, setSortBy] = React.useState<SortBy>('dueDate')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete>(null)

  const load = React.useCallback(() => {
    const q = new URLSearchParams()
    q.set('status', tab)
    if (search) q.set('search', search)
    if (from) q.set('createdFrom', from)
    if (to) q.set('createdTo', to)
    getJSON<Row[]>(`/bids?${q.toString()}`).then(setRows)
  }, [tab, search, from, to])

  React.useEffect(() => { load() }, [load])

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    await uploadFile('/import/bids', f)
    alert('Import complete')
    load()
  }

  function askDelete(id: number, projectName: string) {
    setPendingDelete({ id, projectName })
  }

  // ⬇️ IMPORTANT: add Authorization header from AuthContext/localStorage/sessionStorage
  async function confirmDelete() {
    if (!pendingDelete) return
    const { id, projectName } = pendingDelete
    setDeletingId(id)
    try {
      // Try AuthContext first; fall back to common local/session keys
      const token =
        (auth as any)?.token ||
        localStorage.getItem('token') ||
        localStorage.getItem('jwt') ||
        localStorage.getItem('access_token') ||
        sessionStorage.getItem('token') ||
        ''

      const res = await fetch(`/api/bids/${id}`, {
        method: 'DELETE',
        credentials: 'include', // keeps cookie-based auth working too
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
          const body = await res.json()
          if (body?.error) msg = body.error
        } catch {}
        throw new Error(msg)
      }

      setRows(prev => prev.filter(x => x.id !== id))
      setPendingDelete(null)
    } catch (e: any) {
      alert(`Failed to delete "${projectName}": ${e?.message || e}`)
    } finally {
      setDeletingId(null)
    }
  }

  function cancelDelete() {
    setPendingDelete(null)
  }

  const viewRows = React.useMemo(() => {
    let r = rows.map(row => {
      const dueIn = daysBetween(row.proposalDate ?? null, row.dueDate ?? null)
      return { ...row, _dueIn: dueIn } as Row & { _dueIn: number | null }
    })

    const max = Number(dueInMax)
    if (dueInMax !== '' && Number.isFinite(max)) {
      r = r.filter(row => row._dueIn !== null && row._dueIn <= max)
    }

    r.sort((a, b) => {
      const pick = (row: any) => {
        if (sortBy === 'dueIn') return row._dueIn
        if (sortBy === 'proposalDate') return parseDate(row.proposalDate)?.getTime() ?? null
        return parseDate(row.dueDate)?.getTime() ?? null
      }
      const va = pick(a)
      const vb = pick(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const diff = (va as number) - (vb as number)
      return sortDir === 'asc' ? diff : -diff
    })

    return r
  }, [rows, dueInMax, sortBy, sortDir])

  const pillBase =
    'px-3 py-1.5 rounded-full border border-slate-200 font-medium text-sm transition ' +
    'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300'

  return (
    <div className="space-y-4 font-sans">
      {/* Title + search + import */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-2xl font-extrabold tracking-tight">All Bids</div>
        <div className="flex items-center gap-2">
          <input
            className="input w-56 sm:w-72"
            placeholder="Search project, client, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="cursor-pointer px-4 py-2 rounded-md bg-green-500 text-white text-sm font-medium shadow hover:bg-green-600 transition">
            <input type="file" accept=".csv" onChange={onImport} className="hidden" />
            Import Bids
          </label>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600">Created:</span>
        <input type="date" className="input !w-28 sm:!w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-sm text-slate-600">to</span>
        <input type="date" className="input !w-28 sm:!w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        <button
          type="button"
          className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium shadow hover:bg-red-600 transition"
          onClick={() => { setFrom(''); setTo('') }}
        >
          Clear
        </button>

        <div className="ml-4 flex items-center gap-2">
          <span className="text-sm text-slate-600">Due in ≤</span>
          <input
            type="number"
            min={0}
            className="input !w-24"
            placeholder="days"
            value={dueInMax}
            onChange={(e) => setDueInMax(e.target.value)}
          />
          <span className="text-sm text-slate-600">days</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-600">Sort by:</span>
          <select className="input !w-36" value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}>
            <option value="proposalDate">Proposal Date</option>
            <option value="dueDate">Due Date</option>
            <option value="dueIn">Due in (days)</option>
          </select>
          <select className="input !w-32" value={sortDir} onChange={e => setSortDir(e.target.value as SortDir)}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2">
        {(['Active', 'Complete', 'Archived', 'Hot', 'Cold'] as const).map((s) => {
          const active = tab === s
          return (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={pillBase + ' ' + (active ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-700')}
            >
              {s}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>PROJECT NAME</th>
              <th>CLIENT</th>
              <th>AMOUNT</th>
              <th>PROPOSAL DATE</th>
              <th>DUE DATE</th>
              <th>DUE IN</th>
              <th>FOLLOW-UP IN</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {viewRows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="font-medium">{r.projectName}</td>
                <td>{r.clientName}</td>
                <td>{currency(r.amount)}</td>
                <td>{fmt(r.proposalDate)}</td>
                <td className="text-red-600">{fmt(r.dueDate)}</td>
                <td>
                  {(() => {
                    const n = daysBetween(r.proposalDate ?? null, r.dueDate ?? null)
                    return typeof n === 'number' ? `${n} day${n === 1 ? '' : 's'}` : '—'
                  })()}
                </td>
                <td>{fmt(r.followUpOn)}</td>
                <td className="text-left">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      to={`/bids/${r.id}`}
                      className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm"
                    >
                      Details
                    </Link>

                    {(auth.user?.role === 'ADMIN' ||
                      auth.user?.role === 'MANAGER' ||
                      auth.user?.role === 'ESTIMATOR') && (
                      <Link
                        to={`/bids/${r.id}/edit`}
                        className="px-3 py-1.5 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 text-sm"
                      >
                        Edit
                      </Link>
                    )}

                    {(auth.user?.role === 'ADMIN' || auth.user?.role === 'ESTIMATOR') && (
                      <button
                        type="button"
                        onClick={() => askDelete(r.id, r.projectName)}
                        disabled={deletingId === r.id}
                        className="px-3 py-1.5 rounded-md bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {viewRows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">No bids found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* In-app confirm modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDelete} />
          <div className="relative z-10 w-[90vw] max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold mb-2">Delete bid?</div>
            <p className="text-sm text-slate-600 mb-4">
              Delete <span className="font-medium">"{pendingDelete.projectName}"</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={cancelDelete} className="px-4 py-2 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId === pendingDelete.id}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {deletingId === pendingDelete.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
