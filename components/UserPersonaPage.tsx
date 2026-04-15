'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

// ── Filter types & helpers ─────────────────────────────────────────────────────

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
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-violet-600 text-white text-[10px] font-bold leading-none">
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
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
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
                <span className="ml-1 text-violet-600">({filters.ageRanges.length})</span>
              )}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {options.ageRanges.map((r) => (
                <button
                  key={r}
                  onClick={() => onChange({ ...filters, ageRanges: toggleArr(filters.ageRanges, r) })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filters.ageRanges.includes(r)
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
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
                <span className="ml-1 text-violet-600">({filters.painValues.length})</span>
              )}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {options.painValues.map((v) => (
                <button
                  key={v}
                  onClick={() => onChange({ ...filters, painValues: toggleArr(filters.painValues, v) })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filters.painValues.includes(v)
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
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

// ── Types ──────────────────────────────────────────────────────────────────────

interface Personalidad {
  introvertidoExtrovertido: number
  pensamientoSentimiento: number
  organizadoEspontaneo: number
  seguroInseguro: number
  intuitivoObservador: number
}

interface HabilidadesTecnicas {
  internet: number
  redesSociales: number
  comprasOnline: number
}

interface Persona {
  nombre: string
  genero: 'mujer' | 'hombre' | 'no_binario'
  edad: number
  educacion: string
  ubicacion: string
  estadoCivil: string
  ocupacion: string
  tags: string[]
  frase: string
  motivaciones: string[]
  necesidades: string[]
  puntosDeDolor: string[]
  personalidad: Personalidad
  habilidadesTecnicas: HabilidadesTecnicas
}

interface UserPersonas {
  clienteActual: Persona
  clientePotencial: Persona
}

// ── Trait bar component ─────────────────────────────────────────────────────────

function TraitBar({
  label,
  leftLabel,
  rightLabel,
  value,
  color,
}: {
  label?: string
  leftLabel: string
  rightLabel: string
  value: number  // 1–5
  color: string
}) {
  const pct = ((value - 1) / 4) * 100
  return (
    <div className="space-y-0.5">
      {label && <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-16 text-right shrink-0">{leftLabel}</span>
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 relative">
          <div
            className="absolute top-0 h-1.5 rounded-full transition-all"
            style={{ left: `${pct}%`, width: 8, height: 8, marginTop: -3, marginLeft: -4, backgroundColor: color }}
          />
          <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(to right, ${color}22, ${color}44)` }} />
        </div>
        <span className="text-[10px] text-gray-500 w-16 shrink-0">{rightLabel}</span>
      </div>
    </div>
  )
}

// ── Tech skill dots ─────────────────────────────────────────────────────────────

function SkillDots({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-600 truncate">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-full border"
            style={{
              backgroundColor: i < value ? color : 'transparent',
              borderColor: i < value ? color : '#d1d5db',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Persona card ───────────────────────────────────────────────────────────────

const AVATAR_EMOJIS: Record<string, string> = {
  mujer: '👩',
  hombre: '👨',
  no_binario: '🧑',
}

function PersonaCard({ persona, type }: { persona: Persona; type: 'clienteActual' | 'clientePotencial' }) {
  const isClient = type === 'clienteActual'
  const accent = isClient ? '#7c3aed' : '#ea580c'
  const accentLight = isClient ? '#ede9fe' : '#ffedd5'
  const accentText = isClient ? 'text-violet-700' : 'text-orange-600'
  const accentBg = isClient ? 'bg-violet-50' : 'bg-orange-50'
  const accentBorder = isClient ? 'border-violet-200' : 'border-orange-200'
  const label = isClient ? 'Cliente actual' : 'Cliente potencial'

  return (
    <div className={`rounded-2xl border-2 ${accentBorder} bg-white overflow-hidden`}>
      {/* Header strip */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: accentLight }}>
        <span className={`text-xs font-semibold uppercase tracking-wider ${accentText}`}>{label}</span>
        <span className="text-xs text-gray-400">{persona.edad} años · {persona.ubicacion}</span>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-5">

        {/* ── LEFT COLUMN: identity ── */}
        <div className="flex flex-col gap-4">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-4xl border-4 border-white shadow-md"
              style={{ backgroundColor: accentLight }}
            >
              {AVATAR_EMOJIS[persona.genero] ?? '🧑'}
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{persona.nombre}</p>
              <p className="text-xs text-gray-500 mt-0.5 italic leading-snug max-w-[180px]">
                &ldquo;{persona.frase}&rdquo;
              </p>
            </div>
          </div>

          {/* Personal data */}
          <div className="rounded-xl bg-gray-50 p-3 space-y-1.5 text-xs">
            <DataRow icon="🎂" label="Edad" value={`${persona.edad} años`} />
            <DataRow icon="🎓" label="Estudios" value={persona.educacion} />
            <DataRow icon="📍" label="Ubicación" value={persona.ubicacion} />
            <DataRow icon="💍" label="Estado civil" value={persona.estadoCivil} />
            <DataRow icon="💼" label="Ocupación" value={persona.ocupacion} />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {persona.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                style={{ backgroundColor: accentLight, color: accent, borderColor: `${accent}33` }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* ── RIGHT COLUMN: insights ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Motivaciones */}
          <InsightBlock
            title="Motivaciones"
            items={persona.motivaciones}
            dotColor={accent}
            icon="⚡"
          />

          {/* Necesidades */}
          <InsightBlock
            title="Necesidades"
            items={persona.necesidades}
            dotColor={accent}
            icon="🎯"
          />

          {/* Puntos de dolor */}
          <InsightBlock
            title="Puntos de dolor"
            items={persona.puntosDeDolor}
            dotColor="#ef4444"
            icon="😣"
          />

          {/* Personalidad + Habilidades */}
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 p-3 space-y-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                🧠 Personalidad
              </p>
              <TraitBar leftLabel="Introvertido" rightLabel="Extrovertido" value={persona.personalidad.introvertidoExtrovertido} color={accent} />
              <TraitBar leftLabel="Analítico" rightLabel="Emocional" value={persona.personalidad.pensamientoSentimiento} color={accent} />
              <TraitBar leftLabel="Organizado" rightLabel="Espontáneo" value={persona.personalidad.organizadoEspontaneo} color={accent} />
              <TraitBar leftLabel="Seguro" rightLabel="Ansioso" value={persona.personalidad.seguroInseguro} color={accent} />
              <TraitBar leftLabel="Intuitivo" rightLabel="Observador" value={persona.personalidad.intuitivoObservador} color={accent} />
            </div>

            <div className="rounded-xl border border-gray-100 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                💻 Habilidades técnicas
              </p>
              <SkillDots label="Internet" value={persona.habilidadesTecnicas.internet} color={accent} />
              <SkillDots label="Redes sociales" value={persona.habilidadesTecnicas.redesSociales} color={accent} />
              <SkillDots label="Compras online" value={persona.habilidadesTecnicas.comprasOnline} color={accent} />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function DataRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-sm shrink-0">{icon}</span>
      <span className="text-gray-400 shrink-0 w-16">{label}</span>
      <span className="text-gray-700 font-medium leading-snug">{value}</span>
    </div>
  )
}

function InsightBlock({ title, items, dotColor, icon }: { title: string; items: string[]; dotColor: string; icon: string }) {
  return (
    <div className="rounded-xl border border-gray-100 p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {icon} {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
            <span
              className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Main page component ────────────────────────────────────────────────────────

export function UserPersonaPage() {
  const [personas, setPersonas] = useState<UserPersonas | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(true)

  const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ ageRanges: [], painValues: [] })

  useEffect(() => {
    Promise.all([
      fetch('/api/user-persona-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/survey').then((r) => r.json()).catch(() => ({})),
      fetch('/api/potential-survey').then((r) => r.json()).catch(() => ({})),
    ]).then(([saved, survey, potential]) => {
      if (saved?.saved) {
        setPersonas(saved.saved.personas)
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

  const savePersonas = async (data: UserPersonas) => {
    setSaving(true)
    try {
      const r = await fetch('/api/user-persona-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personas: data, filters }),
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
      const res = await fetch('/api/user-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
      })
      if (!res.ok) throw new Error('Error')
      const d: UserPersonas = await res.json()
      setPersonas(d)
      await savePersonas(d)
    } catch {
      setGenError(true)
    } finally {
      setGenerating(false)
    }
  }

  // ── Loading ──

  if (loadingSaved) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
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
          <div className="inline-block h-6 w-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Analizando encuestas y construyendo los perfiles…</p>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-3">
            <Skeleton className="h-6 w-1/4" />
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
      <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex items-center justify-between gap-4">
        <p className="text-sm text-red-600">No se pudo generar los perfiles. Inténtalo de nuevo.</p>
        <button
          onClick={generate}
          className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const isFiltered = filters.gender !== 'all' || filters.ageRanges.length > 0 || filters.painValues.length > 0
  const genderLabel = GENDER_OPTIONS.find((o) => o.value === filters.gender)?.label

  // ── Empty state ──

  if (!personas) {
    return (
      <div className="space-y-5">
        <FiltersPanel filters={filters} options={filterOptions} onChange={setFilters} />
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center space-y-4">
          <div className="text-5xl">👤</div>
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">Genera los User Personas de MOA</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              La IA analizará las respuestas de clientes actuales y potenciales para construir dos perfiles
              detallados con motivaciones, necesidades, puntos de dolor y rasgos de personalidad.
            </p>
          </div>
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors shadow-sm"
          >
            ✦ Generar User Personas
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
      <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 space-y-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-violet-700">
            {isFiltered ? 'Perfiles generados con estos filtros:' : 'Perfiles generados sin filtros activos'}
          </p>
          {isFiltered && (
            <div className="flex flex-wrap gap-1.5">
              {filters.gender !== 'all' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-violet-600 text-white text-xs font-medium">
                  {genderLabel}
                </span>
              )}
              {filters.ageRanges.map((r) => (
                <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full bg-violet-600 text-white text-xs font-medium">
                  {r} años
                </span>
              ))}
              {filters.painValues.map((v) => (
                <span key={v} className="inline-flex items-center px-2 py-0.5 rounded-full bg-violet-600 text-white text-xs font-medium">
                  Dolor: {v}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-violet-500">
            Cambia los filtros y pulsa{' '}
            <button
              onClick={generate}
              className="font-semibold underline underline-offset-2 hover:text-violet-700 transition-colors"
            >
              ↺ Regenerar
            </button>{' '}
            para actualizar los perfiles según el segmento que necesites.
          </p>
        </div>
      </div>

      {/* Header actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          {saving ? (
            <>
              <span className="inline-block h-3 w-3 border border-gray-300 border-t-violet-400 rounded-full animate-spin" />
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

      {/* Persona cards */}
      <PersonaCard persona={personas.clienteActual} type="clienteActual" />
      <PersonaCard persona={personas.clientePotencial} type="clientePotencial" />
    </div>
  )
}
