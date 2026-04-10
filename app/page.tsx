import { SurveyDashboard } from '@/components/SurveyDashboard'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
            Resultados en tiempo real
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Encuesta de satisfacción
              </h1>
              <p className="mt-1 text-gray-500 text-sm">
                Análisis de respuestas · Entrenamiento con Patri
              </p>
            </div>
            <Link
              href="/ceo"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 transition-colors shadow-sm"
            >
              <span>✦</span>
              Entrevista CEO →
            </Link>
          </div>
        </div>

        <SurveyDashboard />
      </div>
    </main>
  )
}
