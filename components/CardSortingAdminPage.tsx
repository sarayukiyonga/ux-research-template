'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  defaultCardSortingConfig,
  newCardSortingId,
  type CardSortingConfig,
} from '@/lib/card-sorting-types'
import type { CardSortingSubmissionStored } from '@/lib/card-sorting-submissions-types'
import { mvpSavedPayloadToCards } from '@/lib/card-sorting-mvp'
import { MOSCOW_SCOPE_ALL } from '@/lib/moscow-types'
import { CardSortingSubmissionsInsights } from '@/components/CardSortingSubmissionsInsights'

interface MvpScopeOptionRow {
  id: string
  label: string
}

export function CardSortingAdminPage() {
  const [config, setConfig] = useState<CardSortingConfig>(() => defaultCardSortingConfig())
  const [scopeOptions, setScopeOptions] = useState<MvpScopeOptionRow[]>([
    { id: MOSCOW_SCOPE_ALL, label: 'Todos los canales' },
  ])
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newCardLabel, setNewCardLabel] = useState('')
  const [newCatLabel, setNewCatLabel] = useState('')
  const [submissions, setSubmissions] = useState<CardSortingSubmissionStored[]>([])
  const [refreshingSubmissions, setRefreshingSubmissions] = useState(false)
  const [mvpReplaceStatus, setMvpReplaceStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [mvpMergeStatus, setMvpMergeStatus] = useState<'idle' | 'loading' | 'done'>('idle')

  const btnBase =
    'cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all duration-150 hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'
  const btnVioletSolid = `${btnBase} bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800`
  const btnVioletSoft = `${btnBase} border border-violet-300 bg-violet-50 font-medium text-violet-900 hover:bg-violet-100 active:bg-violet-100/80`
  const btnVioletOutline = `${btnBase} border border-violet-300 bg-white font-medium text-violet-800 hover:bg-violet-50 active:bg-violet-50/80`
  const btnNeutral = `${btnBase} border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100/80`
  const btnDanger = 'cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 active:bg-red-100/80'
  const btnDark = `${btnBase} bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 active:bg-gray-950`

  const refreshSubmissions = useCallback(async () => {
    setRefreshingSubmissions(true)
    try {
      const res = await fetch('/api/card-sorting-config')
      const data = await res.json()
      if (res.ok && Array.isArray(data.submissions)) {
        setSubmissions(data.submissions as CardSortingSubmissionStored[])
      }
    } finally {
      setRefreshingSubmissions(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [cfgRes, scRes] = await Promise.all([
          fetch('/api/card-sorting-config'),
          fetch('/api/moscow-scopes'),
        ])
        const cfgData = await cfgRes.json()
        const scData = await scRes.json()
        if (cancelled) return
        if (!cfgRes.ok) throw new Error(cfgData.error || 'No se pudo cargar')

        const opts: MvpScopeOptionRow[] =
          Array.isArray(scData.options) && scData.options.length > 0
            ? scData.options
            : [{ id: MOSCOW_SCOPE_ALL, label: 'Todos los canales' }]
        setScopeOptions(opts)

        if (cfgData.config) {
          const c = cfgData.config as CardSortingConfig
          const sid = (c.mvpScope ?? MOSCOW_SCOPE_ALL).trim() || MOSCOW_SCOPE_ALL
          const found = opts.find((o) => o.id === sid)
          setConfig({
            ...c,
            mvpScope: found ? sid : MOSCOW_SCOPE_ALL,
            mvpScopeLabel: found?.label ?? c.mvpScopeLabel ?? 'Todos los canales',
          })
        } else {
          setConfig(defaultCardSortingConfig())
        }
        setSavedAt(cfgData.savedAt ?? null)
        if (Array.isArray(cfgData.submissions)) {
          setSubmissions(cfgData.submissions as CardSortingSubmissionStored[])
        } else {
          setSubmissions([])
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const scope = config.mvpScope ?? MOSCOW_SCOPE_ALL

  const setMvpScope = (scopeId: string) => {
    const opt = scopeOptions.find((o) => o.id === scopeId)
    setConfig((prev) => ({
      ...prev,
      mvpScope: scopeId,
      mvpScopeLabel: opt?.label ?? scopeId,
    }))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/card-sorting-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setSavedAt(data.savedAt ?? null)
      if (data.config) setConfig(data.config)
      await refreshSubmissions()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const importFromMvpReplace = async () => {
    if (mvpReplaceStatus === 'loading') return
    setMvpReplaceStatus('loading')
    setError(null)
    try {
      const res = await fetch('/api/mvp-saved')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al leer MVP')
      const fromMvp = mvpSavedPayloadToCards(data, scope)
      if (fromMvp.length === 0) {
        setError('No hay notas en el MVP guardado para el canal seleccionado.')
        setMvpReplaceStatus('idle')
        return
      }
      if (config.cards.length > 0) {
        const label = config.mvpScopeLabel ?? scope
        const ok = window.confirm(
          `¿Sustituir las ${config.cards.length} tarjetas actuales por ${fromMvp.length} tarjetas generadas desde el MVP del ámbito «${label}»?`
        )
        if (!ok) {
          setMvpReplaceStatus('idle')
          return
        }
      }
      setConfig((prev) => ({ ...prev, cards: fromMvp }))
      setMvpReplaceStatus('done')
      window.setTimeout(() => setMvpReplaceStatus('idle'), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setMvpReplaceStatus('idle')
    }
  }

  const importFromMvpMerge = async () => {
    if (mvpMergeStatus === 'loading') return
    setMvpMergeStatus('loading')
    setError(null)
    try {
      const res = await fetch('/api/mvp-saved')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al leer MVP')
      const fromMvp = mvpSavedPayloadToCards(data, scope)
      if (fromMvp.length === 0) {
        setError('No hay notas en el MVP guardado para el canal seleccionado.')
        setMvpMergeStatus('idle')
        return
      }
      const existing = new Set(config.cards.map((c) => c.label.trim().toLowerCase()))
      const merged = [...config.cards]
      let added = 0
      for (const c of fromMvp) {
        const k = c.label.trim().toLowerCase()
        if (!k || existing.has(k)) continue
        existing.add(k)
        merged.push(c)
        added++
      }
      if (added === 0) {
        setError('Todas las notas MVP de este canal ya estaban en la lista.')
        setMvpMergeStatus('idle')
        return
      }
      setConfig({ ...config, cards: merged })
      setMvpMergeStatus('done')
      window.setTimeout(() => setMvpMergeStatus('idle'), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setMvpMergeStatus('idle')
    }
  }

  const updateCard = (id: string, label: string) => {
    setConfig((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === id ? { ...c, label } : c)),
    }))
  }

  const removeCard = (id: string) => {
    setConfig((prev) => ({ ...prev, cards: prev.cards.filter((c) => c.id !== id) }))
  }

  const addCard = () => {
    const label = newCardLabel.trim().slice(0, 160)
    if (!label) return
    setNewCardLabel('')
    setConfig((prev) => ({
      ...prev,
      cards: [...prev.cards, { id: newCardSortingId('card'), label }],
    }))
  }

  const updateCat = (id: string, label: string) => {
    setConfig((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, label } : c)),
    }))
  }

  const removeCat = (id: string) => {
    setConfig((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== id) }))
  }

  const addCategory = () => {
    const label = newCatLabel.trim().slice(0, 120)
    if (!label) return
    setNewCatLabel('')
    setConfig((prev) => ({
      ...prev,
      categories: [...prev.categories, { id: newCardSortingId('cat'), label }],
    }))
  }

  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/participa/card-sorting` : '/participa/card-sorting'

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Cargando configuración…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Canal del MVP</h2>
        <p className="mt-1 text-sm text-gray-500">
          Mismo listado de ámbitos que en la matriz MVP y MoSCoW. Las acciones «desde MVP» usan solo las notas de la
          matriz guardada para el canal elegido (en «Todos los canales», la vista combinada genérica).
        </p>
        <div className="mt-4 max-w-xl">
          <label htmlFor="card-sort-mvp-scope" className="block text-xs font-medium text-gray-600 mb-1.5">
            Canal
          </label>
          <select
            id="card-sort-mvp-scope"
            value={scope}
            onChange={(e) => setMvpScope(e.target.value)}
            className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-shadow hover:border-violet-300 hover:shadow-sm"
          >
            {scopeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={btnVioletSolid}
        >
          {saving ? 'Guardando…' : 'Guardar en Sheets'}
        </button>
        <button
          type="button"
          onClick={() => void importFromMvpReplace()}
          disabled={mvpReplaceStatus === 'loading' || mvpReplaceStatus === 'done' || saving}
          className={btnVioletSoft}
        >
          {mvpReplaceStatus === 'loading'
            ? 'Generando tarjetas…'
            : mvpReplaceStatus === 'done'
              ? 'Tarjetas generadas'
              : 'Generar tarjetas desde MVP (este canal)'}
        </button>
        <button
          type="button"
          onClick={() => void importFromMvpMerge()}
          disabled={mvpMergeStatus === 'loading' || mvpMergeStatus === 'done' || saving}
          className={btnVioletOutline}
        >
          {mvpMergeStatus === 'loading'
            ? 'Añadiendo desde MVP…'
            : mvpMergeStatus === 'done'
              ? 'Notas añadidas'
              : 'Añadir desde MVP sin borrar'}
        </button>
        <Link
          href="/participa/card-sorting"
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnNeutral} inline-flex cursor-pointer items-center justify-center no-underline`}
        >
          Abrir sesión pública (participantes)
        </Link>
      </div>
      {savedAt && <p className="text-xs text-gray-500">Último guardado: {savedAt}</p>}
      <p className="text-xs text-gray-500">
        Enlace para compartir: <span className="font-mono text-gray-700">{publicUrl}</span>
      </p>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Tarjetas (páginas / secciones)</h2>
        <p className="mt-1 text-sm text-gray-500">
          Genera la lista desde el MVP del canal seleccionado o edítala a mano. El ámbito elegido se guarda y se muestra
          a los participantes como contexto.
        </p>
        <ul className="mt-4 space-y-2">
          {config.cards.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <input
                className="min-w-[12rem] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={c.label}
                onChange={(e) => updateCard(c.id, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeCard(c.id)}
                className={btnDanger}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="min-w-[12rem] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Nueva tarjeta…"
            value={newCardLabel}
            onChange={(e) => setNewCardLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCard()}
          />
          <button type="button" onClick={addCard} className={btnDark}>
            Añadir
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Categorías (columnas del ejercicio)</h2>
        <p className="mt-1 text-sm text-gray-500">
          Los participantes verán estas columnas; podrán añadir categorías extra solo en su sesión (no se guardan en
          Sheets).
        </p>
        <ul className="mt-4 space-y-2">
          {config.categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <input
                className="min-w-[12rem] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={c.label}
                onChange={(e) => updateCat(c.id, e.target.value)}
              />
              <button type="button" onClick={() => removeCat(c.id)} className={btnDanger}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="min-w-[12rem] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Nueva categoría…"
            value={newCatLabel}
            onChange={(e) => setNewCatLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button type="button" onClick={addCategory} className={btnDark}>
            Añadir categoría
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Participaciones guardadas</h2>
          <button
            type="button"
            disabled={refreshingSubmissions}
            onClick={() => void refreshSubmissions()}
            className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-all duration-150 hover:bg-gray-50 hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
          >
            {refreshingSubmissions ? 'Actualizando…' : 'Actualizar resultados'}
          </button>
        </div>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          Cada participante recibe un ID anónimo en su navegador; al mover tarjetas su ordenación se guarda sola en la
          hoja <span className="font-mono text-gray-700">card_sorting_resp</span> del mismo spreadsheet CEO.
        </p>
        <CardSortingSubmissionsInsights config={config} submissions={submissions} />
      </section>
    </div>
  )
}
