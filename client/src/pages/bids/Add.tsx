// client/src/pages/bids/Add.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getJSON, postJSON } from '../../lib/api'

type Company = { id: number; name: string }
type Contact = { id: number; name: string; company?: Company }
type ScopeInput = { name: string; cost: number; status: 'Pending'|'Won'|'Lost' }

type BidForm = {
  projectName: string
  clientCompanyId: number | ''   // '' until selected
  contactId: number | ''         // '' until selected
  proposalDate: string           // ''
  dueDate: string                // ''
  followUpOn: string             // ''  (NEW)
  jobLocation: string
  leadSource: string
  bidStatus: 'Active' | 'Complete' | 'Archived' | 'Hot' | 'Cold'
  scopes: ScopeInput[]
}

type ScopeCatalogRow = { id: number; name: string }

// Small helper: currency (optional, used for total)
const currency = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })

// Reusable Combo: text filter + select (keeps dropdown, adds search)
function ComboSelect<T extends { id: number; name: string }>(props: {
  label: string
  value: number | ''
  options: T[]
  onChange: (id: number | '') => void
  placeholder?: string
}) {
  const { label, value, options, onChange, placeholder } = props
  const [q, setQ] = React.useState('')

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return options
    return options.filter(o => o.name.toLowerCase().includes(s))
  }, [q, options])

  return (
    <div>
      <label className="label">{label}</label>
      <div className="space-y-2">
        <input
          className="input"
          placeholder={placeholder ?? 'Type to search…'}
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select
          className="select"
          value={value}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select…</option>
          {filtered.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ---------- Scope Name Combobox (type-ahead with “add if missing”) ----------
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
    props.onChange(val)
    setQuery(val)
    setOpen(false)
  }

  // Close on outside click
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
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActiveIdx(i => Math.min(i + 1, options.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIdx(i => Math.max(i - 1, -1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (open) {
              if (activeIdx >= 0 && activeIdx < options.length) {
                choose(options[activeIdx])
              } else {
                const val = query.trim()
                if (!val) return
                props.onChange(val)
                if (!exists && props.onCommitNew) props.onCommitNew(val)
                setOpen(false)
              }
            } else {
              const val = query.trim()
              if (!val) return
              props.onChange(val)
              if (!exists && props.onCommitNew) props.onCommitNew(val)
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        onBlur={() => {
          const val = query.trim()
          if (!val) return
          props.onChange(val)
          if (!exists && props.onCommitNew) props.onCommitNew(val)
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
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(opt)
                }}
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
                props.onChange(val)
                props.onCommitNew?.(val)
                setOpen(false)
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

export default function AddBid() {
  const navigate = useNavigate()

  const [companies, setCompanies] = React.useState<Company[]>([])
  const [contacts, setContacts] = React.useState<Contact[]>([])

  const [saving, setSaving]   = React.useState(false)
  const [error, setError]     = React.useState<string | null>(null)

  // ⬇️ Scope catalog from API (NOT localStorage)
  const [scopeCatalog, setScopeCatalog] = React.useState<string[]>([])

  const [form, setForm] = React.useState<BidForm>({
    projectName: '',
    clientCompanyId: '',
    contactId: '',
    proposalDate: '',
    dueDate: '',
    followUpOn: '',
    jobLocation: '',
    leadSource: '',
    bidStatus: 'Active',
    scopes: [{ name: 'Base Scope', cost: 0, status: 'Pending' }],
  })

  React.useEffect(() => {
    // get companies + contacts once
    getJSON<Company[]>('/companies').then(cs =>
      setCompanies(cs.map(c => ({ id: c.id, name: c.name })))
    )
    getJSON<Contact[]>('/contacts').then(setContacts)

    // load scope catalog from server
    getJSON<ScopeCatalogRow[]>('/scopes')
      .then(rows => setScopeCatalog(rows.map(r => r.name).sort((a,b)=>a.localeCompare(b))))
      .catch(() => setScopeCatalog([]))
  }, [])

  function setField<K extends keyof BidForm>(key: K, val: BidForm[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function setScope(i: number, key: keyof ScopeInput, val: any) {
    setForm(f => ({
      ...f,
      scopes: f.scopes.map((s, idx) =>
        idx === i ? { ...s, [key]: key === 'cost' ? Number(val || 0) : val } : s
      ),
    }))
  }

  function addScope() {
    setForm(f => ({
      ...f,
      scopes: [...f.scopes, { name: '', cost: 0, status: 'Pending' }],
    }))
  }

  function removeScope(i: number) {
    setForm(f => ({ ...f, scopes: f.scopes.filter((_, idx) => idx !== i) }))
  }

  // ⬇️ create missing scope in catalog via API
  async function addToCatalogIfMissing(name: string) {
    const val = name.trim()
    if (!val) return
    if (scopeCatalog.some(s => s.toLowerCase() === val.toLowerCase())) return
    try {
      await postJSON('/scopes', { name: val })
      setScopeCatalog(prev => [...prev, val].sort((a,b)=>a.localeCompare(b)))
    } catch {
      // silently ignore for now; could add a toast
    }
  }

  // Filter contacts by selected company if one is chosen
  const visibleContacts = React.useMemo(() => {
    if (!form.clientCompanyId) return contacts
    return contacts.filter(c => c.company?.id === form.clientCompanyId)
  }, [contacts, form.clientCompanyId])

  const total = form.scopes.reduce((a, s) => a + Number(s.cost || 0), 0)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        projectName: form.projectName.trim(),
        clientCompanyId: Number(form.clientCompanyId),
        contactId: form.contactId ? Number(form.contactId) : null,
        proposalDate: form.proposalDate || null,
        dueDate: form.dueDate || null,
        followUpOn: form.followUpOn || null,
        jobLocation: form.jobLocation || null,
        leadSource: form.leadSource || null,
        bidStatus: form.bidStatus,
        scopes: form.scopes.map(s => ({
          name: s.name.trim(),
          cost: Number(s.cost || 0),
          status: s.status,
        })),
      }

      if (!payload.clientCompanyId) {
        throw new Error('Please select a client company.')
      }

      await postJSON('/bids', payload)
      navigate('/bids')
    } catch (err: any) {
      setError(err?.message || 'Failed to create bid')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl font-sans">
      <div className="mb-4 text-2xl font-extrabold tracking-tight">Add Bid</div>

      <form onSubmit={onSubmit} className="card space-y-5 p-5">
        <div>
          <label className="label">Project Name</label>
          <input
            className="input"
            value={form.projectName}
            onChange={e => setField('projectName', e.target.value)}
            required
          />
        </div>

        {/* Company + Contact (searchable combos like Edit) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ComboSelect
            label="Client Company"
            value={form.clientCompanyId}
            options={companies}
            onChange={(v) => {
              setField('clientCompanyId', v)
              setField('contactId', '')
            }}
            placeholder="Search company…"
          />
          <ComboSelect
            label="Contact Person"
            value={form.contactId}
            options={visibleContacts.map(c => ({
              id: c.id,
              name: `${c.name} (${c.company?.name ?? '—'})`,
            }))}
            onChange={(v) => setField('contactId', v)}
            placeholder="Search contact…"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">Proposal Date</label>
            <input
              className="input"
              type="date"
              value={form.proposalDate}
              onChange={e => setField('proposalDate', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input
              className="input"
              type="date"
              value={form.dueDate}
              onChange={e => setField('dueDate', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Follow-up In</label>
            <input
              className="input"
              type="date"
              value={form.followUpOn}
              onChange={e => setField('followUpOn', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Job Location</label>
            <input
              className="input"
              value={form.jobLocation}
              onChange={e => setField('jobLocation', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Lead Source</label>
            <input
              className="input"
              value={form.leadSource}
              onChange={e => setField('leadSource', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Bid Status</label>
          <select
            className="select"
            value={form.bidStatus}
            onChange={e => setField('bidStatus', e.target.value as BidForm['bidStatus'])}
          >
            <option>Active</option>
            <option>Hot</option>
            <option>Cold</option>
            <option>Complete</option>
            <option>Archived</option>
          </select>
        </div>

        {/* Scopes */}
        <div className="pt-2">
          <div className="mb-2 font-medium">Scope Breakdown</div>
          {form.scopes.map((s, i) => (
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
                type="number"
                min={0}
                step={1}
                placeholder="Cost"
                value={s.cost}
                onChange={e => setScope(i, 'cost', e.target.value)}
              />
              <select
                className="select col-span-3 md:col-span-3"
                value={s.status}
                onChange={e => setScope(i, 'status', e.target.value)}
              >
                <option>Pending</option>
                <option>Won</option>
                <option>Lost</option>
              </select>
              <button
                type="button"
                className="col-span-1 rounded-lg border border-rose-300 px-2 py-1 text-rose-600 hover:bg-rose-50"
                onClick={() => removeScope(i)}
                title="Remove scope"
              >
                −
              </button>
            </div>
          ))}
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            onClick={addScope}
          >
            + Add scope
          </button>
        </div>

        <div className="pt-2 text-right text-lg font-semibold">
          Total: {currency(total)}
        </div>

        {error && <div className="text-rose-600 text-sm">{error}</div>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="rounded-lg bg-rose-600 px-4 py-2 text-white shadow hover:bg-rose-700"
            onClick={() => history.back()}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700"
            disabled={saving}
          >
            {saving ? 'Creating…' : 'Create Bid'}
          </button>
        </div>
      </form>
    </div>
  )
}
