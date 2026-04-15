'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { QUESTIONS } from '@/lib/questions'
import { QuestionCard } from './QuestionCard'
import { DemographicCard } from './DemographicCard'
import { PersonaCard } from './PersonaCard'
import { OccupationsCard, type OccupationResult } from './OccupationsCard'
import { GroupedResponseCard, type Group } from './GroupedResponseCard'
import { FilterBar, type ActiveFilters, type FilterOptions } from './FilterBar'
import { Skeleton } from '@/components/ui/skeleton'
import { readSegmentSurveyFilters, writeSegmentSurveyFilters } from '@/lib/segment-survey-filters'
import { stableFiltersKey, toSurveyAiFiltersPayload } from '@/lib/survey-ai-filters'

interface SurveyData {
  totalResponses: number
  totalAll: number
  lastUpdated: string
  byQuestion: { questionId: number; answers: string[] }[]
  demographic: { men: string[]; women: string[]; nonBinary: string[] }
  filterOptions: FilterOptions
}

interface GroupState {
  groups: Group[]
  loading: boolean
  error: string
  savedAt?: string
}

const SKIP_GROUPED = [2]
const GROUPED_QUESTIONS = QUESTIONS.filter((q) => !SKIP_GROUPED.includes(q.id))

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

  const latestBundleRef = useRef({
    personaText: '',
    occupationData: null as OccupationResult | null,
    groupStates: {} as Record<number, GroupState>,
  })

  useEffect(() => {
    latestBundleRef.current = {
      personaText: personaSheet.text,
      occupationData: occSheet.data,
      groupStates,
    }
  }, [personaSheet.text, occSheet.data, groupStates])

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
          for (const q of GROUPED_QUESTIONS) {
            const arr = (rawGroups[String(q.id)] ?? rawGroups[q.id] ?? []) as Group[]
            nextStates[q.id] = {
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
          for (const q of GROUPED_QUESTIONS) {
            empty[q.id] = { groups: [], loading: false, error: '' }
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
          for (const q of GROUPED_QUESTIONS) {
            empty[q.id] = { groups: [], loading: false, error: '' }
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
  }, [data, filtersKey, filtersPayload])

  useEffect(() => {
    setData(null)
    setError('')
    setAiSheetHydrating(false)
    fetch(filtersToQuery(filters))
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else {
          setAiSheetHydrating(true)
          setData(d)
        }
      })
      .catch(() => setError('No se pudo conectar con la hoja de cálculo.'))
  }, [filters])

  async function handleRefreshAll() {
    if (!data) return
    setRefreshing(true)
    setPersonaSheet((p) => ({ ...p, loading: true, error: false }))
    setOccSheet((o) => ({ ...o, loading: true, error: '' }))
    for (const q of GROUPED_QUESTIONS) {
      setGroupState(q.id, { loading: true, error: '', groups: [] })
    }

    const getAnswers = (id: number) => data.byQuestion.find((x) => x.questionId === id)?.answers ?? []

    try {
      const personaRes = await fetch('/api/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ byQuestion: data.byQuestion, demographic: data.demographic, stream: false }),
      })
      if (!personaRes.ok) throw new Error(await personaRes.text())
      const personaJson = await personaRes.json()
      const personaText = typeof personaJson.text === 'string' ? personaJson.text : ''

      const occAns = getAnswers(2)
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
        GROUPED_QUESTIONS.map(async (q) => {
          const answers = getAnswers(q.id)
          if (answers.length < 4) return { id: q.id, groups: [] as Group[] }
          const groups = await fetchGroups(q.title, answers)
          return { id: q.id, groups }
        })
      )

      const groupsRecord: Record<number, Group[]> = {}
      for (const { id, groups } of groupResults) {
        groupsRecord[id] = groups
      }

      const savedAt = await postSurveyAiSave(groupsRecord, personaText, occData)

      for (const q of GROUPED_QUESTIONS) {
        setGroupState(q.id, {
          loading: false,
          groups: groupsRecord[q.id] ?? [],
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
      for (const q of GROUPED_QUESTIONS) {
        setGroupState(q.id, { loading: false, groups: [], error: msg })
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
        const { personaText, occupationData, groupStates: gs } = latestBundleRef.current
        const groupsRecord: Record<number, Group[]> = {}
        for (const q of GROUPED_QUESTIONS) {
          groupsRecord[q.id] = q.id === questionId ? groups : (gs[q.id]?.groups ?? [])
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

  const hasSheetBundle = Boolean(aiBundleSavedAt)

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
          answers={getAnswers(2)}
          sheetBacked
          sheetData={occSheet.data}
          sheetSavedAt={occSheet.savedAt}
          sheetLoading={occSheet.loading || aiSheetHydrating}
          sheetError={occSheet.error}
          hideRefreshButton
        />
      </div>

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Análisis agrupados por IA · Google Sheets
        </p>
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

      {QUESTIONS.map((q) => {
        const gs = groupStates[q.id] ?? { groups: [], loading: aiSheetHydrating, error: '' }
        const answers = getAnswers(q.id)
        return (
          <div key={q.id} className="space-y-3">
            {!SKIP_GROUPED.includes(q.id) && (
              <div className="rounded-2xl border-2 border-violet-200 bg-linear-to-br from-violet-50 to-white p-1">
                <GroupedResponseCard
                  questionTitle={q.title}
                  shortTitle={`Pregunta ${q.id} — ${q.shortTitle}`}
                  answers={answers}
                  groups={gs.groups}
                  loading={gs.loading || aiSheetHydrating}
                  error={gs.error}
                  onRetry={() => void retryOneGroup(q.id, q.title, answers)}
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
