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
  block: string
  question: string
  hint?: string
  type: 'single' | 'multi' | 'scale' | 'pairs'
  options?: Option[]
  scaleMin?: string
  scaleMax?: string
  scaleSteps?: number
  pairs?: { left: string; right: string }[]
}

const QUESTIONS: Question[] = [
  // Block 1 — Emoción y propósito
  {
    id: 'core_feeling',
    block: 'Emoción central',
    question: 'Cuando alguien interactúa con MOA —web, app, espacio físico, materiales— ¿cuál es la emoción más importante que debe sentir?',
    hint: 'Elige solo una. Esta será la emoción que guíe cualquier decisión de diseño.',
    type: 'single',
    options: [
      { id: 'calm', emoji: '🌿', label: 'Calma', description: 'Sin ruido ni prisa. Aquí tienes espacio para ti.' },
      { id: 'safe', emoji: '🛡️', label: 'Seguridad', description: 'Estás en manos de alguien que sabe lo que hace.' },
      { id: 'seen', emoji: '💬', label: 'Sentirse vista/o', description: 'Esto está hecho para mí, me entienden.' },
      { id: 'hope', emoji: '🌅', label: 'Esperanza', description: 'Puedo mejorar. Esto es posible para mí.' },
      { id: 'belonging', emoji: '🤝', label: 'Pertenencia', description: 'Hay un lugar para mí aquí.' },
    ],
  },
  {
    id: 'secondary_feelings',
    block: 'Emoción central',
    question: '¿Qué emociones secundarias complementan la principal?',
    hint: 'Elige hasta dos.',
    type: 'multi',
    options: [
      { id: 'confidence', emoji: '💪', label: 'Confianza' },
      { id: 'warmth', emoji: '☀️', label: 'Calidez' },
      { id: 'clarity', emoji: '🔍', label: 'Claridad' },
      { id: 'motivation', emoji: '⚡', label: 'Motivación' },
      { id: 'respect', emoji: '🎖️', label: 'Respeto' },
      { id: 'relief', emoji: '😮‍💨', label: 'Alivio' },
    ],
  },

  // Block 2 — Personalidad visual
  {
    id: 'visual_personality',
    block: 'Personalidad visual',
    question: 'Para cada par, ¿dónde está MOA?',
    hint: '1 = totalmente a la izquierda · 5 = totalmente a la derecha. El centro indica equilibrio.',
    type: 'pairs',
    pairs: [
      { left: 'Cálido y orgánico', right: 'Frío y clínico' },
      { left: 'Suave y tranquilo', right: 'Intenso y enérgico' },
      { left: 'Cercano y humano', right: 'Técnico y experto' },
      { left: 'Sencillo y sin adornos', right: 'Rico en detalles y texturas' },
      { left: 'Atemporal y clásico', right: 'Contemporáneo y fresco' },
    ],
  },
  {
    id: 'space_rhythm',
    block: 'Personalidad visual',
    question: '¿Cuánto espacio en blanco, silencio visual, debe tener el diseño de MOA?',
    type: 'scale',
    scaleMin: 'Muy denso — cada espacio aporta información',
    scaleMax: 'Muy aireado — el espacio en blanco es protagonista',
    scaleSteps: 5,
  },
  {
    id: 'human_presence',
    block: 'Personalidad visual',
    question: '¿Qué presencia humana debe tener el diseño?',
    type: 'single',
    options: [
      { id: 'patri_center', emoji: '🙋‍♀️', label: 'Patricia como cara visible y protagonista', description: 'El vínculo personal con Patricia es el centro del diseño' },
      { id: 'clients_center', emoji: '👥', label: 'Los clientes como protagonistas', description: 'El foco es en ellos, en su proceso y transformación' },
      { id: 'both', emoji: '🤝', label: 'Ambos, en equilibrio', description: 'Patricia como guía, los clientes como resultado' },
      { id: 'abstract', emoji: '🌿', label: 'El movimiento y la salud como protagonistas', description: 'Más abstracto, centrado en el concepto y la marca' },
    ],
  },

  // Block 3 — Relación y trato
  {
    id: 'relationship_model',
    block: 'Relación con el cliente',
    question: '¿Qué tipo de relación refleja mejor cómo MOA trata a sus clientes?',
    hint: 'Elige el más honesto, no el más aspiracional.',
    type: 'single',
    options: [
      { id: 'guide', emoji: '🧭', label: 'Guía experta', description: 'Sé más que tú sobre esto y te llevo paso a paso' },
      { id: 'coach', emoji: '🏋️', label: 'Coach comprometida', description: 'Estoy aquí para empujarte y acompañarte' },
      { id: 'ally', emoji: '💜', label: 'Aliada de salud', description: 'Estamos juntas en este proceso, somos equipo' },
      { id: 'safe_space', emoji: '🏠', label: 'Espacio seguro', description: 'Aquí puedes ser tú, con tus limitaciones, sin juicio' },
    ],
  },
  {
    id: 'pace',
    block: 'Relación con el cliente',
    question: '¿Qué ritmo transmite mejor la filosofía de MOA?',
    type: 'scale',
    scaleMin: 'Progreso lento, constante y seguro — paso a paso',
    scaleMax: 'Transformación visible y motivadora — resultados reales',
    scaleSteps: 5,
  },

  // Block 4 — Coherencia de marca
  {
    id: 'brand_never',
    block: 'Límites de marca',
    question: '¿Qué nunca debe transmitir el diseño de MOA, en ningún soporte?',
    hint: 'Elige hasta dos.',
    type: 'multi',
    options: [
      { id: 'no_pressure', emoji: '🚫', label: 'Presión o urgencia ("¡Actúa ya!")' },
      { id: 'no_vanity', emoji: '🪞', label: 'Vanidad estética o culto al cuerpo perfecto' },
      { id: 'no_cold', emoji: '🧊', label: 'Frialdad o distancia clínica' },
      { id: 'no_generic', emoji: '📦', label: 'Genericidad — podría ser cualquier gimnasio' },
      { id: 'no_complex', emoji: '🤯', label: 'Complejidad — demasiada información a la vez' },
      { id: 'no_informal', emoji: '🎉', label: 'Exceso de informalidad o tono juvenil' },
    ],
  },
  {
    id: 'reference_experience',
    block: 'Límites de marca',
    question: '¿Qué experiencia del mundo real —no del diseño— te da la misma sensación que quieres que dé MOA?',
    hint: 'Puede ser un lugar, un momento, una persona, un olor, una música… lo que sea.',
    type: 'single',
    options: [
      { id: 'nature_walk', emoji: '🌲', label: 'Un paseo por el bosque', description: 'Silencio, ritmo propio, reconectar con el cuerpo' },
      { id: 'physio', emoji: '🏥', label: 'La primera visita a un buen fisioterapeuta', description: 'Alguien que por fin te entiende y te dice qué hacer' },
      { id: 'trusted_friend', emoji: '☕', label: 'Una conversación honesta con una amiga que te conoce', description: 'Sin filtros, con cariño y dirección real' },
      { id: 'morning_routine', emoji: '🌅', label: 'Una mañana tranquila sin prisa', description: 'Calma, claridad, empezar bien el día' },
      { id: 'achieve', emoji: '🏔️', label: 'Llegar a la cima de una montaña que creías imposible', description: 'Esfuerzo, superación, orgullo propio' },
    ],
  },

  // Block 5 — Esencia
  {
    id: 'one_word',
    block: 'Esencia',
    question: 'Si MOA fuera una sola palabra, ¿cuál sería?',
    hint: 'La que más se acerque. Esta palabra puede ser el filtro de cualquier decisión de diseño: "¿esto es [palabra]?"',
    type: 'single',
    options: [
      { id: 'progress', emoji: '📈', label: 'Progreso' },
      { id: 'care', emoji: '💜', label: 'Cuidado' },
      { id: 'trust', emoji: '🤝', label: 'Confianza' },
      { id: 'movement', emoji: '🌊', label: 'Movimiento' },
      { id: 'strength', emoji: '🌱', label: 'Fuerza' },
      { id: 'presence', emoji: '🕯️', label: 'Presencia' },
    ],
  },
  {
    id: 'design_priority',
    block: 'Esencia',
    question: 'Si en una decisión de diseño hubiera que elegir entre dos valores, ¿cuál gana?',
    type: 'pairs',
    pairs: [
      { left: 'Bonito', right: 'Claro' },
      { left: 'Completo', right: 'Simple' },
      { left: 'Profesional', right: 'Cercano' },
      { left: 'Coherente con la marca', right: 'Adaptado al usuario' },
    ],
  },
]

const BLOCKS = [...new Set(QUESTIONS.map((q) => q.block))]

// ── Types for answers ─────────────────────────────────────────────────────────

type Answers = Record<string, string | string[] | number | number[]>

// ── Sub-components ─────────────────────────────────────────────────────────────

function SingleChoice({
  question,
  answer,
  onChange,
}: {
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
            <div>
              <p className={`text-sm font-medium ${answer === opt.id ? 'text-violet-900' : 'text-gray-800'}`}>
                {opt.label}
              </p>
              {opt.description && (
                <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
              )}
            </div>
            <div className={`ml-auto shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 transition-all ${
              answer === opt.id ? 'border-violet-500 bg-violet-500' : 'border-gray-300'
            }`} />
          </div>
        </button>
      ))}
    </div>
  )
}

function MultiChoice({
  question,
  answer,
  onChange,
}: {
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
              <p className={`text-sm font-medium flex-1 ${on ? 'text-violet-900' : 'text-gray-800'}`}>
                {opt.label}
              </p>
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

function ScaleChoice({
  question,
  answer,
  onChange,
}: {
  question: Question
  answer: number | undefined
  onChange: (v: number) => void
}) {
  const steps = question.scaleSteps ?? 5
  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-between">
        {Array.from({ length: steps }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`flex-1 h-12 rounded-xl border-2 text-sm font-bold transition-all ${
              answer === v
                ? 'border-violet-500 bg-violet-500 text-white'
                : 'border-gray-200 hover:border-violet-300 text-gray-600'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span className="max-w-[45%] leading-snug">{question.scaleMin}</span>
        <span className="max-w-[45%] text-right leading-snug">{question.scaleMax}</span>
      </div>
    </div>
  )
}

function PairsChoice({
  question,
  answer,
  onChange,
}: {
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
    <div className="space-y-4">
      {pairs.map((pair, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-xs font-medium text-gray-700">
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
                    ? 'border-violet-500 bg-violet-500 h-7'
                    : 'border-gray-200 hover:border-violet-300 h-6'
                }`}
                style={{
                  opacity: current[i] === v ? 1 : 0.4 + Math.abs(v - 3) * 0.1,
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-400 text-center">1 = totalmente a la izquierda · 5 = totalmente a la derecha</p>
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
  principles: Principle[]
  summary: string
}

function ResultsView({
  answers,
  onRedo,
}: {
  answers: Answers
  onRedo: () => void
}) {
  const [data, setData] = useState<ResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const generate = async () => {
    setLoading(true)
    setError(false)
    setData(null)

    // Build a readable summary of answers to send to the AI
    const formAnswers = QUESTIONS.map((q) => {
      const raw = answers[q.id]
      let readable = ''

      if (q.type === 'single') {
        const opt = q.options?.find((o) => o.id === raw)
        readable = opt ? `${opt.emoji ?? ''} ${opt.label}`.trim() : String(raw)
      } else if (q.type === 'multi') {
        const ids = (raw as string[]) ?? []
        readable = ids
          .map((id) => q.options?.find((o) => o.id === id))
          .filter(Boolean)
          .map((o) => `${o!.emoji ?? ''} ${o!.label}`.trim())
          .join(', ')
      } else if (q.type === 'scale') {
        readable = `${raw}/5 (1=${q.scaleMin?.split('—')[0]?.trim()}, 5=${q.scaleMax?.split('—')[0]?.trim()})`
      } else if (q.type === 'pairs') {
        const vals = (raw as number[]) ?? []
        readable = q.pairs!
          .map((p, i) => `"${p.left}" vs "${p.right}": ${vals[i] ?? 3}/5`)
          .join(' | ')
      }

      return `[${q.block}] ${q.question}\nRespuesta: ${readable || '(sin respuesta)'}`
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
        <div className="text-center space-y-2">
          <div className="inline-block h-6 w-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Generando principios de diseño…</p>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
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
    <div className="space-y-6">
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
                  <span
                    className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
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
          ← Editar respuestas
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
  const progress = ((currentIdx) / total) * 100

  const setAnswer = (id: string, value: Answers[string]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const hasAnswer = (id: string) => {
    const v = answers[id]
    if (v === undefined || v === null) return false
    if (Array.isArray(v)) return v.length > 0
    return true
  }

  const canContinue = hasAnswer(q.id)
  const isLast = currentIdx === total - 1

  const currentBlock = q.block
  const prevBlock = currentIdx > 0 ? QUESTIONS[currentIdx - 1].block : null
  const blockStart = prevBlock !== currentBlock

  return (
    <div className="space-y-6">
      {!submitted ? (
        <>
          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">
                Pregunta {currentIdx + 1} de {total}
              </span>
              <span className="text-xs font-medium text-violet-600">{q.block}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Block indicator */}
            <div className="flex gap-1.5 pt-0.5">
              {BLOCKS.map((b) => (
                <div
                  key={b}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    b === q.block
                      ? 'bg-violet-400'
                      : BLOCKS.indexOf(b) < BLOCKS.indexOf(q.block)
                      ? 'bg-violet-200'
                      : 'bg-gray-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Question card */}
          <Card className="border-2 border-gray-100">
            <CardContent className="pt-6 space-y-4">
              {blockStart && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                  {q.block}
                </div>
              )}

              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                  {q.question}
                </h2>
                {q.hint && (
                  <p className="text-xs text-gray-400 mt-1">{q.hint}</p>
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
              {q.type === 'scale' && (
                <ScaleChoice
                  question={q}
                  answer={answers[q.id] as number}
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
        </>
      ) : (
        <ResultsView answers={answers} onRedo={() => setSubmitted(false)} />
      )}
    </div>
  )
}
