import React from 'react'
import { getJSON, postJSON, putJSON, delJSON } from '../../lib/api'

type ScopeCatalogRow = {
  id: number
  name: string
}

export default function Scopes() {
  const [scopes, setScopes] = React.useState<ScopeCatalogRow[]>([])
  const [newScope, setNewScope] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    getJSON<ScopeCatalogRow[]>('/scopes').then(setScopes).catch(e => {
      setError(e?.message ?? 'Failed to load scopes')
    })
  }, [])

  async function addScope() {
    setError(null)
    const name = newScope.trim()
    if (!name) return
    try {
      const created = await postJSON<ScopeCatalogRow>('/scopes', { name })
      setScopes(prev => [...prev, created])
      setNewScope('')
    } catch (e: any) {
      setError(e?.message ?? 'Failed to add scope')
    }
  }

  async function updateScope(id: number, name: string) {
    setError(null)
    const clean = name.trim()
    if (!clean) return
    try {
      const updated = await putJSON<ScopeCatalogRow>(`/scopes/${id}`, { name: clean })
      setScopes(prev => prev.map(sc => (sc.id === id ? updated : sc)))
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update scope')
    }
  }

  async function deleteScope(id: number) {
    setError(null)
    try {
      await delJSON(`/scopes/${id}`)
      setScopes(prev => prev.filter(sc => sc.id !== id))
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete scope')
    }
  }

  return (
    <div className="max-w-2xl space-y-6 font-sans">
      <h1 className="text-2xl font-bold">Scope Catalog</h1>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Scope name"
          value={newScope}
          onChange={e => setNewScope(e.target.value)}
        />
        <button
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white"
          onClick={addScope}
        >
          Add
        </button>
      </div>

      {error && <div className="text-rose-600 text-sm">{error}</div>}

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-left">
            <th className="p-2">Name</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {scopes.map(sc => (
            <tr key={sc.id} className="border-t">
              <td className="p-2">
                <input
                  className="input w-full"
                  value={sc.name}
                  onChange={e => updateScope(sc.id, e.target.value)}
                />
              </td>
              <td className="p-2">
                <button
                  className="rounded-lg bg-rose-600 px-3 py-1 text-white"
                  onClick={() => deleteScope(sc.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {scopes.length === 0 && (
            <tr><td className="p-3 text-slate-500" colSpan={2}>No scopes yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
