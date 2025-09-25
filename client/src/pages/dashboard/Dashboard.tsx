import React from 'react'
import { getJSON } from '../../lib/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Label
} from 'recharts'

type Metrics = {
  activePipelineValue: number
  totalValueWonActiveBids: number      // now: total won from Completed bids in the selected KPI range
  activeWinLossRatio: number           // now: won/(won+lost) from Completed bids in the selected KPI range
  activeWonCount?: number              // won scopes counted (Completed bids only, in range)
  activeLostCount?: number             // lost scopes counted (Completed bids only, in range)
  pendingCount?: number                // snapshot count of pipeline (not range-based)
}

type BidsOver    = { month: string; count: number }[]
type ValueOver   = { month: string; total: number }[]
type ScopeTotals = { scope: string; total: number }[]

const kfmt = (n: number) => {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n}`
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

export default function Dashboard() {
  const [metrics, setMetrics] = React.useState<Metrics | null>(null)

  // Defaults: past 12 months (for KPI range)
  const today = new Date()
  const yearAgo = new Date(today); yearAgo.setFullYear(today.getFullYear() - 1)

  // KPI metrics range (Completed bids only)
  const [mFrom, setMFrom] = React.useState(iso(new Date(yearAgo)))
  const [mTo,   setMTo]   = React.useState(iso(new Date(today)))

  // Existing chart ranges
  const [bFrom, setBFrom] = React.useState(iso(new Date(yearAgo)))
  const [bTo,   setBTo]   = React.useState(iso(new Date(today)))
  const [vFrom, setVFrom] = React.useState(iso(new Date(yearAgo)))
  const [vTo,   setVTo]   = React.useState(iso(new Date(today)))
  const [sFrom, setSFrom] = React.useState(iso(new Date(yearAgo)))
  const [sTo,   setSTo]   = React.useState(iso(new Date(today)))

  const [bidsOver,    setBidsOver]    = React.useState<BidsOver>([])
  const [valueOver,   setValueOver]   = React.useState<ValueOver>([])
  const [scopeTotals, setScopeTotals] = React.useState<ScopeTotals>([])

  // ✅ KPI metrics — Completed bids only, rangeable
  React.useEffect(() => {
    const q = new URLSearchParams({
      start: mFrom,
      end: mTo,
      completedOnly: 'true',     // <-- key change
    })
    getJSON<Metrics>(`/charts/metrics?${q}`)
      .then(setMetrics)
      .catch(() => setMetrics(null))
  }, [mFrom, mTo])

  // Bids over time — using start/end
  React.useEffect(() => {
    const q = new URLSearchParams({ start: bFrom, end: bTo })
    getJSON<BidsOver>(`/charts/bids-over?${q}`)
      .then(setBidsOver)
      .catch(() => setBidsOver([]))
  }, [bFrom, bTo])

  // Value over time — using start/end
  React.useEffect(() => {
    const q = new URLSearchParams({ start: vFrom, end: vTo })
    getJSON<ValueOver>(`/charts/value-over?${q}`)
      .then(setValueOver)
      .catch(() => setValueOver([]))
  }, [vFrom, vTo])

  // Scope totals — using start/end
  React.useEffect(() => {
    const q = new URLSearchParams({ start: sFrom, end: sTo })
    getJSON<ScopeTotals>(`/charts/scope-totals?${q}`)
      .then(setScopeTotals)
      .catch(() => setScopeTotals([]))
  }, [sFrom, sTo])

  return (
    <div className="space-y-6 font-sans">
      {/* Heading */}
      <div className="text-3xl md:text-4xl font-extrabold tracking-tight font-sans-serif">
        Bid Tracker - Dashboard
      </div>

      {/* KPI metrics range (Completed bids only) */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-700 font-medium">KPI range (Completed bids only):</span>
        <input
          type="date"
          className="input !w-28 sm:!w-40"
          value={mFrom}
          onChange={e => setMFrom(e.target.value)}
        />
        <span className="text-sm text-slate-600">to</span>
        <input
          type="date"
          className="input !w-28 sm:!w-40"
          value={mTo}
          onChange={e => setMTo(e.target.value)}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/20">
          <div className="stat-label font-semibold text-slate-600">
            Win/Loss Ratio (Completed, Selected Range)
          </div>
          <div className="stat-value mt-1 font-extrabold text-slate-900">
            {metrics ? metrics.activeWinLossRatio.toFixed(2) : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            {metrics ? `Won ${metrics.activeWonCount ?? 0} / Lost ${metrics.activeLostCount ?? 0}` : '—'}
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/20">
          <div className="stat-label font-semibold text-slate-600">Active Pipeline Value</div>
          <div className="stat-value mt-1 font-extrabold text-slate-900">
            {metrics ? kfmt(metrics.activePipelineValue) : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            Pending scopes: {metrics?.pendingCount ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Snapshot of scopes with status Active/Hot/Cold (excludes Lost)
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/20">
          <div className="stat-label font-semibold text-slate-600">
            Total Value Won (Completed, Selected Range)
          </div>
          <div className="stat-value mt-1 font-extrabold text-slate-900">
            {metrics ? kfmt(metrics.totalValueWonActiveBids) : '—'}
          </div>
        </div>
      </div>

      {/* Bids over time */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-700 font-medium">Bids range:</span>
        <input
          type="date"
          className="input !w-28 sm:!w-40"
          value={bFrom}
          onChange={e => setBFrom(e.target.value)}
        />
        <span className="text-sm text-slate-600">to</span>
        <input
          type="date"
          className="input !w-28 sm:!w-40"
          value={bTo}
          onChange={e => setBTo(e.target.value)}
        />
      </div>
      <div className="rounded-xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/20">
        <div className="chart-title mb-2 font-semibold text-slate-800">Bids Over Selected Range</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bidsOver} margin={{ top: 8, right: 20, left: 44, bottom: 46 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="month" stroke="#334155" tickMargin={8}>
                <Label value="Bids Submitted" position="insideBottom" dy={22} />
              </XAxis>
              <YAxis allowDecimals={false} stroke="#334155" tickMargin={10} />
              <Tooltip />
              <Bar dataKey="count" fill="#60a5fa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Value over time */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-700 font-medium">Value range:</span>
        <input
          type="date"
          className="input !w-28 sm:!w-40"
          value={vFrom}
          onChange={e => setVFrom(e.target.value)}
        />
        <span className="text-sm text-slate-600">to</span>
        <input
          type="date"
          className="input !w-28 sm:!w-40"
          value={vTo}
          onChange={e => setVTo(e.target.value)}
        />
      </div>
      <div className="rounded-xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/20">
        <div className="chart-title mb-2 font-semibold text-slate-800">Bid Value Over Selected Range</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={valueOver} margin={{ top: 8, right: 20, left: 44, bottom: 46 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="month" stroke="#334155" tickMargin={8}>
                <Label value="Total Bid Value" position="insideBottom" dy={22} />
              </XAxis>
              <YAxis stroke="#334155" tickFormatter={kfmt} tickMargin={10} />
              <Tooltip formatter={(v) => kfmt(Number(v))} />
              <Bar dataKey="total" fill="#a78bfa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scope totals */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-700 font-medium">Scope range:</span>
        <input
          type="date"
          className="input !w-28 sm:!w-40"
          value={sFrom}
          onChange={e => setSFrom(e.target.value)}
        />
        <span className="text-sm text-slate-600">to</span>
        <input
          type="date"
          className="input !w-28 sm:!w-40"
          value={sTo}
          onChange={e => setSTo(e.target.value)}
        />
      </div>
      <div className="rounded-xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/20">
        <div className="chart-title mb-2 font-semibold text-slate-800">Total Value by Scope (Won)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scopeTotals} margin={{ top: 8, right: 20, left: 44, bottom: 46 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="scope" stroke="#334155" tickMargin={8}>
                <Label value="Scopes" position="insideBottom" dy={22} />
              </XAxis>
              <YAxis stroke="#334155" tickFormatter={kfmt} tickMargin={10} />
              <Tooltip formatter={(v) => kfmt(Number(v))} />
              <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
