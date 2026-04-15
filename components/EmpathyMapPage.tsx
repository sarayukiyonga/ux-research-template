'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

interface EmpathyMapData {
  piensaSiente: string[]
  ve: string[]
  oye: string[]
  dice: string[]
  hace: string[]
  dolorFrustraciones: string[]
  necesidadesDeseos: string[]
}

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

// ── FiltersPanel ───────────────────────────────────────────────────────────────

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
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
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
                    ? 'bg-rose-500 text-white border-rose-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300 hover:text-rose-600'
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
              {filters.ageRanges.length > 0 && (
                <span className="ml-1 text-rose-500">({filters.ageRanges.length})</span>
              )}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {options.ageRanges.map((r) => (
                <button
                  key={r}
                  onClick={() => onChange({ ...filters, ageRanges: toggleArr(filters.ageRanges, r) })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filters.ageRanges.includes(r)
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300 hover:text-rose-600'
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
              {filters.painValues.length > 0 && (
                <span className="ml-1 text-rose-500">({filters.painValues.length})</span>
              )}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {options.painValues.map((v) => (
                <button
                  key={v}
                  onClick={() => onChange({ ...filters, painValues: toggleArr(filters.painValues, v) })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filters.painValues.includes(v)
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300 hover:text-rose-600'
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

// ── Sticky note ────────────────────────────────────────────────────────────────

// Note dimensions
const NOTE = 62   // compact square size (px)
const GUTTER = 4  // gap between notes (px)
const GW = NOTE * 2 + GUTTER  // group width for 2-column layout = 128px

function StickyNote({ text, bg, expandDir = 'right' }: { text: string; bg: string; expandDir?: 'right' | 'left' }) {
  const [pinned, setPinned] = useState(false)

  const expandStyle = expandDir === 'left'
    ? { top: 0, right: 0 }   // expands leftward
    : { top: 0, left: 0 }    // expands rightward (default)

  return (
    <div
      className="group relative cursor-pointer"
      style={{ width: NOTE, height: NOTE, flexShrink: 0, zIndex: pinned ? 100 : undefined }}
      onClick={(e) => { e.stopPropagation(); setPinned((p) => !p) }}
    >
      {/* Compact square with small text preview */}
      <div
        className="absolute inset-0 rounded-[3px] shadow-sm overflow-hidden"
        style={{ backgroundColor: bg, padding: 5 }}
      >
        <p className="text-[7.5px] leading-[1.3] text-gray-700 wrap-break-word select-none">
          {text}
        </p>
      </div>

      {/* Expanded card — hover on desktop, pinned on mobile */}
      <div
        className={`absolute rounded-[4px] shadow-xl z-50 p-2.5 text-[12px] leading-normal text-gray-800 select-none
          ${pinned ? 'block' : 'hidden group-hover:block'}`}
        style={{
          ...expandStyle,
          backgroundColor: bg,
          minWidth: 180,
          maxWidth: 240,
          minHeight: NOTE,
          border: '1.5px solid rgba(255,255,255,0.7)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
        }}
      >
        {text}
        {pinned && (
          <span className="block mt-2 text-[9px] text-gray-500 opacity-60">
            Toca para cerrar
          </span>
        )}
      </div>
    </div>
  )
}

// Group of notes with configurable columns
function NoteGroup({ notes, bg, expandDir, cols = 2 }: { notes: string[]; bg: string; expandDir?: 'right' | 'left'; cols?: number }) {
  const width = cols * NOTE + (cols - 1) * GUTTER
  return (
    <div className="flex flex-wrap" style={{ width, gap: GUTTER }}>
      {notes.map((note, i) => (
        <StickyNote key={i} text={note} bg={bg} expandDir={expandDir} />
      ))}
    </div>
  )
}

// Hace layout: mirror of Dice but left-aligned
function HaceNoteGroup({ notes, bg }: { notes: string[]; bg: string }) {
  const [first, ...rest] = notes
  const rows: string[][] = []
  for (let i = 0; i < rest.length; i += 2) {
    rows.push(rest.slice(i, i + 2))
  }
  return (
    <div className="flex flex-col items-start" style={{ gap: GUTTER }}>
      <StickyNote text={first} bg={bg} />
      {rows.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: GUTTER }}>
          {row.map((note, i) => (
            <StickyNote key={i} text={note} bg={bg} />
          ))}
        </div>
      ))}
    </div>
  )
}

// Dice layout: 1ª nota sola arriba-derecha, resto en filas de 2, todo right-aligned
function DiceNoteGroup({ notes, bg }: { notes: string[]; bg: string }) {
  const [first, ...rest] = notes
  // Split remaining notes into rows of 2
  const rows: string[][] = []
  for (let i = 0; i < rest.length; i += 2) {
    rows.push(rest.slice(i, i + 2))
  }
  return (
    <div className="flex flex-col items-end" style={{ gap: GUTTER }}>
      {/* First note alone, right-aligned */}
      <StickyNote text={first} bg={bg} />
      {/* Remaining notes in rows of 2 */}
      {rows.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: GUTTER }}>
          {row.map((note, i) => (
            <StickyNote key={i} text={note} bg={bg} />
          ))}
        </div>
      ))}
    </div>
  )
}

// Section label
function SectionLabel({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <p className={`text-[10px] font-semibold text-gray-400 tracking-widest uppercase w-full
      ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </p>
  )
}

// ── Section colors ─────────────────────────────────────────────────────────────

const COLORS = {
  piensaSiente: '#D4B8E8',
  ve: '#F9DF7A',
  oye: '#F5BAD8',
  dice: '#5DD9C4',
  hace: '#B3E8F8',
  dolor: '#F5B8A8',
  necesidades: '#A8D9B5',
}

// ── Visual empathy map ─────────────────────────────────────────────────────────

// Square canvas constants. GW=128, so 2 rows of notes = 128px tall.
// Section height = 128(notes) + 4(gap) + 14(label) = 146px
const SQ = 600    // top square size (px)
const cx = SQ / 2 // 300 — center X
const cy = 286    // center Y (slightly above midpoint for visual balance)

// Absolute positions for each note group within the square
const POS = {
  piensa: { top: 16,      left: cx - GW / 2 },   // centered top
  ve:     { top: 180,     left: 10 },              // left side
  oye:    { top: 180,     left: SQ - 10 - GW },   // right side
  dice:   { bottom: 12, left: cx - GW - 10 },  // bottom-aligned, right edge near cx
  hace:   { bottom: 12, left: cx + 10 },            // bottom-aligned, left edge near cx
}

function EmpathyMapVisual({ data }: { data: EmpathyMapData }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="border border-gray-200 rounded-2xl overflow-hidden bg-white"
        style={{ width: SQ }}
      >
        {/* ── TOP SQUARE: 5 sections + avatar ── */}
        <div className="relative bg-white" style={{ width: SQ, height: SQ }}>

          {/* SVG structural lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={SQ} height={SQ}
            viewBox={`0 0 ${SQ} ${SQ}`}
          >
            {/* Vertical: solo desde el centro hacia abajo */}
            <line x1={cx} y1={cy} x2={cx} y2={SQ} stroke="#e5e7eb" strokeWidth="1" />
            {/* Diagonales desde cada esquina hasta el centro */}
            <line x1={0}   y1={0}  x2={cx} y2={cy} stroke="#e5e7eb" strokeWidth="1" />
            <line x1={SQ}  y1={0}  x2={cx} y2={cy} stroke="#e5e7eb" strokeWidth="1" />
            <line x1={0}   y1={SQ} x2={cx} y2={cy} stroke="#e5e7eb" strokeWidth="1" />
            <line x1={SQ}  y1={SQ} x2={cx} y2={cy} stroke="#e5e7eb" strokeWidth="1" />
          </svg>

          {/* Center avatar */}
          <div
            className="absolute flex items-center justify-center rounded-full bg-gray-50 border-2 border-white shadow-md text-2xl"
            style={{ width: 58, height: 58, left: cx - 29, top: cy - 29, zIndex: 10 }}
          >
            🧍‍♀️
          </div>

          {/* PIENSA Y SIENTE — top center */}
          <div className="absolute flex flex-col items-center gap-1" style={POS.piensa}>
            <SectionLabel align="center">Piensa y siente</SectionLabel>
            <NoteGroup notes={data.piensaSiente} bg={COLORS.piensaSiente} />
          </div>

          {/* VE — left */}
          <div className="absolute flex flex-col gap-1" style={POS.ve}>
            <NoteGroup notes={data.ve} bg={COLORS.ve} />
            <SectionLabel>Ve</SectionLabel>
          </div>

          {/* OYE — right */}
          <div className="absolute flex flex-col gap-1" style={POS.oye}>
            <NoteGroup notes={data.oye} bg={COLORS.oye} expandDir="left" />
            <SectionLabel align="right">Oye</SectionLabel>
          </div>

          {/* DICE — 1 nota top-right + resto abajo, alineado a la derecha del cuadrante izq. */}
          <div className="absolute flex flex-col gap-1" style={POS.dice}>
            <DiceNoteGroup notes={data.dice} bg={COLORS.dice} />
            <SectionLabel>Dice</SectionLabel>
          </div>

          {/* HACE — 1 nota top-left + resto abajo, alineado a la izquierda del cuadrante der. */}
          <div className="absolute flex flex-col gap-1" style={POS.hace}>
            <HaceNoteGroup notes={data.hace} bg={COLORS.hace} />
            <SectionLabel>Hace</SectionLabel>
          </div>
        </div>

        {/* ── BOTTOM STRIP: Dolor + Necesidades ── */}
        <div className="flex border-t border-gray-200">
          {/* Dolor / Frustraciones — left */}
          <div className="flex-1 flex flex-col gap-2 p-4 border-r border-gray-200">
            <SectionLabel>Dolor / Frustraciones</SectionLabel>
            <NoteGroup notes={data.dolorFrustraciones} bg={COLORS.dolor} cols={4} />
          </div>

          {/* Necesidades / Deseos — right */}
          <div className="flex-1 flex flex-col gap-2 p-4">
            <SectionLabel>Necesidades / Deseos</SectionLabel>
            <NoteGroup notes={data.necesidadesDeseos} bg={COLORS.necesidades} cols={4} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Detail list (accessible fallback + extra detail) ──────────────────────────

const SECTIONS: { key: keyof EmpathyMapData; label: string; color: string; bg: string }[] = [
  { key: 'piensaSiente', label: 'Piensa y siente', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
  { key: 've', label: 'Ve', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100' },
  { key: 'oye', label: 'Oye', color: 'text-pink-700', bg: 'bg-pink-50 border-pink-100' },
  { key: 'dice', label: 'Dice', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-100' },
  { key: 'hace', label: 'Hace', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-100' },
  { key: 'dolorFrustraciones', label: 'Dolor / Frustraciones', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-100' },
  { key: 'necesidadesDeseos', label: 'Necesidades / Deseos', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
]

function EmpathyDetailList({ data }: { data: EmpathyMapData }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {SECTIONS.map(({ key, label, color, bg }) => (
        <div key={key} className={`rounded-xl border p-4 space-y-2 ${bg}`}>
          <p className={`text-xs font-bold uppercase tracking-wide ${color}`}>{label}</p>
          <ul className="space-y-1">
            {data[key].map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-current opacity-50" />
                {note}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ── Main page component ────────────────────────────────────────────────────────

export function EmpathyMapPage() {
  const [data, setData] = useState<EmpathyMapData | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(true)

  const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ ageRanges: [], painValues: [] })

  useEffect(() => {
    Promise.all([
      fetch('/api/empathy-map-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/survey').then((r) => r.json()).catch(() => ({})),
      fetch('/api/potential-survey').then((r) => r.json()).catch(() => ({})),
    ]).then(([saved, survey, potential]) => {
      if (saved?.saved) {
        setData(saved.saved.data)
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

  const saveMap = async (mapData: EmpathyMapData) => {
    setSaving(true)
    try {
      const r = await fetch('/api/empathy-map-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: mapData, filters }),
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
      const res = await fetch('/api/empathy-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
      })
      if (!res.ok) throw new Error('Error')
      const d: EmpathyMapData = await res.json()
      setData(d)
      await saveMap(d)
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
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
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
          <div className="inline-block h-6 w-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Analizando encuestas y construyendo el mapa…</p>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  // ── Error ──

  if (genError) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex items-center justify-between gap-4">
          <p className="text-sm text-red-600">No se pudo generar el mapa. Inténtalo de nuevo.</p>
          <button
            onClick={generate}
            className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ── Empty state ──

  if (!data) {
    return (
      <div className="space-y-5">
        <FiltersPanel filters={filters} options={filterOptions} onChange={setFilters} />
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center space-y-4">
          <div className="text-5xl">🗺️</div>
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">Genera tu primer mapa de empatía</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              La IA analizará las respuestas de clientes actuales y potenciales para construir el mapa.
              Puedes aplicar filtros antes de generar.
            </p>
          </div>
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 transition-colors shadow-sm"
          >
            ✦ Generar mapa de empatía
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
      <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 space-y-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-rose-700">
            {isFiltered ? 'Mapa generado con estos filtros:' : 'Mapa generado sin filtros activos'}
          </p>
          {isFiltered && (
            <div className="flex flex-wrap gap-1.5">
              {filters.gender !== 'all' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-medium">
                  {genderLabel}
                </span>
              )}
              {filters.ageRanges.map((r) => (
                <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-medium">
                  {r} años
                </span>
              ))}
              {filters.painValues.map((v) => (
                <span key={v} className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-medium">
                  Dolor: {v}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-rose-500">
            Cambia los filtros y pulsa{' '}
            <button
              onClick={generate}
              className="font-semibold underline underline-offset-2 hover:text-rose-700 transition-colors"
            >
              ↺ Regenerar
            </button>{' '}
            para actualizar el mapa según el perfil que necesites.
          </p>
        </div>
      </div>

      {/* Saved / actions header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          {saving ? (
            <>
              <span className="inline-block h-3 w-3 border border-gray-300 border-t-rose-400 rounded-full animate-spin" />
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

      {/* Visual map */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Mapa de empatía</p>
        <EmpathyMapVisual data={data} />
      </div>

      {/* Detail list */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Detalle completo
        </p>
        <EmpathyDetailList data={data} />
      </div>
    </div>
  )
}
