'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { AutoTextarea } from '@/components/ui/auto-textarea'
import { sanitizeInsightsPayload, type InsightsSurveyPayload } from '@/lib/insights-sanitize'

export type InsightsSegment = 'clientes' | 'potenciales'

type InsightsData = InsightsSurveyPayload

function InsightsEditIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function InsightsPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

const SEGMENT_META: Record<
  InsightsSegment,
  {
    otherHref: string
    otherLabel: string
    accent: 'amber' | 'orange'
    empathyHref: string
    userPersonaHref: string
  }
> = {
  clientes: {
    otherHref: '/insights?tab=potenciales',
    otherLabel: 'Ver insights de clientes potenciales →',
    accent: 'amber',
    empathyHref: '/empathy/clientes',
    userPersonaHref: '/user-persona',
  },
  potenciales: {
    otherHref: '/insights',
    otherLabel: '← Ver insights de clientes actuales',
    accent: 'orange',
    empathyHref: '/empathy/potenciales',
    userPersonaHref: '/user-persona',
  },
}

export function SurveyInsightsPage({
  segment,
  embedTabs = false,
}: {
  segment: InsightsSegment
  embedTabs?: boolean
}) {
  const meta = SEGMENT_META[segment]
  const [data, setData] = useState<InsightsData | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [hasEmpathyMap, setHasEmpathyMap] = useState(false)

  const [editingResumen, setEditingResumen] = useState(false)
  const [resumenDraft, setResumenDraft] = useState('')
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null)
  const [blockTituloDraft, setBlockTituloDraft] = useState('')
  const [blockItemsDraft, setBlockItemsDraft] = useState('')
  const [addingBlock, setAddingBlock] = useState(false)
  const [newTituloDraft, setNewTituloDraft] = useState('')
  const [newItemsDraft, setNewItemsDraft] = useState('')

  const clearEdits = useCallback(() => {
    setEditingResumen(false)
    setResumenDraft('')
    setEditingBlockIndex(null)
    setBlockTituloDraft('')
    setBlockItemsDraft('')
    setAddingBlock(false)
    setNewTituloDraft('')
    setNewItemsDraft('')
  }, [])

  useEffect(() => {
    clearEdits()
    Promise.all([
      fetch(`/api/insights-survey-saved?segment=${segment}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/empathy-map-saved?segment=${segment}`).then((r) => r.json()).catch(() => ({})),
    ]).then(([saved, empathy]) => {
      if (saved?.saved) {
        setData(sanitizeInsightsPayload(saved.saved.data as InsightsData))
        setSavedAt(saved.saved.savedAt)
      }
      setHasEmpathyMap(Boolean(empathy?.saved?.data))
    }).finally(() => setLoadingSaved(false))
  }, [segment, clearEdits])

  const saveData = useCallback(
    async (payload: InsightsData) => {
      setSaving(true)
      try {
        const r = await fetch('/api/insights-survey-saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segment, data: payload }),
        })
        const d = await r.json()
        if (d.savedAt) setSavedAt(d.savedAt)
      } catch {}
      setSaving(false)
    },
    [segment]
  )

  const persist = useCallback(
    async (next: InsightsData) => {
      const cleaned = sanitizeInsightsPayload(next)
      setData(cleaned)
      await saveData(cleaned)
    },
    [saveData]
  )

  const generate = async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/insights-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenError(typeof d.error === 'string' ? d.error : 'No se pudieron generar los insights.')
        return
      }
      const payload = sanitizeInsightsPayload({
        resumen: typeof d.resumen === 'string' ? d.resumen : '',
        bloques: Array.isArray(d.bloques) ? d.bloques : [],
      })
      clearEdits()
      setData(payload)
      await saveData(payload)
    } catch {
      setGenError('No se pudieron generar los insights. Inténtalo de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  const bannerBorder = meta.accent === 'amber' ? 'border-amber-100 bg-amber-50' : 'border-orange-100 bg-orange-50'
  const bannerTitle = meta.accent === 'amber' ? 'text-amber-800' : 'text-orange-800'
  const bannerMuted = meta.accent === 'amber' ? 'text-amber-600' : 'text-orange-600'

  const accentBtn =
    meta.accent === 'amber'
      ? 'bg-amber-600 text-white hover:bg-amber-700 border-amber-600'
      : 'bg-orange-600 text-white hover:bg-orange-700 border-orange-600'
  const accentRing = meta.accent === 'amber' ? 'focus:ring-amber-200' : 'focus:ring-orange-200'
  const iconBtn =
    'rounded-lg p-1.5 text-gray-500 ring-1 ring-transparent hover:bg-white hover:text-gray-800 hover:ring-gray-200/80 focus:outline-none focus:ring-2 ' +
    accentRing

  const itemsFromMultiline = (raw: string): string[] =>
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

  if (loadingSaved) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  if (generating) {
    return (
      <div className="space-y-5 py-4">
        <div className="text-center space-y-2 py-4">
          <div
            className={`inline-block h-6 w-6 border-2 border-t-transparent rounded-full animate-spin ${
              meta.accent === 'amber' ? 'border-amber-500' : 'border-orange-500'
            }`}
          />
          <p className="text-sm text-gray-500">Leyendo el mapa de empatía y extrayendo insights…</p>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    )
  }

  if (genError) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-red-600">{genError}</p>
        <button
          onClick={generate}
          className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors self-start sm:self-auto"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!data) {
    if (!hasEmpathyMap) {
      return (
        <div className="space-y-5">
          {!embedTabs && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={meta.otherHref} className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
                {meta.otherLabel}
              </Link>
            </div>
          )}
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-14 text-center space-y-4">
            <div className="text-4xl">🗺️</div>
            <p className="font-semibold text-gray-800">Necesitas un mapa de empatía guardado</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Los insights se generan a partir del mapa de empatía de este segmento (ya filtrado allí). Crea el mapa,
              aplica los filtros que quieras en esa página y guarda antes de volver aquí.
            </p>
            <Link
              href={meta.empathyHref}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-medium shadow-sm transition-colors ${
                meta.accent === 'amber' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              Ir al mapa de empatía
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-5">
        {!embedTabs && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={meta.otherHref} className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
              {meta.otherLabel}
            </Link>
          </div>
        )}
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-14 text-center space-y-4">
          <div className="text-4xl">💡</div>
          <p className="font-semibold text-gray-800">Generar insights</p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            La IA leerá tu mapa de empatía guardado para este segmento y sintetizará patrones y hallazgos accionables
            para el equipo.
          </p>
          <button
            onClick={generate}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-medium shadow-sm transition-colors ${
              meta.accent === 'amber' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            ✦ Generar insights
          </button>
        </div>

        <div className="border-t border-gray-200 pt-6 mt-2">
          <Link
            href={meta.userPersonaHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-violet-800 underline underline-offset-4 hover:text-violet-950"
          >
            Ir a User Persona
            <span aria-hidden>→</span>
          </Link>
          <p className="text-xs text-gray-500 mt-1.5">
            Siguiente paso del panel: perfiles cliente actual y potencial a partir de los insights guardados.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {!embedTabs && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={meta.otherHref} className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
            {meta.otherLabel}
          </Link>
        </div>
      )}

      <div className={`rounded-xl border px-4 py-3 space-y-2 ${bannerBorder}`}>
        <p className={`text-xs font-semibold ${bannerTitle}`}>Fuente de datos</p>
        <p className={`text-xs ${bannerMuted}`}>
          Generados a partir del{' '}
          <Link href={meta.empathyHref} className="font-semibold underline underline-offset-2">
            mapa de empatía guardado
          </Link>{' '}
          (el mapa respeta los filtros definidos en la encuesta de ese segmento). Para otro corte, ajusta filtros en la
          encuesta, regenera y guarda el mapa, y pulsa{' '}
          <button type="button" onClick={generate} className="font-semibold underline underline-offset-2">
            ↺ Regenerar
          </button>{' '}
          aquí.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span className="text-xs text-gray-400 flex items-center gap-1.5 order-2 sm:order-1">
          {saving ? (
            <>
              <span
                className={`inline-block h-3 w-3 border border-gray-300 rounded-full animate-spin ${
                  meta.accent === 'amber' ? 'border-t-amber-400' : 'border-t-orange-400'
                }`}
              />
              Guardando…
            </>
          ) : savedAt ? (
            <>
              <span className="text-green-500">✓</span>
              Guardado el {savedAt}
            </>
          ) : null}
        </span>
        <div className="flex flex-wrap items-center gap-2 order-1 sm:order-2 sm:justify-end">
          <button
            type="button"
            onClick={() => {
              if (addingBlock) {
                setAddingBlock(false)
                setNewTituloDraft('')
                setNewItemsDraft('')
              } else {
                setEditingResumen(false)
                setResumenDraft('')
                setEditingBlockIndex(null)
                setBlockTituloDraft('')
                setBlockItemsDraft('')
                setAddingBlock(true)
                setNewTituloDraft('')
                setNewItemsDraft('')
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
              addingBlock
                ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                : `${accentBtn} shadow-none`
            }`}
          >
            <InsightsPlusIcon className="h-3.5 w-3.5" />
            {addingBlock ? 'Cancelar nuevo bloque' : 'Añadir bloque de insights'}
          </button>
          <button
            type="button"
            onClick={generate}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            ↺ Regenerar
          </button>
        </div>
      </div>

      {addingBlock && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 space-y-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Nuevo bloque</p>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-gray-500">Título del tema</span>
            <input
              type="text"
              value={newTituloDraft}
              onChange={(e) => setNewTituloDraft(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              placeholder="Ej. Percepción del costo"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-gray-500">Hallazgos (una línea por ítem)</span>
            <AutoTextarea
              value={newItemsDraft}
              onChange={(e) => setNewItemsDraft(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              placeholder={'Primera idea…\nSegunda idea…'}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                const titulo = newTituloDraft.trim() || 'Sin título'
                const items = itemsFromMultiline(newItemsDraft)
                if (items.length === 0) return
                await persist({ ...data, bloques: [...data.bloques, { titulo, items }] })
                setAddingBlock(false)
                setNewTituloDraft('')
                setNewItemsDraft('')
              }}
              disabled={!newItemsDraft.trim()}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:pointer-events-none disabled:opacity-40 ${accentBtn}`}
            >
              Guardar bloque
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingBlock(false)
                setNewTituloDraft('')
                setNewItemsDraft('')
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div
        className={`rounded-2xl border p-5 space-y-3 ${
          meta.accent === 'amber' ? 'border-amber-100 bg-amber-50/50' : 'border-orange-100 bg-orange-50/50'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resumen</p>
          {!editingResumen ? (
            <button
              type="button"
              onClick={() => {
                setEditingBlockIndex(null)
                setAddingBlock(false)
                setEditingResumen(true)
                setResumenDraft(data.resumen)
              }}
              className={iconBtn}
              aria-label="Editar resumen"
              title="Editar resumen"
            >
              <InsightsEditIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {editingResumen ? (
          <div className="space-y-2">
            <AutoTextarea
              value={resumenDraft}
              onChange={(e) => setResumenDraft(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              maxLength={4000}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  await persist({ ...data, resumen: resumenDraft.trim() })
                  setEditingResumen(false)
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${accentBtn}`}
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingResumen(false)
                  setResumenDraft('')
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-800 leading-relaxed">{data.resumen}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {data.bloques.map((b, i) => {
          const isEditing = editingBlockIndex === i
          return (
            <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                {!isEditing ? (
                  <p
                    className={`text-xs font-bold uppercase tracking-wide min-w-0 flex-1 ${
                      meta.accent === 'amber' ? 'text-amber-800' : 'text-orange-800'
                    }`}
                  >
                    {b.titulo}
                  </p>
                ) : (
                  <span className="text-xs font-bold uppercase text-gray-400">Editando bloque</span>
                )}
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingResumen(false)
                      setAddingBlock(false)
                      setEditingBlockIndex(i)
                      setBlockTituloDraft(b.titulo)
                      setBlockItemsDraft(b.items.join('\n'))
                    }}
                    className={iconBtn}
                    aria-label={`Editar bloque: ${b.titulo}`}
                    title="Editar bloque"
                  >
                    <InsightsEditIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-gray-500">Título</span>
                    <input
                      type="text"
                      value={blockTituloDraft}
                      onChange={(e) => setBlockTituloDraft(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-gray-500">Hallazgos (una línea por ítem)</span>
                    <AutoTextarea
                      value={blockItemsDraft}
                      onChange={(e) => setBlockItemsDraft(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        const titulo = blockTituloDraft.trim() || 'Sin título'
                        const items = itemsFromMultiline(blockItemsDraft)
                        if (items.length === 0) return
                        const bloques = data.bloques.map((bl, idx) =>
                          idx === i ? { titulo, items } : bl
                        )
                        await persist({ ...data, bloques })
                        setEditingBlockIndex(null)
                        setBlockTituloDraft('')
                        setBlockItemsDraft('')
                      }}
                      disabled={!blockItemsDraft.trim()}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:pointer-events-none disabled:opacity-40 ${accentBtn}`}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBlockIndex(null)
                        setBlockTituloDraft('')
                        setBlockItemsDraft('')
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {b.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                          meta.accent === 'amber' ? 'bg-amber-500' : 'bg-orange-500'
                        }`}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-gray-200 pt-6 pb-1">
        <Link
          href={meta.userPersonaHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-violet-800 underline underline-offset-4 hover:text-violet-950"
        >
          Ir a User Persona
          <span aria-hidden>→</span>
        </Link>
        <p className="text-xs text-gray-500 mt-1.5">
          Siguiente paso del panel: perfiles cliente actual y potencial a partir de los insights guardados.
        </p>
      </div>
    </div>
  )
}
