import React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getJSON, putJSON, postJSON } from '../../lib/api'

type Company = { id: number; name: string }
type Contact = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
}
type Scope = { name: string; cost: number; status: 'Pending' | 'Won' | 'Lost' }
type BidStatus = 'Active' | 'Complete' | 'Archived' | 'Hot' | 'Cold'
type Bid = {
  id: number
  projectName: string
  clientCompany: Company
  contact?: Contact | null
  proposalDate?: string | null
  dueDate?: string | null
  followUpOn?: string | null
  jobLocation?: string | null
  leadSource?: string | null
  bidStatus: BidStatus
  scopes: Scope[]
}

type ScopeCatalogRow = { id: number; name: string }

/* ----------------------- helpers ----------------------- */
const currency = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })

const dateToInput = (d?: string | null) => (d ? d.slice(0, 10) : '')

const inputToISO = (v: string) => (v ? `${v}T00:00:00Z` : null)

function statusBadge(s: 'Pending' | 'Won' | 'Lost') {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold'
  if (s === 'Won') return <span className={`${base} bg-emerald-100 text-emerald-700`}>Won</span>
  if (s === 'Lost') return <span className={`${base} bg-rose-100 text-rose-700`}>Lost</span>
  return <span className={`${base} bg-amber-100 text-amber-700`}>Pending</span>
}

function pillBadge(text: string, tone: 'blue' | 'slate' = 'slate') {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${map[tone]}`}>
      {text}
    </span>
  )
}

/* ---------------- scope combobox (unchanged UI) --------------- */
function ScopeNameCombo(props: {
  value: string
  onChange: (val: string) => void
  onCommitNew?: (val: string) => void
  catalog: string[]
}) {
  const { value, onChange, onCommitNew, catalog } = props
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState(value ?? '')
  const [activeIdx, setActiveIdx] = React.useState<number>(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => setQuery(value ?? ''), [value])

  const options = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalog
    return catalog.filter(s => s.toLowerCase().includes(q))
  }, [query, catalog])

  const exists = React.useMemo(
    () => catalog.some(s => s.toLowerCase() === query.trim().toLowerCase()),
    [catalog, query]
  )

  function choose(val: string) {
    onChange(val)
    setQuery(val)
    setOpen(false)
  }

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        className="input w-full"
        placeholder="Scope Name"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActiveIdx(i => Math.min(i + 1, options.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
          else if (e.key === 'Enter') {
            e.preventDefault()
            if (open) {
              if (activeIdx >= 0 && activeIdx < options.length) choose(options[activeIdx])
              else {
                const val = query.trim(); if (!val) return
                onChange(val); if (!exists && onCommitNew) onCommitNew(val); setOpen(false)
              }
            } else {
              const val = query.trim(); if (!val) return
              onChange(val); if (!exists && onCommitNew) onCommitNew(val)
            }
          } else if (e.key === 'Escape') { setOpen(false) }
        }}
        onBlur={() => {
          const val = query.trim(); if (!val) return
          onChange(val); if (!exists && onCommitNew) onCommitNew(val)
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow">
          {options.length > 0 ? (
            options.map((opt, idx) => (
              <div
                key={opt}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-50 ${idx === activeIdx ? 'bg-slate-50' : ''}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => { e.preventDefault(); choose(opt) }}
              >
                {opt}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">No matches</div>
          )}
          {!exists && query.trim() && (
            <div
              className="border-t px-3 py-2 text-sm text-emerald-700 cursor-pointer hover:bg-emerald-50"
              onMouseDown={(e) => {
                e.preventDefault()
                const val = query.trim()
                onChange(val); onCommitNew?.(val); setOpen(false)
              }}
            >
              + Add “{query.trim()}”
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* --------------------- MAIN --------------------- */
export default function BidEdit() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [bid, setBid] = React.useState<Bid | null>(null)

  // editable form state (besides scopes)
  const [edit, setEdit] = React.useState<{
    projectName: string
    clientCompanyId: number | null
    contactId: number | null
    proposalDate: string
    dueDate: string
    followUpOn: string
    jobLocation: string
    leadSource: string
    bidStatus: BidStatus
  } | null>(null)

  // ⬇️ Catalog from API, not localStorage
  const [scopeCatalog, setScopeCatalog] = React.useState<string[]>([])
  const [editScopes, setEditScopes] = React.useState<Scope[]>([])

  // picklists
  const [companies, setCompanies] = React.useState<Company[]>([])
  const [contacts, setContacts] = React.useState<Contact[]>([])

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    getJSON<Bid>(`/bids/${id}`).then((b) => {
      setBid(b)
      setEdit({
        projectName: b.projectName,
        clientCompanyId: b.clientCompany?.id ?? null,
        contactId: b.contact?.id ?? null,
        proposalDate: dateToInput(b.proposalDate),
        dueDate: dateToInput(b.dueDate),
        followUpOn: dateToInput(b.followUpOn),
        jobLocation: b.jobLocation ?? '',
        leadSource: b.leadSource ?? '',
        bidStatus: b.bidStatus,
      })
      setEditScopes(b.scopes?.map(s => ({ ...s })) ?? [])
    })
  }, [id])

  // load companies (best-effort)
  React.useEffect(() => {
    getJSON<Company[]>('/companies').then(setCompanies).catch(() => {})
  }, [])

  // load contacts when company changes (best-effort)
  React.useEffect(() => {
    if (!edit?.clientCompanyId) { setContacts([]); return }
    getJSON<Contact[]>(`/contacts?companyId=${edit.clientCompanyId}`).then(setContacts).catch(() => {})
  }, [edit?.clientCompanyId])

  // ⬇️ Load scope catalog from server
  React.useEffect(() => {
    getJSON<ScopeCatalogRow[]>('/scopes')
      .then(rows => setScopeCatalog(rows.map(r => r.name).sort((a,b)=>a.localeCompare(b))))
      .catch(() => setScopeCatalog([]))
  }, [])

  // ⬇️ Add to catalog on server if missing
  async function addToCatalogIfMissing(name: string) {
    const val = (name || '').trim()
    if (!val) return
    if (scopeCatalog.some(s => s.toLowerCase() === val.toLowerCase())) return
    try {
      await postJSON('/scopes', { name: val })
      setScopeCatalog(prev => [...prev, val].sort((a,b)=>a.localeCompare(b)))
    } catch {
      // optional toast
    }
  }

  function setScope(i: number, key: keyof Scope, val: any) {
    setEditScopes(scopes =>
      scopes.map((s, idx) =>
        idx === i ? { ...s, [key]: key === 'cost' ? Number(val || 0) : val } : s
      )
    )
  }
  function addScopeRow() {
    setEditScopes(scopes => [...scopes, { name: '', cost: 0, status: 'Pending' }])
  }
  function removeScopeRow(i: number) {
    setEditScopes(scopes => scopes.filter((_, idx) => idx !== i))
  }

  async function saveAll() {
    if (!bid || !edit) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        projectName: edit.projectName.trim(),
        clientCompanyId: edit.clientCompanyId ?? bid.clientCompany?.id ?? null,
        contactId: edit.contactId ?? null,
        proposalDate: edit.proposalDate ? inputToISO(edit.proposalDate) : null,
        dueDate: edit.dueDate ? inputToISO(edit.dueDate) : null,
        followUpOn: edit.followUpOn ? inputToISO(edit.followUpOn) : null,
        jobLocation: edit.jobLocation || null,
        leadSource: edit.leadSource || null,
        bidStatus: edit.bidStatus,
        scopes: editScopes.map(s => ({
          name: (s.name || '').trim(),
          cost: Number(s.cost || 0),
          status: s.status,
        })),
      }
      await putJSON(`/bids/${bid.id}`, payload)
      const refreshed = await getJSON<Bid>(`/bids/${bid.id}`)
      setBid(refreshed)
      setEdit({
        projectName: refreshed.projectName,
        clientCompanyId: refreshed.clientCompany?.id ?? null,
        contactId: refreshed.contact?.id ?? null,
        proposalDate: dateToInput(refreshed.proposalDate),
        dueDate: dateToInput(refreshed.dueDate),
        followUpOn: dateToInput(refreshed.followUpOn),
        jobLocation: refreshed.jobLocation ?? '',
        leadSource: refreshed.leadSource ?? '',
        bidStatus: refreshed.bidStatus,
      })
      setEditScopes(refreshed.scopes?.map(s => ({ ...s })) ?? [])
    } catch (e: any) {
      setError(e?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (!bid || !edit) return <div>Loading…</div>

  const total = editScopes.reduce((a, s) => a + Number(s.cost || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Edit Bid</h1>
        <div className="flex gap-2">
          <Link to={`/bids/${bid.id}`} className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200">View</Link>
          <button className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-800" onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>

      {/* === Bid Info Form === */}
      <div className="rounded-xl bg-white p-6 shadow-soft ring-1 ring-black/5">
        <div className="mb-4 text-lg font-semibold">Bid Information</div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest text-slate-500">PROJECT NAME</span>
            <input className="input w-full" value={edit.projectName}
              onChange={e => setEdit(v => v ? { ...v, projectName: e.target.value } : v)} />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest text-slate-500">COMPANY</span>
            {companies.length > 0 ? (
              <select
                className="select w-full"
                value={edit.clientCompanyId ?? ''}
                onChange={(e) => setEdit(v => v ? { ...v, clientCompanyId: e.target.value ? Number(e.target.value) : null, contactId: null } : v)}
              >
                <option value="">— Select company —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <input
                className="input w-full"
                placeholder="Company ID (no /companies endpoint)"
                value={edit.clientCompanyId ?? ''}
                onChange={(e) => setEdit(v => v ? { ...v, clientCompanyId: e.target.value ? Number(e.target.value) : null, contactId: null } : v)}
              />
            )}
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest text-slate-500">CONTACT</span>
            {contacts.length > 0 ? (
              <select
                className="select w-full"
                value={edit.contactId ?? ''}
                onChange={(e) => setEdit(v => v ? { ...v, contactId: e.target.value ? Number(e.target.value) : null } : v)}
              >
                <option value="">— Select contact —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <input
                className="input w-full"
                placeholder="Contact ID (no /contacts endpoint)"
                value={edit.contactId ?? ''}
                onChange={(e) => setEdit(v => v ? { ...v, contactId: e.target.value ? Number(e.target.value) : null } : v)}
              />
            )}
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest text-slate-500">PROPOSAL DATE</span>
            <input type="date" className="input w-full" value={edit.proposalDate}
              onChange={e => setEdit(v => v ? { ...v, proposalDate: e.target.value } : v)} />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest text-slate-500">DUE DATE</span>
            <input type="date" className="input w-full" value={edit.dueDate}
              onChange={e => setEdit(v => v ? { ...v, dueDate: e.target.value } : v)} />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest text-slate-500">FOLLOW-UP ON</span>
            <input type="date" className="input w-full" value={edit.followUpOn}
              onChange={e => setEdit(v => v ? { ...v, followUpOn: e.target.value } : v)} />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest text-slate-500">JOB LOCATION</span>
            <input className="input w-full" value={edit.jobLocation}
              onChange={e => setEdit(v => v ? { ...v, jobLocation: e.target.value } : v)} />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest text-slate-500">LEAD SOURCE</span>
            <input className="input w-full" value={edit.leadSource}
              onChange={e => setEdit(v => v ? { ...v, leadSource: e.target.value } : v)} />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest text-slate-500">BID STATUS</span>
            <select
              className="select w-full"
              value={edit.bidStatus}
              onChange={e => setEdit(v => v ? { ...v, bidStatus: e.target.value as BidStatus } : v)}
            >
              <option>Active</option>
              <option>Complete</option>
              <option>Archived</option>
              <option>Hot</option>
              <option>Cold</option>
            </select>
          </label>
        </div>
      </div>

      {/* === Read-only summary === */}
      <div className="rounded-xl bg-white p-6 shadow-soft ring-1 ring-black/5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-widest text-slate-500">CLIENT</div>
            <div className="text-slate-900">{bid.clientCompany?.name ?? '—'}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-widest text-slate-500">BID STATUS</div>
            {pillBadge(edit.bidStatus, 'slate')}
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-widest text-slate-500">TOTAL AMOUNT</div>
            <div className="text-2xl font-extrabold tracking-tight text-slate-900">
              {currency(total)}
            </div>
          </div>
        </div>
      </div>

      {/* === Read-only scopes table === */}
      <div className="rounded-xl bg-white p-6 shadow-soft ring-1 ring-black/5">
        <div className="mb-3 text-lg font-semibold">Existing Scopes</div>
        <div className="-mx-4 overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="text-left text-sm text-slate-500">
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium w-48">Cost</th>
                <th className="px-4 py-3 font-medium w-40">Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {bid.scopes.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">{currency(Number(s.cost || 0))}</td>
                  <td className="px-4 py-3">{statusBadge(s.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* === Editable scopes === */}
      <div className="rounded-xl bg-white p-6 shadow-soft ring-1 ring-black/5">
        <div className="mb-3 text-lg font-semibold">Edit Scopes</div>

        {editScopes.map((s, i) => (
          <div key={i} className="mb-2 grid grid-cols-12 items-center gap-2">
            <div className="col-span-5 md:col-span-5">
              <ScopeNameCombo
                value={s.name}
                catalog={scopeCatalog}
                onChange={(val) => setScope(i, 'name', val)}
                onCommitNew={(val) => addToCatalogIfMissing(val)}
              />
            </div>
            <input
              className="input col-span-3 md:col-span-3"
              type="number" min={0} step={1} placeholder="Cost"
              value={s.cost}
              onChange={e => setScope(i, 'cost', e.target.value)}
            />
            <select
              className="select col-span-3 md:col-span-3"
              value={s.status}
              onChange={e => setScope(i, 'status', e.target.value as Scope['status'])}
            >
              <option>Pending</option>
              <option>Won</option>
              <option>Lost</option>
            </select>
            <button
              type="button"
              className="col-span-1 rounded-lg border border-rose-300 px-2 py-1 text-rose-600 hover:bg-rose-50"
              onClick={() => removeScopeRow(i)}
              title="Remove scope"
            >−</button>
          </div>
        ))}

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            onClick={addScopeRow}
          >
            + Add scope
          </button>

          <div className="ml-auto flex items-center gap-3">
            {error && <span className="text-sm text-rose-600">{error}</span>}
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700 disabled:opacity-60"
              onClick={saveAll}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
