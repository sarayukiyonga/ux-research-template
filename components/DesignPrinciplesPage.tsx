'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
  const isFiltered =
    filters.gender !== 'all' || filters.ageRanges.length > 0 || filters.painValues.length > 0

  const activeCount = (filters.gender !== 'all' ? 1 : 0) + filters.ageRanges.length + filters.painValues.length

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          Filtrar encuestas
          {isFiltered && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-violet-500 text-white text-[10px] font-bold leading-none">
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
        {/* Género */}
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

        {/* Franja de edad */}
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

        {/* Dolor crónico (sólo encuesta potencial) */}
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

// ── Question definitions ───────────────────────────────────────────────────────

interface Option {
  id: string
  label: string
  description?: string
  emoji?: string
}

interface Question {
  id: string
  question: string
  hint?: string
  type: 'single' | 'multi' | 'pairs' | 'priority'
  options?: Option[]
  pairs?: { left: string; right: string }[]
}

const QUESTIONS: Question[] = [
  {
    id: 'filter_word',
    question: '¿Con qué valores se identifica más MOA?',
    hint: 'Elige una palabra principal (el filtro clave de diseño) y opcionalmente una secundaria (el matiz que la complementa).',
    type: 'priority',
    options: [
      { id: 'progress',   emoji: '📈', label: 'Progreso',   description: 'Avanzar, mejorar, ir a más' },
      { id: 'care',       emoji: '💜', label: 'Cuidado',    description: 'Atención, mimo, trato personal' },
      { id: 'trust',      emoji: '🤝', label: 'Confianza',  description: 'Seguridad, credibilidad, vínculo' },
      { id: 'movement',   emoji: '🌊', label: 'Movimiento', description: 'Energía, fluidez, acción' },
      { id: 'strength',   emoji: '🌱', label: 'Fuerza',     description: 'Capacidad, resiliencia, poder propio' },
      { id: 'presence',   emoji: '🕯️', label: 'Presencia',  description: 'Estar, acompañar, escuchar' },
    ],
  },
  {
    id: 'conflicts',
    question: 'Cuando dos valores entran en conflicto en una decisión de diseño, ¿cuál gana?',
    hint: '1 = gana el de la izquierda · 5 = gana el de la derecha · 3 = depende del contexto.',
    type: 'pairs',
    pairs: [
      { left: 'Bonito',       right: 'Claro y funcional' },
      { left: 'Completo',     right: 'Simple' },
      { left: 'Profesional',  right: 'Cercano' },
      { left: 'Coherente con la marca', right: 'Adaptado al usuario' },
    ],
  },
  {
    id: 'never',
    question: '¿Qué nunca debe transmitir el diseño de MOA, en ningún soporte?',
    hint: 'Elige hasta dos. Los "no" en diseño son tan importantes como los "sí".',
    type: 'multi',
    options: [
      { id: 'pressure',  emoji: '🚫', label: 'Presión o urgencia',          description: '"¡Actúa ya!", contadores, escasez artificial' },
      { id: 'vanity',    emoji: '🪞', label: 'Culto al cuerpo perfecto',    description: 'Estética física como objetivo principal' },
      { id: 'cold',      emoji: '🧊', label: 'Frialdad clínica',            description: 'Distancia, tecnicismo sin humanidad' },
      { id: 'generic',   emoji: '📦', label: 'Genericidad',                  description: 'Podría ser cualquier gimnasio o centro' },
      { id: 'complex',   emoji: '🤯', label: 'Sobrecarga de información',   description: 'Demasiado a la vez, sin jerarquía' },
      { id: 'informal',  emoji: '🎉', label: 'Exceso de informalidad',      description: 'Tono juvenil o festivo que reste seriedad' },
    ],
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type Answers = Record<string, string | string[] | number[]>

// Priority choice stores [primaryId, secondaryId?]

// ── Sub-components ─────────────────────────────────────────────────────────────

function SingleChoice({ question, answer, onChange }: {
  question: Question
  answer: string | undefined
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      {question.options!.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
            answer === opt.id
              ? 'border-violet-500 bg-violet-50'
              : 'border-gray-200 hover:border-violet-200 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-3">
            {opt.emoji && <span className="text-xl shrink-0 mt-0.5">{opt.emoji}</span>}
            <div className="flex-1">
              <p className={`text-sm font-medium ${answer === opt.id ? 'text-violet-900' : 'text-gray-800'}`}>
                {opt.label}
              </p>
              {opt.description && (
                <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
              )}
            </div>
            <div className={`shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 transition-all ${
              answer === opt.id ? 'border-violet-500 bg-violet-500' : 'border-gray-300'
            }`} />
          </div>
        </button>
      ))}
    </div>
  )
}

function PriorityChoice({ question, answer, onChange }: {
  question: Question
  answer: string[] | undefined
  onChange: (v: string[]) => void
}) {
  // answer[0] = primary, answer[1] = secondary (optional)
  const selected = answer ?? []
  const primary = selected[0]
  const secondary = selected[1]

  const handleClick = (id: string) => {
    if (id === primary) {
      // Deselect primary → promote secondary if exists
      onChange(secondary ? [secondary] : [])
    } else if (id === secondary) {
      // Deselect secondary
      onChange([primary])
    } else if (!primary) {
      // Nothing selected → set as primary
      onChange([id])
    } else if (!secondary) {
      // Primary exists → set as secondary
      onChange([primary, id])
    } else {
      // Both exist → replace secondary
      onChange([primary, id])
    }
  }

  return (
    <div className="space-y-2">
      {question.options!.map((opt) => {
        const isPrimary = opt.id === primary
        const isSecondary = opt.id === secondary
        return (
          <button
            key={opt.id}
            onClick={() => handleClick(opt.id)}
            className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
              isPrimary
                ? 'border-violet-500 bg-violet-50'
                : isSecondary
                ? 'border-violet-300 bg-violet-50/50'
                : 'border-gray-200 hover:border-violet-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {opt.emoji && <span className="text-xl shrink-0 mt-0.5">{opt.emoji}</span>}
              <div className="flex-1">
                <p className={`text-sm font-medium ${isPrimary || isSecondary ? 'text-violet-900' : 'text-gray-800'}`}>
                  {opt.label}
                </p>
                {opt.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                )}
              </div>
              {isPrimary && (
                <span className="shrink-0 text-xs font-semibold bg-violet-500 text-white rounded-full px-2 py-0.5">
                  Principal
                </span>
              )}
              {isSecondary && (
                <span className="shrink-0 text-xs font-semibold bg-violet-200 text-violet-700 rounded-full px-2 py-0.5">
                  Secundaria
                </span>
              )}
              {!isPrimary && !isSecondary && (
                <div className="shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 border-gray-300" />
              )}
            </div>
          </button>
        )
      })}
      <p className="text-xs text-gray-400 pt-1">
        {!primary
          ? 'Toca una opción para elegir la palabra principal'
          : !secondary
          ? 'Toca otra para añadir una secundaria (opcional)'
          : 'Toca la secundaria para cambiarla, o la principal para reordenar'}
      </p>
    </div>
  )
}

function MultiChoice({ question, answer, onChange }: {
  question: Question
  answer: string[] | undefined
  onChange: (v: string[]) => void
}) {
  const selected = answer ?? []
  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id]
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {question.options!.map((opt) => {
        const on = selected.includes(opt.id)
        return (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
              on ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              {opt.emoji && <span className="text-xl shrink-0">{opt.emoji}</span>}
              <div className="flex-1">
                <p className={`text-sm font-medium ${on ? 'text-violet-900' : 'text-gray-800'}`}>
                  {opt.label}
                </p>
                {opt.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                )}
              </div>
              <div className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-all ${
                on ? 'border-violet-500 bg-violet-500' : 'border-gray-300'
              }`}>
                {on && <span className="text-white text-xs leading-none">✓</span>}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function PairsChoice({ question, answer, onChange }: {
  question: Question
  answer: number[] | undefined
  onChange: (v: number[]) => void
}) {
  const pairs = question.pairs!
  const current = answer ?? pairs.map(() => 3)
  const set = (i: number, v: number) => {
    const next = [...current]
    next[i] = v
    onChange(next)
  }
  return (
    <div className="space-y-5">
      {pairs.map((pair, i) => (
        <div key={i} className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-gray-700">
            <span>{pair.left}</span>
            <span>{pair.right}</span>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => set(i, v)}
                className={`flex-1 rounded-lg border-2 transition-all ${
                  current[i] === v
                    ? 'border-violet-500 bg-violet-500 h-8'
                    : 'border-gray-200 hover:border-violet-300 h-7'
                }`}
                style={{ opacity: current[i] === v ? 1 : 0.35 + Math.abs(v - 3) * 0.1 }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            {[1,2,3,4,5].map((v) => (
              <span key={v} className="flex-1 text-center">{v === 3 ? 'depende' : ''}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Principle {
  icon: string
  title: string
  description: string
  guidelines: string[]
  color: string
}

interface Group {
  icon: string
  name: string
  color: string
  principleIndices: number[]
}

interface ResultsData {
  summary: string
  groups: Group[]
  principles: Principle[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFormAnswers(answers: Answers): string {
  return QUESTIONS.map((q) => {
    const raw = answers[q.id]
    let readable = ''
    if (q.type === 'single') {
      const opt = q.options?.find((o) => o.id === raw)
      readable = opt
        ? `${opt.emoji ?? ''} ${opt.label}${opt.description ? ` (${opt.description})` : ''}`.trim()
        : String(raw)
    } else if (q.type === 'priority') {
      const ids = (raw as string[]) ?? []
      const primary = q.options?.find((o) => o.id === ids[0])
      const secondary = q.options?.find((o) => o.id === ids[1])
      readable = primary
        ? `Principal: ${primary.emoji ?? ''} ${primary.label} (${primary.description})${
            secondary ? ` · Secundaria: ${secondary.emoji ?? ''} ${secondary.label} (${secondary.description})` : ''
          }`.trim()
        : '(sin respuesta)'
    } else if (q.type === 'multi') {
      const ids = (raw as string[]) ?? []
      readable = ids
        .map((id) => q.options?.find((o) => o.id === id))
        .filter(Boolean)
        .map((o) => `${o!.emoji ?? ''} ${o!.label}`.trim())
        .join(', ')
    } else if (q.type === 'pairs') {
      const vals = (raw as number[]) ?? []
      readable = q.pairs!
        .map((p, i) => {
          const v = vals[i] ?? 3
          return v === 3 ? 'equilibrio' : v < 3 ? `"${p.left}" (${v}/5)` : `"${p.right}" (${v}/5)`
        })
        .join(' · ')
    }
    return `${q.question}\nRespuesta: ${readable || '(sin respuesta)'}`
  }).join('\n\n')
}

// ── Results view ───────────────────────────────────────────────────────────────

/**
 * Returns a version of `hex` that achieves at least 4.5:1 contrast ratio
 * against white (#fff), darkening iteratively as needed (WCAG AA).
 */
function readableOnWhite(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex

  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const luminance = (r: number, g: number, b: number) =>
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  const contrastVsWhite = (lum: number) => 1.05 / (lum + 0.05)

  let r = parseInt(hex.slice(1, 3), 16)
  let g = parseInt(hex.slice(3, 5), 16)
  let b = parseInt(hex.slice(5, 7), 16)

  while (contrastVsWhite(luminance(r, g, b)) < 4.5 && (r | g | b) > 0) {
    r = Math.max(0, Math.round(r * 0.8))
    g = Math.max(0, Math.round(g * 0.8))
    b = Math.max(0, Math.round(b * 0.8))
  }

  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

function PrinciplesDisplay({ data, savedAt, onRedo, onRegenerate, saving, filters }: {
  data: ResultsData
  savedAt: string
  onRedo: () => void
  onRegenerate: () => void
  saving: boolean
  filters: ActiveFilters
}) {
  return (
    <div className="space-y-5">
      {/* Saved indicator + actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            {saving ? (
              <>
                <span className="inline-block h-3 w-3 border border-gray-300 border-t-violet-500 rounded-full animate-spin" />
                Guardando…
              </>
            ) : savedAt ? (
              <>
                <span className="text-green-500">✓</span>
                Guardado el {savedAt}
              </>
            ) : null}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onRegenerate}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            ↺ Regenerar
          </button>
          <button
            onClick={onRedo}
            className="text-xs px-3 py-1.5 rounded-full border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors"
          >
            ← Cambiar respuestas
          </button>
        </div>
      </div>

      {/* Thematic group blocks — quick-scan */}
      {data.groups?.length > 0 && (
        <div className="space-y-3">
          {data.groups.map((g, gi) => {
            const members = g.principleIndices
              .map((idx) => data.principles[idx])
              .filter(Boolean)
            const textColor = readableOnWhite(g.color)
            return (
              <div
                key={gi}
                className="rounded-2xl border-2 px-5 py-4 space-y-3"
                style={{ borderColor: g.color + '50', backgroundColor: g.color + '08' }}
              >
                {/* Block header */}
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl"
                    style={{ backgroundColor: g.color + '20' }}
                  >
                    {g.icon}
                  </span>
                  <p
                    className="text-sm font-extrabold tracking-wide uppercase"
                    style={{ color: textColor }}
                  >
                    {g.name}
                  </p>
                </div>

                {/* Member principles */}
                <ul className="space-y-1.5 pl-1">
                  {members.map((p, pi) => (
                    <li key={pi} className="flex items-center gap-2.5">
                      <span className="text-base leading-none shrink-0">{p.icon}</span>
                      <span className="text-sm font-medium text-gray-700">{p.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {/* Summary */}
      <div className="rounded-2xl bg-violet-50 border border-violet-100 px-5 py-4">
        <p className="text-sm text-violet-800 leading-relaxed">{data.summary}</p>
      </div>

      {/* Principles — full detail */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Detalle completo
        </p>
        <div className="space-y-3">
          {data.principles.map((p, i) => (
            <div
              key={i}
              className="rounded-2xl border-2 p-5 space-y-3"
              style={{ borderColor: p.color + '40', backgroundColor: p.color + '06' }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{p.icon}</span>
                <div>
                  <p className="font-bold text-gray-900">{p.title}</p>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{p.description}</p>
                </div>
              </div>
              <ul className="space-y-1.5 pl-1">
                {p.guidelines.map((g, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DesignPrinciplesPage() {
  const [answers, setAnswers] = useState<Answers>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showForm, setShowForm] = useState(false)

  // Results state — can come from saved or freshly generated
  const [results, setResults] = useState<ResultsData | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [savedFormAnswers, setSavedFormAnswers] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(false)

  // Filters
  const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ ageRanges: [], painValues: [] })

  // Loading saved results on mount
  const [loadingSaved, setLoadingSaved] = useState(true)

  useEffect(() => {
    // Load saved results and filter options in parallel
    Promise.all([
      fetch('/api/design-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/survey').then((r) => r.json()).catch(() => ({})),
      fetch('/api/potential-survey').then((r) => r.json()).catch(() => ({})),
    ]).then(([saved, survey, potential]) => {
      if (saved?.saved) {
        setResults(saved.saved.principles)
        setSavedAt(saved.saved.savedAt)
        setSavedFormAnswers(saved.saved.formAnswers ?? '')
        if (saved.saved.filters) {
          setFilters({ ...DEFAULT_FILTERS, ...saved.saved.filters })
        }
      }
      // Merge filter options from both surveys
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

  const saveResults = async (formAnswers: string, principles: ResultsData) => {
    setSaving(true)
    try {
      const r = await fetch('/api/design-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formAnswers, principles, filters }),
      })
      const d = await r.json()
      if (d.savedAt) setSavedAt(d.savedAt)
    } catch {}
    setSaving(false)
  }

  // Accepts either a fresh Answers object (from the form) or a pre-built text string (when regenerating from saved)
  const generate = async (currentAnswers: Answers, overrideFormAnswers?: string) => {
    setGenerating(true)
    setGenError(false)
    const formAnswers = overrideFormAnswers ?? buildFormAnswers(currentAnswers)
    try {
      const res = await fetch('/api/design-principles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formAnswers, filters }),
      })
      if (!res.ok) throw new Error('Error')
      const d: ResultsData = await res.json()
      setResults(d)
      setShowForm(false)
      await saveResults(formAnswers, d)
    } catch {
      setGenError(true)
    } finally {
      setGenerating(false)
    }
  }

  // ── Loading saved ──────────────────────────────────────────────────────────

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

  // ── Generating ─────────────────────────────────────────────────────────────

  if (generating) {
    return (
      <div className="space-y-5 py-4">
        <div className="text-center space-y-2 py-4">
          <div className="inline-block h-6 w-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Analizando la entrevista y tus respuestas…</p>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  // ── Error generating ───────────────────────────────────────────────────────

  if (genError) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex items-center justify-between gap-4">
          <p className="text-sm text-red-600">No se pudieron generar los principios. Inténtalo de nuevo.</p>
          <button
            onClick={() => generate(answers)}
            className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
          >
            Reintentar
          </button>
        </div>
        <button
          onClick={() => { setGenError(false); setShowForm(true) }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ← Cambiar respuestas
        </button>
      </div>
    )
  }

  // ── Results (saved or fresh) ───────────────────────────────────────────────

  if (results && !showForm) {
    const isFiltered =
      filters.gender !== 'all' || filters.ageRanges.length > 0 || filters.painValues.length > 0

    const genderLabel = GENDER_OPTIONS.find((o) => o.value === filters.gender)?.label

    return (
      <div className="space-y-5">
        <FiltersPanel filters={filters} options={filterOptions} onChange={setFilters} />

        {/* Filter context banner */}
        <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-violet-700">
                {isFiltered ? 'Principios generados con estos filtros:' : 'Principios generados sin filtros activos'}
              </p>
              {isFiltered ? (
                <div className="flex flex-wrap gap-1.5">
                  {filters.gender !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-600 text-white text-xs font-medium">
                      {genderLabel}
                    </span>
                  )}
                  {filters.ageRanges.map((r) => (
                    <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-600 text-white text-xs font-medium">
                      {r} años
                    </span>
                  ))}
                  {filters.painValues.map((v) => (
                    <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-600 text-white text-xs font-medium">
                      Dolor: {v}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-violet-500">
                Puedes cambiar los filtros de arriba y pulsar{' '}
                <button
                  onClick={() => generate(answers, savedFormAnswers || undefined)}
                  className="font-semibold underline underline-offset-2 hover:text-violet-700 transition-colors"
                >
                  ↺ Regenerar
                </button>{' '}
                para actualizar los principios según el perfil que necesites.
              </p>
            </div>
          </div>
        </div>

        <PrinciplesDisplay
          data={results}
          savedAt={savedAt}
          saving={saving}
          filters={filters}
          onRedo={() => { setShowForm(true); setCurrentIdx(0) }}
          onRegenerate={() => generate(answers, savedFormAnswers || undefined)}
        />
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  const q = QUESTIONS[currentIdx]
  const total = QUESTIONS.length

  const setAnswer = (id: string, value: Answers[string]) =>
    setAnswers((prev) => ({ ...prev, [id]: value }))

  const hasAnswer = (id: string) => {
    const v = answers[id]
    if (v === undefined || v === null) return false
    if (Array.isArray(v)) return v.length > 0  // priority: at least primary selected
    return true
  }

  const canContinue = hasAnswer(q.id)
  const isLast = currentIdx === total - 1

  return (
    <div className="space-y-6">
      {/* Filters */}
      <FiltersPanel filters={filters} options={filterOptions} onChange={setFilters} />

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{currentIdx + 1} de {total}</span>
          <div className="flex gap-1.5">
            {QUESTIONS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition-all ${
                  i < currentIdx ? 'bg-violet-300' : i === currentIdx ? 'bg-violet-500' : 'bg-gray-100'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Question card */}
      <Card className="border-2 border-gray-100">
        <CardContent className="pt-6 space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
              {q.question}
            </h2>
            {q.hint && (
              <p className="text-xs text-gray-400 mt-1.5">{q.hint}</p>
            )}
          </div>

          {q.type === 'single' && (
            <SingleChoice
              question={q}
              answer={answers[q.id] as string}
              onChange={(v) => setAnswer(q.id, v)}
            />
          )}
          {q.type === 'priority' && (
            <PriorityChoice
              question={q}
              answer={answers[q.id] as string[]}
              onChange={(v) => setAnswer(q.id, v)}
            />
          )}
          {q.type === 'multi' && (
            <MultiChoice
              question={q}
              answer={answers[q.id] as string[]}
              onChange={(v) => setAnswer(q.id, v)}
            />
          )}
          {q.type === 'pairs' && (
            <PairsChoice
              question={q}
              answer={answers[q.id] as number[]}
              onChange={(v) => setAnswer(q.id, v)}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="text-sm px-4 py-2 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Anterior
        </button>

        {isLast ? (
          <button
            onClick={() => generate(answers)}
            disabled={!canContinue}
            className="text-sm px-6 py-2 rounded-full bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Generar principios →
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx((i) => i + 1)}
            disabled={!canContinue}
            className="text-sm px-6 py-2 rounded-full bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente →
          </button>
        )}
      </div>
    </div>
  )
}
