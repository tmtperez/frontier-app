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
  // kept for compatibility with existing API responses; not rendered anymore
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

// small, tolerant date helpers (handles ISO nicely; returns stable YYYY-MM-DD)
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
  // ceil so partial days count as 1
  return Math.max(0, Math.ceil((B - A) / 86_400_000))
}

type SortBy = 'proposalDate' | 'dueDate' | 'dueIn'
type SortDir = 'asc' | 'desc'

export default function Bids() {
  const auth = React.useContext(AuthContext)

  const [tab, setTab] = React.useState<
    'Active' | 'Complete' | 'Archived' | 'Hot' | 'Cold'
  >('Active')
  const [rows, setRows] = React.useState<Row[]>([])
  const [search, setSearch] = React.useState('')

  // createdAt range
  const [from, setFrom] = React.useState<string>('')
  const [to, setTo] = React.useState<string>('')

  // due-in filter and sorting controls
  const [dueInMax, setDueInMax] = React.useState<string>('') // user types a number; we treat as "≤ X"
  const [sortBy, setSortBy] = React.useState<SortBy>('dueDate')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

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

  // derived view with (1) due-in filter, (2) sorting
  const viewRows = React.useMemo(() => {
    let r = rows.map(row => {
      const dueIn = daysBetween(row.proposalDate ?? null, row.dueDate ?? null)
      return { ...row, _dueIn: dueIn } as Row & { _dueIn: number | null }
    })

    // filter: "Due in ≤ X days" if provided
    const max = Number(dueInMax)
    if (dueInMax !== '' && Number.isFinite(max)) {
      r = r.filter(row => row._dueIn !== null && row._dueIn <= max)
    }

    // sorting
    r.sort((a, b) => {
      const pick = (row: any) => {
        if (sortBy === 'dueIn') return row._dueIn
        if (sortBy === 'proposalDate') return parseDate(row.proposalDate)?.getTime() ?? null
        // dueDate
        return parseDate(row.dueDate)?.getTime() ?? null
      }
      const va = pick(a)
      const vb = pick(b)

      // nulls last
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
          {/* Green Import button */}
          <label className="cursor-pointer px-4 py-2 rounded-md bg-green-500 text-white text-sm font-medium shadow hover:bg-green-600 transition">
            <input type="file" accept=".csv" onChange={onImport} className="hidden" />
            Import Bids
          </label>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600">Created:</span>
        <input
          type="date"
          className="input !w-28 sm:!w-40"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span className="text-sm text-slate-600">to</span>
        <input
          type="date"
          className="input !w-28 sm:!w-40"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button
          type="button"
          className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium shadow hover:bg-red-600 transition"
          onClick={() => { setFrom(''); setTo('') }}
        >
          Clear
        </button>

        {/* Due-in filter */}
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

        {/* Sorting controls */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-600">Sort by:</span>
          <select
            className="input !w-36"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
          >
            <option value="proposalDate">Proposal Date</option>
            <option value="dueDate">Due Date</option>
            <option value="dueIn">Due in (days)</option>
          </select>
          <select
            className="input !w-32"
            value={sortDir}
            onChange={e => setSortDir(e.target.value as SortDir)}
          >
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
              className={
                pillBase + ' ' + (active ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-700')
              }
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
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-600">PROJECT NAME</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-600">CLIENT</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-600">AMOUNT</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-600">PROPOSAL DATE</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-600">DUE DATE</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-600">DUE IN</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-600">FOLLOW-UP IN</th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-600">ACTIONS</th>
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
                      className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm font-normal transition"
                    >
                      Details
                    </Link>
                    {(auth.user?.role === 'ADMIN' ||
                      auth.user?.role === 'MANAGER' ||
                      auth.user?.role === 'ESTIMATOR') && (
                      <Link
                        to={`/bids/${r.id}/edit`}
                        className="px-3 py-1.5 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 text-sm font-normal transition"
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {viewRows.length === 0 && (
              <tr>
                {/* colSpan reduced by 1 because we removed the Scope Status column */}
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  No bids found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
