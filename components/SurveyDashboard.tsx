'use client'

import { useEffect, useState, useCallback } from 'react'
import { QUESTIONS } from '@/lib/questions'
import { QuestionCard } from './QuestionCard'
import { DemographicCard } from './DemographicCard'
import { PersonaCard } from './PersonaCard'
import { OccupationsCard } from './OccupationsCard'
import { GroupedResponseCard, type Group } from './GroupedResponseCard'
import { Skeleton } from '@/components/ui/skeleton'

interface SurveyData {
  totalResponses: number
  lastUpdated: string
  byQuestion: { questionId: number; answers: string[] }[]
  demographic: { men: string[]; women: string[]; nonBinary: string[] }
}

interface GroupState {
  groups: Group[]
  loading: boolean
  error: string
}

// Q2 uses OccupationsCard — skip GroupedResponseCard for it
const SKIP_GROUPED = [2]
const GROUPED_QUESTIONS = QUESTIONS.filter((q) => !SKIP_GROUPED.includes(q.id))

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

export function SurveyDashboard() {
  const [data, setData] = useState<SurveyData | null>(null)
  const [error, setError] = useState('')
  const [groupStates, setGroupStates] = useState<Record<number, GroupState>>({})

  // Helper to update one question's group state
  const setGroupState = useCallback((questionId: number, patch: Partial<GroupState>) => {
    setGroupStates((prev) => ({
      ...prev,
      [questionId]: { ...{ groups: [], loading: true, error: '' }, ...prev[questionId], ...patch },
    }))
  }, [])

  // Fetch groups for a single question and update state
  const loadQuestion = useCallback(async (questionId: number, questionTitle: string, answers: string[]) => {
    if (answers.length === 0) return
    setGroupState(questionId, { loading: true, error: '', groups: [] })
    try {
      const groups = await fetchGroups(questionTitle, answers)
      setGroupState(questionId, { loading: false, groups })
    } catch (e) {
      setGroupState(questionId, {
        loading: false,
        error: e instanceof Error ? e.message : 'Error desconocido',
        groups: [],
      })
    }
  }, [setGroupState])

  // Once survey data is ready, load grouped questions sequentially
  useEffect(() => {
    if (!data) return

    const getAnswers = (id: number) =>
      data.byQuestion.find((q) => q.questionId === id)?.answers ?? []

    // Mark all as loading immediately so skeletons appear
    const initial: Record<number, GroupState> = {}
    for (const q of GROUPED_QUESTIONS) {
      initial[q.id] = { groups: [], loading: true, error: '' }
    }
    setGroupStates(initial)

    // Run sequentially: await each before starting the next
    ;(async () => {
      for (const q of GROUPED_QUESTIONS) {
        await loadQuestion(q.id, q.title, getAnswers(q.id))
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Load survey data
  useEffect(() => {
    fetch('/api/survey')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('No se pudo conectar con la hoja de cálculo.'))
  }, [])

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
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  const getAnswers = (questionId: number) =>
    data.byQuestion.find((q) => q.questionId === questionId)?.answers ?? []

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
          <p className="mt-1 text-3xl font-bold text-violet-700">{QUESTIONS.length + 1}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Última respuesta</p>
          <p className="mt-1 text-sm font-medium text-gray-700 truncate">
            {data.lastUpdated || '—'}
          </p>
        </div>
      </div>

      {/* User Persona */}
      <PersonaCard byQuestion={data.byQuestion} demographic={data.demographic} />

      {/* Pregunta 1 — Demografía */}
      <DemographicCard
        men={data.demographic.men}
        women={data.demographic.women}
        nonBinary={data.demographic.nonBinary}
      />

      {/* Análisis destacado de ocupaciones (Q2) */}
      <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-1">
        <OccupationsCard answers={getAnswers(2)} />
      </div>

      {/* Preguntas con resumen agrupado + respuestas */}
      {QUESTIONS.map((q) => {
        const gs = groupStates[q.id] ?? { groups: [], loading: true, error: '' }
        const answers = getAnswers(q.id)
        return (
          <div key={q.id} className="space-y-3">
            {!SKIP_GROUPED.includes(q.id) && (
              <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-1">
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
