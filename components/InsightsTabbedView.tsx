'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { SurveyInsightsPage, type InsightsSegment } from '@/components/SurveyInsightsPage'

function InsightsTabsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<InsightsSegment>('clientes')

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'potenciales' || t === 'clientes') {
      setTab(t)
    }
  }, [searchParams])

  const selectTab = useCallback(
    (next: InsightsSegment) => {
      setTab(next)
      const q = next === 'clientes' ? '' : '?tab=potenciales'
      router.replace(`${pathname}${q}`, { scroll: false })
    },
    [pathname, router]
  )

  return (
    <>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Conocimiento del cliente
        </div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Insights</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Hallazgos a partir del mapa de empatía guardado; los filtros de encuesta se eligen en /survey y /potential.
        </p>

        <div className="mt-5 flex rounded-xl border border-gray-200 bg-gray-100/80 p-1 max-w-md">
          <button
            type="button"
            onClick={() => selectTab('clientes')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'clientes'
                ? 'bg-white text-amber-900 shadow-sm border border-amber-100'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Clientes actuales
          </button>
          <button
            type="button"
            onClick={() => selectTab('potenciales')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'potenciales'
                ? 'bg-white text-orange-800 shadow-sm border border-orange-100'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Clientes potenciales
          </button>
        </div>
      </div>

      <SurveyInsightsPage key={tab} segment={tab} embedTabs />
    </>
  )
}

export function InsightsTabbedView() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4 py-8">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-10 bg-gray-200 rounded max-w-md" />
        </div>
      }
    >
      <InsightsTabsInner />
    </Suspense>
  )
}
