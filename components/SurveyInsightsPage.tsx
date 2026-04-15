'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

export type InsightsSegment = 'clientes' | 'potenciales'

interface InsightBloque {
  titulo: string
  items: string[]
}

interface InsightsData {
  resumen: string
  bloques: InsightBloque[]
}

/** Quita artefactos que a veces devuelve la IA (cierres `}`, markdown, comillas envolventes). */
function limpiarTextoIA(text: unknown): string {
  if (typeof text !== 'string') return ''
  let s = text.trim()
  if (!s) return ''
  s = s.replace(/^```[\w]*\s*/i, '').replace(/\s*```$/m, '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  s = s.replace(/^\{\s*/, '').trim()
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/\)\s*\}\s*$/g, '').replace(/\}\s*$/g, '').trim()
    if (next === s) break
    s = next
  }
  return s
}

function limpiarInsightsData(raw: InsightsData): InsightsData {
  return {
    resumen: limpiarTextoIA(raw.resumen),
    bloques: (raw.bloques ?? []).map((b) => ({
      titulo: limpiarTextoIA(b.titulo),
      items: (b.items ?? []).map((it) => limpiarTextoIA(it)),
    })),
  }
}

const SEGMENT_META: Record<
  InsightsSegment,
  { otherHref: string; otherLabel: string; accent: 'amber' | 'orange'; empathyHref: string }
> = {
  clientes: {
    otherHref: '/insights?tab=potenciales',
    otherLabel: 'Ver insights de clientes potenciales →',
    accent: 'amber',
    empathyHref: '/empathy/clientes',
  },
  potenciales: {
    otherHref: '/insights',
    otherLabel: '← Ver insights de clientes actuales',
    accent: 'orange',
    empathyHref: '/empathy/potenciales',
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

  useEffect(() => {
    Promise.all([
      fetch(`/api/insights-survey-saved?segment=${segment}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/empathy-map-saved?segment=${segment}`).then((r) => r.json()).catch(() => ({})),
    ]).then(([saved, empathy]) => {
      if (saved?.saved) {
        setData(limpiarInsightsData(saved.saved.data))
        setSavedAt(saved.saved.savedAt)
      }
      setHasEmpathyMap(Boolean(empathy?.saved?.data))
    }).finally(() => setLoadingSaved(false))
  }, [segment])

  const saveData = async (payload: InsightsData) => {
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
  }

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
      const payload = limpiarInsightsData({ resumen: d.resumen, bloques: d.bloques })
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
            para Patri.
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

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
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
        <button
          type="button"
          onClick={generate}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          ↺ Regenerar
        </button>
      </div>

      <div
        className={`rounded-2xl border p-5 space-y-3 ${
          meta.accent === 'amber' ? 'border-amber-100 bg-amber-50/50' : 'border-orange-100 bg-orange-50/50'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resumen</p>
        <p className="text-sm text-gray-800 leading-relaxed">{data.resumen}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {data.bloques.map((b, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p
              className={`text-xs font-bold uppercase tracking-wide mb-2 ${
                meta.accent === 'amber' ? 'text-amber-800' : 'text-orange-800'
              }`}
            >
              {b.titulo}
            </p>
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
          </div>
        ))}
      </div>
    </div>
  )
}
