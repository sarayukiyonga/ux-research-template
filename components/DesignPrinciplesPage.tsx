'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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
  type: 'single' | 'multi' | 'pairs'
  options?: Option[]
  pairs?: { left: string; right: string }[]
}

const QUESTIONS: Question[] = [
  {
    id: 'filter_word',
    question: 'Si MOA fuera una sola palabra, ¿cuál sería?',
    hint: 'Esta palabra actuará como filtro para cualquier decisión de diseño: "¿esto es [palabra]?"',
    type: 'single',
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

// ── Results view ───────────────────────────────────────────────────────────────

interface Principle {
  icon: string
  title: string
  description: string
  guidelines: string[]
  color: string
}

interface ResultsData {
  summary: string
  principles: Principle[]
}

function ResultsView({ answers, onRedo }: { answers: Answers; onRedo: () => void }) {
  const [data, setData] = useState<ResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const generate = async () => {
    setLoading(true)
    setError(false)
    setData(null)

    // Build readable answers summary
    const formAnswers = QUESTIONS.map((q) => {
      const raw = answers[q.id]
      let readable = ''

      if (q.type === 'single') {
        const opt = q.options?.find((o) => o.id === raw)
        readable = opt ? `${opt.emoji ?? ''} ${opt.label}${opt.description ? ` (${opt.description})` : ''}`.trim() : String(raw)
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
            const label = v === 3 ? 'equilibrio' : v < 3 ? `"${p.left}" (${v}/5)` : `"${p.right}" (${v}/5)`
            return label
          })
          .join(' · ')
      }

      return `${q.question}\nRespuesta: ${readable || '(sin respuesta)'}`
    }).join('\n\n')

    try {
      const res = await fetch('/api/design-principles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formAnswers }),
      })
      if (!res.ok) throw new Error('Error')
      const d = await res.json()
      setData(d)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate on mount
  useState(() => { generate() })

  if (loading) {
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

  if (error || !data) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex items-center justify-between gap-4">
        <p className="text-sm text-red-600">No se pudieron generar los principios. Inténtalo de nuevo.</p>
        <button
          onClick={generate}
          className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-2xl bg-violet-50 border border-violet-100 px-5 py-4">
        <p className="text-sm text-violet-800 leading-relaxed">{data.summary}</p>
      </div>

      {/* Principles */}
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

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={generate}
          className="text-xs px-4 py-2 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          ↺ Regenerar
        </button>
        <button
          onClick={onRedo}
          className="text-xs px-4 py-2 rounded-full border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors"
        >
          ← Cambiar respuestas
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DesignPrinciplesPage() {
  const [answers, setAnswers] = useState<Answers>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const q = QUESTIONS[currentIdx]
  const total = QUESTIONS.length
  const progress = (currentIdx / total) * 100

  const setAnswer = (id: string, value: Answers[string]) =>
    setAnswers((prev) => ({ ...prev, [id]: value }))

  const hasAnswer = (id: string) => {
    const v = answers[id]
    if (v === undefined || v === null) return false
    if (Array.isArray(v)) return v.length > 0
    return true
  }

  const canContinue = hasAnswer(q.id)
  const isLast = currentIdx === total - 1

  if (submitted) {
    return <ResultsView answers={answers} onRedo={() => setSubmitted(false)} />
  }

  return (
    <div className="space-y-6">
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
            onClick={() => setSubmitted(true)}
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
