'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

export type InsightsSegment = 'clientes' | 'potenciales'

interface ActiveFilters {
  gender: 'all' | 'men' | 'women' | 'nonBinary'
  ageRanges: string[]
  painValues: string[]
}

interface FilterOptions {
  ageRanges: string[]
  painValues: string[]
}

interface InsightBloque {
  titulo: string
  items: string[]
}

interface InsightsData {
  resumen: string
  bloques: InsightBloque[]
}

const DEFAULT_FILTERS: ActiveFilters = { gender: 'all', ageRanges: [], painValues: [] }

const GENDER_OPTIONS: { value: ActiveFilters['gender']; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'women', label: 'Mujeres' },
  { value: 'men', label: 'Hombres' },
  { value: 'nonBinary', label: 'No binario' },
]

function toggleArr(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
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

function FiltersPanel({
  filters,
  options,
  onChange,
  showPain,
  accent,
}: {
  filters: ActiveFilters
  options: FilterOptions
  onChange: (f: ActiveFilters) => void
  showPain: boolean
  accent: 'amber' | 'orange'
}) {
  const activeBtn =
    accent === 'amber'
      ? 'bg-amber-600 text-white border-amber-600'
      : 'bg-orange-600 text-white border-orange-600'
  const hoverBtn =
    accent === 'amber'
      ? 'hover:border-amber-300 hover:text-amber-700'
      : 'hover:border-orange-300 hover:text-orange-700'
  const countColor = accent === 'amber' ? 'text-amber-600' : 'text-orange-600'
  const badgeBg = accent === 'amber' ? 'bg-amber-600' : 'bg-orange-600'

  const isFiltered =
    filters.gender !== 'all' ||
    filters.ageRanges.length > 0 ||
    (showPain && filters.painValues.length > 0)
  const activeCount =
    (filters.gender !== 'all' ? 1 : 0) + filters.ageRanges.length + (showPain ? filters.painValues.length : 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          Filtrar encuestas
          {isFiltered && (
            <span
              className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-white text-[10px] font-bold leading-none ${badgeBg}`}
            >
              {activeCount}
            </span>
          )}
        </p>
        {isFiltered && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400 font-medium">Género</p>
          <div className="flex gap-1.5 flex-wrap">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ ...filters, gender: opt.value })}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filters.gender === opt.value ? activeBtn : `bg-white text-gray-600 border-gray-200 ${hoverBtn}`
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {options.ageRanges.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400 font-medium">
              Franja de edad
              {filters.ageRanges.length > 0 && <span className={`ml-1 ${countColor}`}>({filters.ageRanges.length})</span>}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {options.ageRanges.map((r) => (
                <button
                  key={r}
                  onClick={() => onChange({ ...filters, ageRanges: toggleArr(filters.ageRanges, r) })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filters.ageRanges.includes(r) ? activeBtn : `bg-white text-gray-600 border-gray-200 ${hoverBtn}`
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
        {showPain && options.painValues.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400 font-medium">
              Dolor crónico
              {filters.painValues.length > 0 && <span className={`ml-1 ${countColor}`}>({filters.painValues.length})</span>}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {options.painValues.map((v) => (
                <button
                  key={v}
                  onClick={() => onChange({ ...filters, painValues: toggleArr(filters.painValues, v) })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filters.painValues.includes(v) ? activeBtn : `bg-white text-gray-600 border-gray-200 ${hoverBtn}`
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SEGMENT_META: Record<
  InsightsSegment,
  { title: string; subtitle: string; otherHref: string; otherLabel: string; accent: 'amber' | 'orange' }
> = {
  clientes: {
    title: 'Insights · Clientes',
    subtitle: 'Hallazgos a partir de la encuesta de clientes actuales de MOA.',
    otherHref: '/insights?tab=potenciales',
    otherLabel: 'Ver insights de clientes potenciales →',
    accent: 'amber',
  },
  potenciales: {
    title: 'Insights · Clientes potenciales',
    subtitle: 'Hallazgos a partir de la encuesta a público objetivo aún no cliente.',
    otherHref: '/insights',
    otherLabel: '← Ver insights de clientes actuales',
    accent: 'orange',
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
  const [genError, setGenError] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(true)

  const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ ageRanges: [], painValues: [] })

  useEffect(() => {
    Promise.all([
      fetch(`/api/insights-survey-saved?segment=${segment}`).then((r) => r.json()).catch(() => ({})),
      fetch('/api/survey').then((r) => r.json()).catch(() => ({})),
      fetch('/api/potential-survey').then((r) => r.json()).catch(() => ({})),
    ]).then(([saved, survey, potential]) => {
      if (saved?.saved) {
        setData(limpiarInsightsData(saved.saved.data))
        setSavedAt(saved.saved.savedAt)
        if (saved.saved.filters) {
          setFilters({ ...DEFAULT_FILTERS, ...saved.saved.filters })
        }
      }
      const ageSet = new Set<string>([
        ...(survey?.filterOptions?.ageRanges ?? []),
        ...(potential?.filterOptions?.ageRanges ?? []),
      ])
      setFilterOptions({
        ageRanges: Array.from(ageSet).sort(),
        painValues: potential?.filterOptions?.painValues ?? [],
      })
    }).finally(() => setLoadingSaved(false))
  }, [segment])

  const saveData = async (payload: InsightsData) => {
    setSaving(true)
    try {
      const r = await fetch('/api/insights-survey-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, data: payload, filters }),
      })
      const d = await r.json()
      if (d.savedAt) setSavedAt(d.savedAt)
    } catch {}
    setSaving(false)
  }

  const generate = async () => {
    setGenerating(true)
    setGenError(false)
    try {
      const res = await fetch('/api/insights-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, filters }),
      })
      if (!res.ok) throw new Error('Error')
      const d = await res.json()
      const payload = limpiarInsightsData({ resumen: d.resumen, bloques: d.bloques })
      setData(payload)
      await saveData(payload)
    } catch {
      setGenError(true)
    } finally {
      setGenerating(false)
    }
  }

  const isFiltered =
    filters.gender !== 'all' || filters.ageRanges.length > 0 || (segment === 'potenciales' && filters.painValues.length > 0)
  const genderLabel = GENDER_OPTIONS.find((o) => o.value === filters.gender)?.label
  const showPain = segment === 'potenciales'

  const bannerBorder = meta.accent === 'amber' ? 'border-amber-100 bg-amber-50' : 'border-orange-100 bg-orange-50'
  const bannerTitle = meta.accent === 'amber' ? 'text-amber-800' : 'text-orange-800'
  const bannerMuted = meta.accent === 'amber' ? 'text-amber-600' : 'text-orange-600'
  const chipBg = meta.accent === 'amber' ? 'bg-amber-600' : 'bg-orange-600'

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
          <p className="text-sm text-gray-500">Analizando respuestas y extrayendo insights…</p>
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
      <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex items-center justify-between gap-4">
        <p className="text-sm text-red-600">No se pudieron generar los insights. Inténtalo de nuevo.</p>
        <button
          onClick={generate}
          className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-5">
        {!embedTabs && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={meta.otherHref} className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
              {meta.otherLabel}
            </Link>
          </div>
        )}
        <FiltersPanel
          filters={filters}
          options={filterOptions}
          onChange={setFilters}
          showPain={showPain}
          accent={meta.accent}
        />
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-14 text-center space-y-4">
          <div className="text-4xl">💡</div>
          <p className="font-semibold text-gray-800">Generar insights</p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Aplica filtros si quieres afinar el segmento y pulsa el botón. La IA sintetizará patrones y hallazgos
            accionables para Patri.
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

      <FiltersPanel
        filters={filters}
        options={filterOptions}
        onChange={setFilters}
        showPain={showPain}
        accent={meta.accent}
      />

      <div className={`rounded-xl border px-4 py-3 space-y-2 ${bannerBorder}`}>
        <p className={`text-xs font-semibold ${bannerTitle}`}>
          {isFiltered ? 'Generado con estos filtros:' : 'Generado sin filtros activos'}
        </p>
        {isFiltered && (
          <div className="flex flex-wrap gap-1.5">
            {filters.gender !== 'all' && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-white text-xs font-medium ${chipBg}`}>
                {genderLabel}
              </span>
            )}
            {filters.ageRanges.map((r) => (
              <span key={r} className={`inline-flex items-center px-2 py-0.5 rounded-full text-white text-xs font-medium ${chipBg}`}>
                {r} años
              </span>
            ))}
            {showPain &&
              filters.painValues.map((v) => (
                <span key={v} className={`inline-flex items-center px-2 py-0.5 rounded-full text-white text-xs font-medium ${chipBg}`}>
                  Dolor: {v}
                </span>
              ))}
          </div>
        )}
        <p className={`text-xs ${bannerMuted}`}>
          Cambia los filtros y pulsa{' '}
          <button type="button" onClick={generate} className="font-semibold underline underline-offset-2">
            ↺ Regenerar
          </button>
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
