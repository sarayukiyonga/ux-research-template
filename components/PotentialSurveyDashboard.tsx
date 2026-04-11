'use client'

import { useEffect, useState, useCallback } from 'react'
import { POTENTIAL_QUESTIONS } from '@/lib/potential-questions'
import { DemographicCard } from './DemographicCard'
import { QuestionCard } from './QuestionCard'
import { GroupedResponseCard, type Group } from './GroupedResponseCard'
import { PersonaCard } from './PersonaCard'
import { Skeleton } from '@/components/ui/skeleton'
import { loadCache, saveCache, clearCacheByPrefix } from '@/lib/ai-cache'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DistributionOption {
  label: string
  count: number
  pct: number
}

interface Distribution {
  questionId: number
  total: number
  options: DistributionOption[]
}

interface SurveyData {
  totalResponses: number
  lastUpdated: string
  byQuestion: { questionId: number; answers: string[] }[]
  distributions: Distribution[]
  demographic: { men: string[]; women: string[]; nonBinary: string[] }
}

interface GroupState {
  groups: Group[]
  loading: boolean
  error: string
  savedAt?: string
}

const CACHE_PREFIX = 'potential_group_q'

const OPEN_QUESTIONS = POTENTIAL_QUESTIONS.filter((q) => q.type === 'open')
const CLOSED_QUESTIONS = POTENTIAL_QUESTIONS.filter((q) => q.type === 'closed')

// ── Closed question card ───────────────────────────────────────────────────────

function ClosedQuestionCard({
  question,
  distribution,
}: {
  question: (typeof POTENTIAL_QUESTIONS)[number]
  distribution: Distribution | undefined
}) {
  if (!distribution || distribution.total === 0) {
    return (
      <div className="rounded-xl border bg-white p-5">
        <p className="text-xs text-gray-400 mb-1">Pregunta {question.id} — {question.shortTitle}</p>
        <p className="text-sm font-semibold text-gray-800 mb-3">{question.title}</p>
        <p className="text-xs text-gray-300 text-center py-3">Sin respuestas aún</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Pregunta {question.id} — {question.shortTitle}</p>
          <p className="text-sm font-semibold text-gray-800 leading-snug">{question.title}</p>
        </div>
        <span className="shrink-0 text-xs rounded-full bg-gray-100 text-gray-500 px-2 py-0.5">
          {distribution.total} resp.
        </span>
      </div>
      <div className="space-y-2">
        {distribution.options.map((opt) => (
          <div key={opt.label}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span className="font-medium">{opt.label}</span>
              <span className="text-gray-400">{opt.count} ({opt.pct}%)</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-400 transition-all"
                style={{ width: `${opt.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

async function fetchGroups(questionTitle: string, answers: string[]): Promise<Group[]> {
  const r = await fetch('/api/group-responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionTitle, answers }),
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(text || `Error ${r.status}`)
  }
  const d = await r.json()
  return d.groups ?? []
}

export function PotentialSurveyDashboard() {
  const [data, setData] = useState<SurveyData | null>(null)
  const [error, setError] = useState('')
  const [groupStates, setGroupStates] = useState<Record<number, GroupState>>({})
  const [refreshing, setRefreshing] = useState(false)

  const setGroupState = useCallback((questionId: number, patch: Partial<GroupState>) => {
    setGroupStates((prev) => ({
      ...prev,
      [questionId]: { ...{ groups: [], loading: true, error: '' }, ...prev[questionId], ...patch },
    }))
  }, [])

  const loadQuestion = useCallback(async (
    questionId: number,
    questionTitle: string,
    answers: string[],
    force = false
  ) => {
    if (answers.length < 4) {
      setGroupState(questionId, { loading: false, groups: [], error: '' })
      return
    }
    const cacheKey = CACHE_PREFIX + questionId
    if (!force) {
      const cached = loadCache<Group[]>(cacheKey)
      if (cached) {
        setGroupState(questionId, { loading: false, groups: cached.data, savedAt: cached.savedAt })
        return
      }
    }
    setGroupState(questionId, { loading: true, error: '', groups: [] })
    try {
      const groups = await fetchGroups(questionTitle, answers)
      const savedAt = saveCache(cacheKey, groups)
      setGroupState(questionId, { loading: false, groups, savedAt })
    } catch (e) {
      setGroupState(questionId, {
        loading: false,
        error: e instanceof Error ? e.message : 'Error desconocido',
        groups: [],
      })
    }
  }, [setGroupState])

  const loadAllGroups = useCallback((surveyData: SurveyData, force = false) => {
    const getAnswers = (id: number) =>
      surveyData.byQuestion.find((q) => q.questionId === id)?.answers ?? []
    const initial: Record<number, GroupState> = {}
    for (const q of OPEN_QUESTIONS) initial[q.id] = { groups: [], loading: true, error: '' }
    setGroupStates(initial)
    ;(async () => {
      for (const q of OPEN_QUESTIONS) {
        await loadQuestion(q.id, q.title, getAnswers(q.id), force)
      }
    })()
  }, [loadQuestion])

  useEffect(() => {
    fetch('/api/potential-survey')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('No se pudo conectar con la hoja de cálculo.'))
  }, [])

  useEffect(() => {
    if (!data) return
    loadAllGroups(data, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  async function handleRefreshAll() {
    if (!data) return
    setRefreshing(true)
    clearCacheByPrefix(CACHE_PREFIX)
    await loadAllGroups(data, true)
    setRefreshing(false)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-2">
          <p className="text-red-500 font-medium">Error al cargar los datos</p>
          <p className="text-sm text-gray-500 max-w-md">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  // Empty state — sheet exists but no responses yet
  if (data.totalResponses === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
        <span className="text-4xl">📭</span>
        <p className="text-gray-500 font-medium">Todavía no hay respuestas</p>
        <p className="text-sm text-gray-400 max-w-sm">
          Los resultados aparecerán aquí en tiempo real conforme los clientes potenciales vayan respondiendo la encuesta.
        </p>
      </div>
    )
  }

  const getAnswers = (id: number) =>
    data.byQuestion.find((q) => q.questionId === id)?.answers ?? []

  const getDistribution = (id: number) =>
    data.distributions.find((d) => d.questionId === id)

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total respuestas</p>
          <p className="mt-1 text-3xl font-bold text-violet-700">{data.totalResponses}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Preguntas</p>
          <p className="mt-1 text-3xl font-bold text-violet-700">{POTENTIAL_QUESTIONS.length + 1}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Última respuesta</p>
          <p className="mt-1 text-sm font-medium text-gray-700 truncate">
            {data.lastUpdated || '—'}
          </p>
        </div>
      </div>

      {/* Persona */}
      <PersonaCard
        byQuestion={data.byQuestion}
        demographic={data.demographic}
        apiPath="/api/potential-persona"
        title="Perfil del cliente potencial"
        subtitle="Generado con IA a partir de las respuestas de los encuestados"
        cacheKey="persona_potential"
      />

      {/* Demografía */}
      <DemographicCard
        men={data.demographic.men}
        women={data.demographic.women}
        nonBinary={data.demographic.nonBinary}
      />

      {/* Preguntas cerradas */}
      {CLOSED_QUESTIONS.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
            Preguntas de respuesta cerrada
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CLOSED_QUESTIONS.map((q) => (
              <ClosedQuestionCard
                key={q.id}
                question={q}
                distribution={getDistribution(q.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cabecera análisis agrupados + botón actualizar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Análisis agrupados por IA
        </p>
        <button
          onClick={handleRefreshAll}
          disabled={refreshing}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <span className={refreshing ? 'animate-spin inline-block' : ''}>↺</span>
          {refreshing ? 'Actualizando…' : 'Actualizar análisis'}
        </button>
      </div>

      {/* Preguntas abiertas */}
      {OPEN_QUESTIONS.map((q) => {
        const gs = groupStates[q.id] ?? { groups: [], loading: true, error: '' }
        const answers = getAnswers(q.id)
        return (
          <div key={q.id} className="space-y-3">
            {answers.length > 0 && (
              <div className="rounded-2xl border-2 border-violet-200 bg-linear-to-br from-violet-50 to-white p-1">
                <GroupedResponseCard
                  questionTitle={q.title}
                  shortTitle={`Pregunta ${q.id} — ${q.shortTitle}`}
                  answers={answers}
                  groups={gs.groups}
                  loading={gs.loading}
                  error={gs.error}
                  onRetry={() => loadQuestion(q.id, q.title, answers)}
                />
              </div>
            )}
            <QuestionCard
              questionId={q.id}
              title={q.title}
              shortTitle={`Pregunta ${q.id} — ${q.shortTitle}`}
              answers={answers}
            />
          </div>
        )
      })}
    </div>
  )
}
