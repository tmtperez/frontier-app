// client/src/pages/companies/List.tsx
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getJSON } from '../../lib/api'

type Row = {
  id: number
  name: string
  projects: { id: number; name: string }[]
  won: number
  lost: number
}

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function Companies() {
  const [rows, setRows] = React.useState<Row[]>([])
  const navigate = useNavigate()

  React.useEffect(() => {
    getJSON<Row[]>('/companies').then(setRows)
  }, [])

  // handle selecting a project from the dropdown
  function handleProjectSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const bidId = e.target.value
    if (!bidId) return // ignore the placeholder
    navigate(`/bids/${bidId}`)
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Header + CTA */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Companies</h1>
        <Link
          to="/companies/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
        >
          Add Company
        </Link>
      </div>

      <div className="card overflow-hidden ring-1 ring-slate-900/5">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-left text-base font-bold uppercase tracking-wider text-slate-600">
                Company Name
              </th>
              <th className="px-4 py-3 text-left text-base font-bold uppercase tracking-wider text-slate-600">
                Projects
              </th>
              <th className="px-4 py-3 text-left text-base font-bold uppercase tracking-wider text-slate-600">
                Total Won
              </th>
              <th className="px-4 py-3 text-left text-base font-bold uppercase tracking-wider text-slate-600">
                Total Lost
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={r.id}
                className={`border-t border-slate-100 hover:bg-slate-50 ${
                  idx % 2 === 1 ? 'bg-white' : 'bg-white'
                }`}
              >
                <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>

                <td className="px-4 py-3">
                  <select
                    className="select w-100 sm:w-100"
                    defaultValue=""
                    aria-label={`Projects for ${r.name}`}
                    onChange={handleProjectSelect}
                  >
                    <option value="" disabled>
                      Projects...
                    </option>
                    {r.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Money columns kept right-aligned to match headers */}
                <td className="px-4 py-3 text-left">
                  <span className="tabular-nums font-semibold text-slate-700">{currency(r.won)}</span>
                </td>
                <td className="px-4 py-3 text-left">
                  <span className="tabular-nums font-semibold text-slate-700">{currency(r.lost)}</span>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No companies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
