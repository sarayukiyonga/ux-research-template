'use client'

import { useEffect, useState } from 'react'
import { QUESTIONS } from '@/lib/questions'
import { QuestionCard } from './QuestionCard'
import { DemographicCard } from './DemographicCard'
import { PersonaCard } from './PersonaCard'
import { OccupationsCard } from './OccupationsCard'
import { MedicalAdviceCard } from './MedicalAdviceCard'
import { Skeleton } from '@/components/ui/skeleton'

interface SurveyData {
  totalResponses: number
  lastUpdated: string
  byQuestion: { questionId: number; answers: string[] }[]
  demographic: { men: string[]; women: string[]; nonBinary: string[] }
}

export function SurveyDashboard() {
  const [data, setData] = useState<SurveyData | null>(null)
  const [error, setError] = useState('')

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

      {/* User Persona — generado automáticamente */}
      <PersonaCard byQuestion={data.byQuestion} demographic={data.demographic} />

      {/* Pregunta 1 — Demografía */}
      <DemographicCard
        men={data.demographic.men}
        women={data.demographic.women}
        nonBinary={data.demographic.nonBinary}
      />

        {/* Análisis destacado de ocupaciones */}
        <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-1">
          <OccupationsCard answers={getAnswers(2)} />
        </div>

        {/* Preguntas — con análisis destacados intercalados */}
        {QUESTIONS.map((q) => (
          <div key={q.id} className="space-y-4">
            {q.id === 3 && (
              <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-1">
                <MedicalAdviceCard answers={getAnswers(3)} />
              </div>
            )}
            <QuestionCard
              questionId={q.id}
              title={q.title}
              shortTitle={`Pregunta ${q.id} — ${q.shortTitle}`}
              answers={getAnswers(q.id)}
            />
          </div>
        ))}
    </div>
  )
}
