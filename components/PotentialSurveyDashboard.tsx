'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { SurveyQuestionFromSheet } from '@/lib/survey-sheet-headers'
import { DemographicCard } from './DemographicCard'
import { QuestionCard } from './QuestionCard'
import { GroupedResponseCard, type Group } from './GroupedResponseCard'
import { PersonaCard } from './PersonaCard'
import { FilterBar, type ActiveFilters, type FilterOptions } from './FilterBar'
import { Skeleton } from '@/components/ui/skeleton'
import { SurveySheetLinkHelp } from '@/components/SurveySheetLinkHelp'
import { readSegmentSurveyFilters, writeSegmentSurveyFilters } from '@/lib/segment-survey-filters'
import { stableFiltersKey, toSurveyAiFiltersPayload } from '@/lib/survey-ai-filters'

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
  totalAll: number
  lastUpdated: string
  byQuestion: { questionId: number; answers: string[] }[]
  distributions: Distribution[]
  demographic: { men: string[]; women: string[]; nonBinary: string[] }
  filterOptions: FilterOptions
  questions: SurveyQuestionFromSheet[]
  filterColumnLabel?: string
}

interface GroupState {
  groups: Group[]
  loading: boolean
  error: string
  savedAt?: string
}

const DEFAULT_FILTERS: ActiveFilters = { gender: 'all', ageRanges: [], painValues: [] }

function filtersToQuery(filters: ActiveFilters): string {
  const params = new URLSearchParams()
  if (filters.gender !== 'all') params.set('gender', filters.gender)
  if (filters.ageRanges.length > 0) params.set('ageRanges', filters.ageRanges.join(','))
  if (filters.painValues.length > 0) params.set('painValues', filters.painValues.join(','))
  const qs = params.toString()
  return qs ? `/api/potential-survey?${qs}` : '/api/potential-survey'
}

function ClosedQuestionCard({
  question,
  distribution,
}: {
  question: SurveyQuestionFromSheet
  distribution: Distribution | undefined
}) {
  if (!distribution || distribution.total === 0) {
    return (
      <div className="rounded-xl border bg-white p-5">
        <p className="text-xs text-gray-400 mb-1">Col. {question.columnIndex} — {question.shortTitle}</p>
        <p className="text-sm font-semibold text-gray-800 mb-3">{question.title}</p>
        <p className="text-xs text-gray-300 text-center py-3">Sin respuestas aún</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Col. {question.columnIndex} — {question.shortTitle}</p>
          <p className="text-sm font-semibold text-gray-800 leading-snug">{question.title}</p>
        </div>
        <span className="shrink-0 text-xs rounded-full bg-gray-100 text-gray-500 px-2 py-0.5">
          {distribution.total} resp.
        </span>
      </div>
      <div className="space-y-2">
        {distribution.options.map((opt) => (
          <div key={`${question.questionId}-${opt.label}-${opt.count}`}>
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
  const [filters, setFilters] = useState<ActiveFilters>(() =>
    typeof window !== 'undefined' ? readSegmentSurveyFilters('potenciales') : DEFAULT_FILTERS
  )
  const [aiBundleSavedAt, setAiBundleSavedAt] = useState('')
  const [aiSheetHydrating, setAiSheetHydrating] = useState(false)
  const [personaSheet, setPersonaSheet] = useState({
    text: '',
    savedAt: '',
    loading: false,
    error: false,
  })

  const filtersPayload = useMemo(() => toSurveyAiFiltersPayload(filters), [filters])
  const filtersKey = useMemo(() => stableFiltersKey(filtersPayload), [filtersPayload])

  const openQuestions = useMemo(() => {
    if (!data?.questions?.length) return []
    return data.questions.filter((q) => q.type === 'open')
  }, [data])

  const closedQuestions = useMemo(() => {
    if (!data?.questions?.length) return []
    return data.questions.filter((q) => q.type === 'closed')
  }, [data])

  const latestBundleRef = useRef({
    personaText: '',
    groupStates: {} as Record<number, GroupState>,
    openIds: [] as number[],
  })

  useEffect(() => {
    latestBundleRef.current = {
      personaText: personaSheet.text,
      groupStates,
      openIds: openQuestions.map((q) => q.questionId),
    }
  }, [personaSheet.text, groupStates, openQuestions])

  const setGroupState = useCallback((questionId: number, patch: Partial<GroupState>) => {
    setGroupStates((prev) => ({
      ...prev,
      [questionId]: { ...{ groups: [], loading: true, error: '' }, ...prev[questionId], ...patch },
    }))
  }, [])

  const postSurveyAiSave = useCallback(
    async (groupsRecord: Record<number, Group[]>, persona: string) => {
      const r = await fetch('/api/survey-ai-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: 'potenciales',
          filters: filtersPayload,
          groups: Object.fromEntries(Object.entries(groupsRecord).map(([k, v]) => [String(k), v])),
          persona,
          occupations: null,
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      const d = await r.json()
      return d.savedAt as string
    },
    [filtersPayload]
  )

  useEffect(() => {
    if (!data) return
    let cancelled = false
    setAiSheetHydrating(true)
    setPersonaSheet({ text: '', savedAt: '', loading: true, error: false })

    const qs = `segment=potenciales&filters=${encodeURIComponent(JSON.stringify(filtersPayload))}`
    fetch(`/api/survey-ai-saved?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.saved) {
          const rawGroups = d.saved.groups ?? {}
          const nextStates: Record<number, GroupState> = {}
          for (const q of openQuestions) {
            const arr = (rawGroups[String(q.questionId)] ?? rawGroups[q.questionId] ?? []) as Group[]
            nextStates[q.questionId] = {
              groups: Array.isArray(arr) ? arr : [],
              loading: false,
              error: '',
              savedAt: d.saved.savedAt,
            }
          }
          setGroupStates(nextStates)
          setPersonaSheet({
            text: typeof d.saved.persona === 'string' ? d.saved.persona : '',
            savedAt: d.saved.savedAt,
            loading: false,
            error: false,
          })
          setAiBundleSavedAt(d.saved.savedAt)
        } else {
          const empty: Record<number, GroupState> = {}
          for (const q of openQuestions) {
            empty[q.questionId] = { groups: [], loading: false, error: '' }
          }
          setGroupStates(empty)
          setPersonaSheet({ text: '', savedAt: '', loading: false, error: false })
          setAiBundleSavedAt('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersonaSheet({ text: '', savedAt: '', loading: false, error: true })
          const empty: Record<number, GroupState> = {}
          for (const q of openQuestions) {
            empty[q.questionId] = { groups: [], loading: false, error: '' }
          }
          setGroupStates(empty)
        }
      })
      .finally(() => {
        if (!cancelled) setAiSheetHydrating(false)
      })

    return () => {
      cancelled = true
    }
  }, [data, filtersKey, filtersPayload, openQuestions])

  useEffect(() => {
    setData(null)
    setError('')
    setAiSheetHydrating(false)
    fetch(filtersToQuery(filters))
      .then(async (r) => {
        const d = (await r.json()) as { error?: string } & Partial<SurveyData>
        if (!r.ok || d.error) {
          setError(d.error ?? `Error ${r.status}: no se pudo cargar la encuesta.`)
          return
        }
        setAiSheetHydrating(true)
        setData(d as SurveyData)
      })
      .catch(() => setError('No se pudo conectar con el servidor. Comprueba la red y que la app esté en marcha.'))
  }, [filters])

  async function handleRefreshAll() {
    if (!data) return
    setRefreshing(true)
    setPersonaSheet((p) => ({ ...p, loading: true, error: false }))
    for (const q of openQuestions) {
      setGroupState(q.questionId, { loading: true, error: '', groups: [] })
    }

    const getAnswers = (id: number) => data.byQuestion.find((x) => x.questionId === id)?.answers ?? []

    try {
      const personaRes = await fetch('/api/potential-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          byQuestion: data.byQuestion,
          demographic: data.demographic,
          questions: data.questions,
          stream: false,
        }),
      })
      if (!personaRes.ok) throw new Error(await personaRes.text())
      const personaJson = await personaRes.json()
      const personaText = typeof personaJson.text === 'string' ? personaJson.text : ''

      const groupResults = await Promise.all(
        openQuestions.map(async (q) => {
          const answers = getAnswers(q.questionId)
          if (answers.length < 4) return { id: q.questionId, groups: [] as Group[] }
          const groups = await fetchGroups(q.title, answers)
          return { id: q.questionId, groups }
        })
      )

      const groupsRecord: Record<number, Group[]> = {}
      for (const { id, groups } of groupResults) {
        groupsRecord[id] = groups
      }

      const savedAt = await postSurveyAiSave(groupsRecord, personaText)

      for (const q of openQuestions) {
        setGroupState(q.questionId, {
          loading: false,
          groups: groupsRecord[q.questionId] ?? [],
          error: '',
          savedAt,
        })
      }
      setPersonaSheet({ text: personaText, savedAt, loading: false, error: false })
      setAiBundleSavedAt(savedAt)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      setPersonaSheet((p) => ({ ...p, loading: false, error: true }))
      for (const q of openQuestions) {
        setGroupState(q.questionId, { loading: false, groups: [], error: msg })
      }
    } finally {
      setRefreshing(false)
    }
  }

  const retryOneGroup = useCallback(
    async (questionId: number, questionTitle: string, answers: string[]) => {
      if (answers.length < 4) return
      setGroupState(questionId, { loading: true, error: '', groups: [] })
      try {
        const groups = await fetchGroups(questionTitle, answers)
        const { personaText, groupStates: gs, openIds } = latestBundleRef.current
        const groupsRecord: Record<number, Group[]> = {}
        for (const id of openIds) {
          groupsRecord[id] = id === questionId ? groups : (gs[id]?.groups ?? [])
        }
        const savedAt = await postSurveyAiSave(groupsRecord, personaText)
        setGroupState(questionId, { loading: false, groups, error: '', savedAt })
        setAiBundleSavedAt(savedAt)
      } catch (e) {
        setGroupState(questionId, {
          loading: false,
          groups: [],
          error: e instanceof Error ? e.message : 'Error',
        })
      }
    },
    [setGroupState, postSurveyAiSave]
  )

  function handleFiltersChange(newFilters: ActiveFilters) {
    writeSegmentSurveyFilters('potenciales', newFilters)
    setGroupStates({})
    setFilters(newFilters)
  }

  if (error) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-start px-1 py-4">
        <div className="w-full max-w-xl text-center space-y-2">
          <p className="text-red-600 font-semibold">No se pudo cargar la encuesta (clientes potenciales)</p>
          <p className="text-sm text-gray-600 leading-relaxed">{error}</p>
        </div>
        <SurveySheetLinkHelp variant="potenciales" />
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

  const filterSubtitle = data.filterColumnLabel ?? 'Filtro'

  if (data.totalResponses === 0) {
    const isFiltered =
      filters.gender !== 'all' || filters.ageRanges.length > 0 || filters.painValues.length > 0
    return (
      <div className="space-y-4">
        <FilterBar
          filterOptions={data.filterOptions}
          activeFilters={filters}
          totalFiltered={0}
          totalAll={data.totalAll}
          onChange={handleFiltersChange}
          secondaryFilterLabel={filterSubtitle}
        />
        <p className="text-xs text-gray-400 -mt-2">
          Estos filtros son la referencia para mapa de empatía, insights, POV, user persona y principios de diseño.
        </p>
        <div className="flex justify-end px-1">
          <button
            type="button"
            onClick={() => void handleRefreshAll()}
            disabled={refreshing || aiSheetHydrating}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>↺</span>
            {refreshing
              ? 'Generando y guardando…'
              : aiBundleSavedAt
                ? 'Regenerar y guardar en Sheets'
                : 'Generar y guardar en Sheets'}
          </button>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center space-y-3">
          <span className="text-4xl">{isFiltered ? '🔍' : '📭'}</span>
          <p className="text-gray-500 font-medium">
            {isFiltered ? 'Sin resultados para estos filtros' : 'Todavía no hay respuestas'}
          </p>
          <p className="text-sm text-gray-400 max-w-sm">
            {isFiltered
              ? 'Prueba a cambiar o limpiar los filtros para ver más respuestas.'
              : 'Los resultados aparecerán aquí en tiempo real conforme los clientes potenciales vayan respondiendo la encuesta.'}
          </p>
        </div>
      </div>
    )
  }

  const getAnswers = (id: number) =>
    data.byQuestion.find((q) => q.questionId === id)?.answers ?? []

  const getDistribution = (id: number) =>
    data.distributions.find((d) => d.questionId === id)

  return (
    <div className="space-y-6">
      <FilterBar
        filterOptions={data.filterOptions}
        activeFilters={filters}
        totalFiltered={data.totalResponses}
        totalAll={data.totalAll}
        onChange={handleFiltersChange}
        secondaryFilterLabel={filterSubtitle}
      />
      <p className="text-xs text-gray-400 -mt-2">
        Estos filtros son la referencia para mapa de empatía, insights, POV, user persona y principios de diseño (misma
        selección al regenerar en esas páginas).
      </p>
      <div className="flex justify-end px-1">
        <button
          type="button"
          onClick={() => void handleRefreshAll()}
          disabled={refreshing || aiSheetHydrating}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
        >
          <span className={refreshing ? 'animate-spin inline-block' : ''}>↺</span>
          {refreshing
            ? 'Generando y guardando…'
            : aiBundleSavedAt
              ? 'Regenerar y guardar en Sheets'
              : 'Generar y guardar en Sheets'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total respuestas</p>
          <p className="mt-1 text-3xl font-bold text-violet-700">{data.totalResponses}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Preguntas</p>
          <p className="mt-1 text-3xl font-bold text-violet-700">{data.questions.length + 1}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Última respuesta</p>
          <p className="mt-1 text-sm font-medium text-gray-700 truncate">
            {data.lastUpdated || '—'}
          </p>
        </div>
      </div>

      <PersonaCard
        byQuestion={data.byQuestion}
        demographic={data.demographic}
        apiPath="/api/potential-persona"
        title="Perfil del cliente potencial"
        subtitle="Generado con IA a partir de las respuestas de los encuestados"
        cacheKey="persona_potential"
        sheetBacked
        sheetText={personaSheet.text}
        sheetSavedAt={personaSheet.savedAt}
        sheetLoading={personaSheet.loading || aiSheetHydrating}
        sheetError={personaSheet.error}
        hideRefreshButton
      />

      <DemographicCard
        men={data.demographic.men}
        women={data.demographic.women}
        nonBinary={data.demographic.nonBinary}
      />

      {closedQuestions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
            Preguntas de respuesta cerrada
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {closedQuestions.map((q) => (
              <ClosedQuestionCard
                key={q.questionId}
                question={q}
                distribution={getDistribution(q.questionId)}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
        Análisis agrupados por IA · Google Sheets
      </p>

      {openQuestions.map((q) => {
        const gs = groupStates[q.questionId] ?? { groups: [], loading: aiSheetHydrating, error: '' }
        const answers = getAnswers(q.questionId)
        return (
          <div key={q.questionId} className="space-y-3">
            {answers.length > 0 && (
              <div className="rounded-2xl border-2 border-violet-200 bg-linear-to-br from-violet-50 to-white p-1">
                <GroupedResponseCard
                  questionTitle={q.title}
                  shortTitle={`Col. ${q.columnIndex} · ${q.shortTitle}`}
                  answers={answers}
                  groups={gs.groups}
                  loading={gs.loading || aiSheetHydrating}
                  error={gs.error}
                  onRetry={() => void retryOneGroup(q.questionId, q.title, answers)}
                />
              </div>
            )}
            <QuestionCard
              questionId={q.questionId}
              title={q.title}
              shortTitle={`Col. ${q.columnIndex} · ${q.shortTitle}`}
              answers={answers}
            />
          </div>
        )
      })}
    </div>
  )
}
