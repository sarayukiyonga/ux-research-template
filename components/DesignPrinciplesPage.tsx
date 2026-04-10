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
  // Block 1 — Propósito
  {
    id: 'goal',
    block: 'Propósito de la web',
    question: '¿Cuál es el objetivo principal de la web de MOA?',
    hint: 'Elige el más importante, aunque todos sean relevantes.',
    type: 'single',
    options: [
      { id: 'contact', emoji: '📞', label: 'Que la gente contacte o reserve', description: 'Generar leads y conversiones directas' },
      { id: 'trust', emoji: '🤝', label: 'Generar confianza antes del primer contacto', description: 'Que Patricia inspire seguridad antes de que llamen' },
      { id: 'explain', emoji: '📖', label: 'Explicar qué es MOA y a quién va dirigido', description: 'Educar al visitante sobre el modelo de entrenamiento' },
      { id: 'differentiate', emoji: '⭐', label: 'Diferenciarse de otros centros de la zona', description: 'Posicionarse frente a la competencia' },
    ],
  },
  {
    id: 'audience',
    block: 'Propósito de la web',
    question: '¿Qué tipo de visitante es más importante para la web?',
    hint: 'Puedes elegir más de uno.',
    type: 'multi',
    options: [
      { id: 'chronic', emoji: '💊', label: 'Persona con dolor crónico o patología' },
      { id: 'rehab', emoji: '🦴', label: 'Persona en recuperación post-lesión o cirugía' },
      { id: 'prevention', emoji: '🛡️', label: 'Persona sana que quiere prevenir y mantenerse' },
      { id: 'referred', emoji: '👩‍⚕️', label: 'Persona derivada por un médico o fisio' },
      { id: 'unknown', emoji: '🔍', label: 'Persona que no sabe exactamente qué necesita' },
    ],
  },

  // Block 2 — Primera impresión
  {
    id: 'feeling',
    block: 'Primera impresión',
    question: 'Cuando alguien entra por primera vez, ¿cómo debería sentirse?',
    hint: 'Elige las dos sensaciones más importantes.',
    type: 'multi',
    options: [
      { id: 'calm', emoji: '🌿', label: 'En calma — sin presión ni prisa' },
      { id: 'safe', emoji: '🛡️', label: 'Segura — en buenas manos' },
      { id: 'understood', emoji: '💬', label: 'Comprendida — "esto es para mí"' },
      { id: 'motivated', emoji: '⚡', label: 'Motivada — con ganas de empezar' },
      { id: 'professional', emoji: '🎓', label: 'Confiada — ante una profesional seria' },
    ],
  },
  {
    id: 'density',
    block: 'Primera impresión',
    question: '¿Cuánta información quieres mostrar de golpe?',
    type: 'scale',
    scaleMin: 'Muy minimalista — poco texto, mucho espacio',
    scaleMax: 'Completa — toda la info visible sin hacer scroll',
    scaleSteps: 5,
  },
  {
    id: 'visual_style',
    block: 'Primera impresión',
    question: 'Para cada par, ¿hacia dónde se inclina más MOA?',
    hint: 'Mueve el punto hacia el lado que más encaje.',
    type: 'pairs',
    pairs: [
      { left: 'Cálido y cercano', right: 'Frío y técnico' },
      { left: 'Suave y tranquilo', right: 'Enérgico y dinámico' },
      { left: 'Clásico y atemporal', right: 'Moderno y fresco' },
      { left: 'Fotográfico y humano', right: 'Ilustrado y gráfico' },
    ],
  },

  // Block 3 — Estructura
  {
    id: 'home_first',
    block: 'Estructura y navegación',
    question: '¿Qué debe verse primero nada más entrar a la web?',
    type: 'single',
    options: [
      { id: 'headline', emoji: '✍️', label: 'Un titular potente que explique qué es MOA' },
      { id: 'photo', emoji: '📸', label: 'Una foto de Patricia entrenando a alguien' },
      { id: 'services', emoji: '📋', label: 'Los servicios disponibles con sus precios' },
      { id: 'testimonial', emoji: '💬', label: 'Un testimonio real de un cliente' },
      { id: 'cta', emoji: '🎯', label: 'Un botón directo de "reserva tu primera sesión"' },
    ],
  },
  {
    id: 'navigation',
    block: 'Estructura y navegación',
    question: '¿Cómo prefieres la navegación?',
    type: 'single',
    options: [
      { id: 'minimal', emoji: '🧭', label: 'Mínima — 3 o 4 secciones claras', description: 'Inicio · Servicios · Sobre mí · Contacto' },
      { id: 'detailed', emoji: '📂', label: 'Detallada — una sección por tipo de servicio', description: 'Grupal · Personal · Online · Quiromasaje · Blog' },
      { id: 'one_page', emoji: '📜', label: 'Una sola página con scroll', description: 'Todo en una página larga, sin subpáginas' },
    ],
  },
  {
    id: 'steps_to_contact',
    block: 'Estructura y navegación',
    question: '¿Cuántos pasos debería necesitar alguien para contactarte?',
    type: 'scale',
    scaleMin: '1 paso — botón de WhatsApp siempre visible',
    scaleMax: '3-4 pasos — formulario detallado con cuestionario previo',
    scaleSteps: 4,
  },

  // Block 4 — Confianza
  {
    id: 'trust',
    block: 'Confianza y credibilidad',
    question: '¿Qué genera más confianza en tus clientes potenciales?',
    hint: 'Elige los tres más importantes.',
    type: 'multi',
    options: [
      { id: 'certifications', emoji: '🎓', label: 'Tus titulaciones y certificaciones visibles' },
      { id: 'testimonials', emoji: '⭐', label: 'Testimonios reales de clientes actuales' },
      { id: 'before_after', emoji: '📊', label: 'Casos de éxito o mejoras documentadas' },
      { id: 'methodology', emoji: '🔬', label: 'Explicar tu metodología y forma de trabajar' },
      { id: 'video', emoji: '🎥', label: 'Un vídeo tuyo hablando o entrenando' },
      { id: 'proximity', emoji: '📍', label: 'Mostrar que estás en Martorell, cerca de ellos' },
    ],
  },
  {
    id: 'must_have',
    block: 'Confianza y credibilidad',
    question: '¿Qué elemento NO debe faltar en ninguna página de la web?',
    type: 'single',
    options: [
      { id: 'photo_patri', emoji: '🙋‍♀️', label: 'Una foto tuya visible en todo momento' },
      { id: 'whatsapp', emoji: '📱', label: 'Un botón de contacto siempre accesible' },
      { id: 'tagline', emoji: '✍️', label: 'Tu frase o lema que resuma MOA' },
      { id: 'social_proof', emoji: '💬', label: 'Al menos un testimonio en cada sección' },
    ],
  },

  // Block 5 — Servicios
  {
    id: 'services_display',
    block: 'Presentación de servicios',
    question: '¿Cómo quieres mostrar tus servicios?',
    type: 'single',
    options: [
      { id: 'by_profile', emoji: '👤', label: 'Por perfil de cliente', description: '"Tengo una lesión" / "Quiero prevenir" / "Necesito flexibilidad horaria"' },
      { id: 'by_format', emoji: '📋', label: 'Por formato de entrenamiento', description: 'Individual · Grupal · Online · Quiromasaje' },
      { id: 'by_goal', emoji: '🎯', label: 'Por objetivo', description: 'Reducir dolor · Ganar fuerza · Volver al movimiento · Mantenimiento' },
    ],
  },
  {
    id: 'pricing',
    block: 'Presentación de servicios',
    question: '¿Quieres mostrar precios en la web?',
    type: 'single',
    options: [
      { id: 'yes_all', emoji: '✅', label: 'Sí, todos los precios visibles', description: 'Transparencia total, menos fricción' },
      { id: 'yes_range', emoji: '↔️', label: 'Sí, pero solo rangos orientativos', description: '"Desde X€ al mes"' },
      { id: 'no', emoji: '🤐', label: 'No, mejor hablar primero y personalizar', description: 'Más personalizado, requiere contacto' },
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
