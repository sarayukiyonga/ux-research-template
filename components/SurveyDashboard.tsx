'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { SurveyQuestionFromSheet } from '@/lib/survey-sheet-headers'
import { QuestionCard } from './QuestionCard'
import { DemographicCard } from './DemographicCard'
import { PersonaCard } from './PersonaCard'
import { OccupationsCard, type OccupationResult } from './OccupationsCard'
import { GroupedResponseCard, type Group } from './GroupedResponseCard'
import { FilterBar, type ActiveFilters, type FilterOptions } from './FilterBar'
import { Skeleton } from '@/components/ui/skeleton'
import { SurveySheetLinkHelp } from '@/components/SurveySheetLinkHelp'
import { readSegmentSurveyFilters, writeSegmentSurveyFilters } from '@/lib/segment-survey-filters'
import { stableFiltersKey, toSurveyAiFiltersPayload } from '@/lib/survey-ai-filters'

interface SurveyData {
  totalResponses: number
  totalAll: number
  lastUpdated: string
  byQuestion: { questionId: number; answers: string[] }[]
  questions: SurveyQuestionFromSheet[]
  demographic: { men: string[]; women: string[]; nonBinary: string[] }
  filterOptions: FilterOptions
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
  const qs = params.toString()
  return qs ? `/api/survey?${qs}` : '/api/survey'
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

export function SurveyDashboard() {
  const [data, setData] = useState<SurveyData | null>(null)
  const [error, setError] = useState('')
  const [groupStates, setGroupStates] = useState<Record<number, GroupState>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<ActiveFilters>(() =>
    typeof window !== 'undefined' ? readSegmentSurveyFilters('clientes') : DEFAULT_FILTERS
  )
  const [aiBundleSavedAt, setAiBundleSavedAt] = useState('')
  const [aiSheetHydrating, setAiSheetHydrating] = useState(false)
  const [personaSheet, setPersonaSheet] = useState({
    text: '',
    savedAt: '',
    loading: false,
    error: false,
  })
  const [occSheet, setOccSheet] = useState<{
    data: OccupationResult | null
    savedAt: string
    loading: boolean
    error: string
  }>({ data: null, savedAt: '', loading: false, error: '' })

  const filtersPayload = useMemo(() => toSurveyAiFiltersPayload(filters), [filters])
  const filtersKey = useMemo(() => stableFiltersKey(filtersPayload), [filtersPayload])

  const groupedIaQuestions = useMemo(() => {
    if (!data?.questions?.length) return []
    return data.questions.filter((q) => q.type === 'open' && !q.skipGroupedIa)
  }, [data])

  const occupationQuestion = useMemo(() => {
    if (!data?.questions?.length) return null
    return data.questions.find((q) => q.isOccupationColumn) ?? data.questions[0]
  }, [data])

  const latestBundleRef = useRef({
    personaText: '',
    occupationData: null as OccupationResult | null,
    groupStates: {} as Record<number, GroupState>,
    groupedIds: [] as number[],
  })

  useEffect(() => {
    latestBundleRef.current = {
      personaText: personaSheet.text,
      occupationData: occSheet.data,
      groupStates,
      groupedIds: groupedIaQuestions.map((q) => q.questionId),
    }
  }, [personaSheet.text, occSheet.data, groupStates, groupedIaQuestions])

  const setGroupState = useCallback((questionId: number, patch: Partial<GroupState>) => {
    setGroupStates((prev) => ({
      ...prev,
      [questionId]: { ...{ groups: [], loading: true, error: '' }, ...prev[questionId], ...patch },
    }))
  }, [])

  const postSurveyAiSave = useCallback(
    async (groupsRecord: Record<number, Group[]>, persona: string, occupations: OccupationResult | null) => {
      const r = await fetch('/api/survey-ai-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: 'clientes',
          filters: filtersPayload,
          groups: Object.fromEntries(Object.entries(groupsRecord).map(([k, v]) => [String(k), v])),
          persona,
          occupations,
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
    setOccSheet({ data: null, savedAt: '', loading: true, error: '' })

    const qs = `segment=clientes&filters=${encodeURIComponent(JSON.stringify(filtersPayload))}`
    fetch(`/api/survey-ai-saved?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.saved) {
          const rawGroups = d.saved.groups ?? {}
          const nextStates: Record<number, GroupState> = {}
          for (const q of groupedIaQuestions) {
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
          setOccSheet({
            data: (d.saved.occupations ?? null) as OccupationResult | null,
            savedAt: d.saved.savedAt,
            loading: false,
            error: '',
          })
          setAiBundleSavedAt(d.saved.savedAt)
        } else {
          const empty: Record<number, GroupState> = {}
          for (const q of groupedIaQuestions) {
            empty[q.questionId] = { groups: [], loading: false, error: '' }
          }
          setGroupStates(empty)
          setPersonaSheet({ text: '', savedAt: '', loading: false, error: false })
          setOccSheet({ data: null, savedAt: '', loading: false, error: '' })
          setAiBundleSavedAt('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersonaSheet({ text: '', savedAt: '', loading: false, error: true })
          setOccSheet((o) => ({ ...o, loading: false, error: 'No se pudo leer Google Sheets' }))
          const empty: Record<number, GroupState> = {}
          for (const q of groupedIaQuestions) {
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
  }, [data, filtersKey, filtersPayload, groupedIaQuestions])

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
    setOccSheet((o) => ({ ...o, loading: true, error: '' }))
    for (const q of groupedIaQuestions) {
      setGroupState(q.questionId, { loading: true, error: '', groups: [] })
    }

    const getAnswers = (id: number) => data.byQuestion.find((x) => x.questionId === id)?.answers ?? []

    try {
      const personaRes = await fetch('/api/persona', {
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

      const occId = occupationQuestion?.questionId ?? -1
      const occAns = occId >= 0 ? getAnswers(occId) : []
      let occData: OccupationResult | null = null
      if (occAns.length > 0) {
        const occRes = await fetch('/api/occupations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: occAns }),
        })
        if (!occRes.ok) throw new Error(await occRes.text())
        occData = await occRes.json()
      }

      const groupResults = await Promise.all(
        groupedIaQuestions.map(async (q) => {
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

      const savedAt = await postSurveyAiSave(groupsRecord, personaText, occData)

      for (const q of groupedIaQuestions) {
        setGroupState(q.questionId, {
          loading: false,
          groups: groupsRecord[q.questionId] ?? [],
          error: '',
          savedAt,
        })
      }
      setPersonaSheet({ text: personaText, savedAt, loading: false, error: false })
      setOccSheet({ data: occData, savedAt, loading: false, error: '' })
      setAiBundleSavedAt(savedAt)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      setPersonaSheet((p) => ({ ...p, loading: false, error: true }))
      setOccSheet((o) => ({ ...o, loading: false, error: msg }))
      for (const q of groupedIaQuestions) {
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
        const { personaText, occupationData, groupStates: gs, groupedIds } = latestBundleRef.current
        const groupsRecord: Record<number, Group[]> = {}
        for (const id of groupedIds) {
          groupsRecord[id] = id === questionId ? groups : (gs[id]?.groups ?? [])
        }
        const savedAt = await postSurveyAiSave(groupsRecord, personaText, occupationData)
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
    writeSegmentSurveyFilters('clientes', newFilters)
    setGroupStates({})
    setFilters(newFilters)
  }

  if (error) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-start px-1 py-4">
        <div className="w-full max-w-xl text-center space-y-2">
          <p className="text-red-600 font-semibold">No se pudo cargar la encuesta (clientes actuales)</p>
          <p className="text-sm text-gray-600 leading-relaxed">{error}</p>
        </div>
        <SurveySheetLinkHelp variant="clientes" />
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

  const hasSheetBundle = Boolean(aiBundleSavedAt)
  const occId = occupationQuestion?.questionId ?? -1

  return (
    <div className="space-y-6">
      <FilterBar
        filterOptions={data.filterOptions}
        activeFilters={filters}
        totalFiltered={data.totalResponses}
        totalAll={data.totalAll}
        onChange={handleFiltersChange}
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
          {refreshing ? 'Generando y guardando…' : hasSheetBundle ? 'Regenerar y guardar en Sheets' : 'Generar y guardar en Sheets'}
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

      <div className="rounded-2xl border-2 border-violet-200 bg-linear-to-br from-violet-50 to-white p-1">
        <OccupationsCard
          answers={occId >= 0 ? getAnswers(occId) : []}
          sheetBacked
          sheetData={occSheet.data}
          sheetSavedAt={occSheet.savedAt}
          sheetLoading={occSheet.loading || aiSheetHydrating}
          sheetError={occSheet.error}
          hideRefreshButton
        />
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
        Análisis agrupados por IA · Google Sheets
      </p>

      {data.questions.map((q) => {
        const gs = groupStates[q.questionId] ?? { groups: [], loading: aiSheetHydrating, error: '' }
        const answers = getAnswers(q.questionId)
        const showGrouped = q.type === 'open' && !q.skipGroupedIa
        return (
          <div key={q.questionId} className="space-y-3">
            {showGrouped && (
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
