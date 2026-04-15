'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

// ── Filter types ───────────────────────────────────────────────────────────────

interface ActiveFilters {
  gender: 'all' | 'men' | 'women' | 'nonBinary'
  ageRanges: string[]
  painValues: string[]
}

interface FilterOptions {
  ageRanges: string[]
  painValues: string[]
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

function FiltersPanel({
  filters,
  options,
  onChange,
}: {
  filters: ActiveFilters
  options: FilterOptions
  onChange: (f: ActiveFilters) => void
}) {
  const isFiltered = filters.gender !== 'all' || filters.ageRanges.length > 0 || filters.painValues.length > 0
  const activeCount = (filters.gender !== 'all' ? 1 : 0) + filters.ageRanges.length + filters.painValues.length

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          Filtrar encuestas
          {isFiltered && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-sky-600 text-white text-[10px] font-bold leading-none">
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
                  filters.gender === opt.value
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300 hover:text-sky-600'
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
              {filters.ageRanges.length > 0 && <span className="ml-1 text-sky-600">({filters.ageRanges.length})</span>}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {options.ageRanges.map((r) => (
                <button
                  key={r}
                  onClick={() => onChange({ ...filters, ageRanges: toggleArr(filters.ageRanges, r) })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filters.ageRanges.includes(r)
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300 hover:text-sky-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
        {options.painValues.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400 font-medium">
              Dolor crónico
              {filters.painValues.length > 0 && <span className="ml-1 text-sky-600">({filters.painValues.length})</span>}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {options.painValues.map((v) => (
                <button
                  key={v}
                  onClick={() => onChange({ ...filters, painValues: toggleArr(filters.painValues, v) })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filters.painValues.includes(v)
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300 hover:text-sky-600'
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

// ── POV statement types ────────────────────────────────────────────────────────

interface POVStatement {
  usuario: string
  necesidad: string
  insight: string
}

interface POVPair {
  clienteActual: POVStatement
  clientePotencial: POVStatement
}

function normalizeSavedStatements(raw: unknown): POVPair | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (
    o.clienteActual &&
    o.clientePotencial &&
    typeof o.clienteActual === 'object' &&
    typeof o.clientePotencial === 'object'
  ) {
    return raw as POVPair
  }
  if (Array.isArray(raw) && raw.length >= 2) {
    return { clienteActual: raw[0] as POVStatement, clientePotencial: raw[1] as POVStatement }
  }
  return null
}

// ── POV Bubble ─────────────────────────────────────────────────────────────────

function POVBubble({
  statement,
  sectionLabel,
  tailLeft,
}: {
  statement: POVStatement
  sectionLabel: string
  tailLeft: boolean
}) {
  return (
    <div className="flex flex-col" style={{ alignItems: tailLeft ? 'flex-start' : 'flex-end' }}>
      {/* Bubble */}
      <div
        className="relative rounded-2xl border border-sky-200 px-6 py-5 max-w-2xl w-full"
        style={{ backgroundColor: '#dff1fb' }}
      >
        {/* Section badge */}
        <span
          className="absolute -top-3 left-5 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
          style={{ backgroundColor: '#3b9fd4' }}
        >
          {sectionLabel}
        </span>

        {/* POV text */}
        <p className="text-sm leading-relaxed text-sky-900">
          <span className="text-sky-500 font-normal italic">{statement.usuario}</span>
          {' '}
          <span className="font-bold text-sky-800">necesita</span>
          {' '}
          <span className="text-sky-700">{statement.necesidad}</span>
          {' '}
          <span className="font-bold text-sky-800">porque</span>
          {' '}
          <span className="text-sky-600">{statement.insight}</span>
          <span className="text-sky-400">.</span>
        </p>
      </div>

      {/* Bubble tail (CSS triangle) */}
      <div
        style={{
          width: 0,
          height: 0,
          marginLeft: tailLeft ? 28 : 'auto',
          marginRight: tailLeft ? 'auto' : 28,
          borderLeft: tailLeft ? '10px solid transparent' : '10px solid #dff1fb',
          borderRight: tailLeft ? '10px solid #dff1fb' : '10px solid transparent',
          borderTop: '10px solid #dff1fb',
          filter: 'drop-shadow(0 1px 0 #bae3f5)',
        }}
      />
    </div>
  )
}

// ── Main page component ────────────────────────────────────────────────────────

export function POVPage() {
  const [statements, setStatements] = useState<POVPair | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(true)

  const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ ageRanges: [], painValues: [] })

  useEffect(() => {
    Promise.all([
      fetch('/api/pov-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/survey').then((r) => r.json()).catch(() => ({})),
      fetch('/api/potential-survey').then((r) => r.json()).catch(() => ({})),
    ]).then(([saved, survey, potential]) => {
      if (saved?.saved) {
        const pair = normalizeSavedStatements(saved.saved.statements)
        setStatements(pair)
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
  }, [])

  const saveStatements = async (data: POVPair) => {
    setSaving(true)
    try {
      const r = await fetch('/api/pov-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements: data, filters }),
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
      const res = await fetch('/api/pov', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
      })
      if (!res.ok) throw new Error('Error')
      const d = await res.json()
      const pair: POVPair = { clienteActual: d.clienteActual, clientePotencial: d.clientePotencial }
      setStatements(pair)
      await saveStatements(pair)
    } catch {
      setGenError(true)
    } finally {
      setGenerating(false)
    }
  }

  const isFiltered = filters.gender !== 'all' || filters.ageRanges.length > 0 || filters.painValues.length > 0
  const genderLabel = GENDER_OPTIONS.find((o) => o.value === filters.gender)?.label

  // ── Loading ──

  if (loadingSaved) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    )
  }

  // ── Generating ──

  if (generating) {
    return (
      <div className="space-y-5 py-4">
        <div className="text-center space-y-2 py-4">
          <div className="inline-block h-6 w-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Analizando respuestas y construyendo los POV…</p>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    )
  }

  // ── Error ──

  if (genError) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex items-center justify-between gap-4">
        <p className="text-sm text-red-600">No se pudieron generar los POV. Inténtalo de nuevo.</p>
        <button
          onClick={generate}
          className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // ── Empty state ──

  if (!statements) {
    return (
      <div className="space-y-5">
        <FiltersPanel filters={filters} options={filterOptions} onChange={setFilters} />
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center space-y-4">
          <div className="text-5xl">💬</div>
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">Genera los POV de MOA</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Se generarán <strong>dos</strong> declaraciones Point of View: una a partir solo de{' '}
              <strong>clientes actuales</strong> y otra solo de <strong>clientes potenciales</strong>, con el patrón
              <span className="italic"> [Usuario] necesita [Necesidad] porque [Insight]</span>.
            </p>
          </div>
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors shadow-sm"
          >
            ✦ Generar los 2 POV
          </button>
        </div>
      </div>
    )
  }

  // ── Results ──

  return (
    <div className="space-y-5">
      <FiltersPanel filters={filters} options={filterOptions} onChange={setFilters} />

      {/* Filter context banner */}
      <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 space-y-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-sky-700">
            {isFiltered ? 'POV generados con estos filtros:' : 'POV generados sin filtros activos'}
          </p>
          {isFiltered && (
            <div className="flex flex-wrap gap-1.5">
              {filters.gender !== 'all' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-600 text-white text-xs font-medium">
                  {genderLabel}
                </span>
              )}
              {filters.ageRanges.map((r) => (
                <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-600 text-white text-xs font-medium">
                  {r} años
                </span>
              ))}
              {filters.painValues.map((v) => (
                <span key={v} className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-600 text-white text-xs font-medium">
                  Dolor: {v}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-sky-500">
            Cambia los filtros y pulsa{' '}
            <button
              onClick={generate}
              className="font-semibold underline underline-offset-2 hover:text-sky-700 transition-colors"
            >
              ↺ Regenerar
            </button>{' '}
            para actualizar los POV según el segmento que necesites.
          </p>
        </div>
      </div>

      {/* Header actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          {saving ? (
            <>
              <span className="inline-block h-3 w-3 border border-gray-300 border-t-sky-400 rounded-full animate-spin" />
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
          onClick={generate}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          ↺ Regenerar
        </button>
      </div>

      {/* POV bubbles */}
      <div className="space-y-4">
        <POVBubble
          statement={statements.clienteActual}
          sectionLabel="Clientes actuales"
          tailLeft
        />
        <POVBubble
          statement={statements.clientePotencial}
          sectionLabel="Clientes potenciales"
          tailLeft={false}
        />
      </div>
    </div>
  )
}
