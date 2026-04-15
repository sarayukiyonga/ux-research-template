'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { EmpathyMapPage, type EmpathySegment } from '@/components/EmpathyMapPage'

function EmpathyTabsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<EmpathySegment>('clientes')

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'potenciales' || t === 'clientes') {
      setTab(t)
    }
  }, [searchParams])

  const selectTab = useCallback(
    (next: EmpathySegment) => {
      setTab(next)
      const q = next === 'clientes' ? '' : '?tab=potenciales'
      router.replace(`${pathname}${q}`, { scroll: false })
    },
    [pathname, router]
  )

  return (
    <>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700 mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Conocimiento del cliente
        </div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Mapa de empatía</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Dos vistas: clientes actuales de MOA y público potencial. Cada pestaña usa solo su encuesta (más contexto de Patricia).
        </p>

        <div className="mt-5 flex rounded-xl border border-gray-200 bg-gray-100/80 p-1 max-w-md">
          <button
            type="button"
            onClick={() => selectTab('clientes')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'clientes'
                ? 'bg-white text-rose-700 shadow-sm border border-rose-100'
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

      <EmpathyMapPage key={tab} segment={tab} embedTabs />
    </>
  )
}

export function EmpathyTabbedView() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4 py-8">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-10 bg-gray-200 rounded max-w-md" />
        </div>
      }
    >
      <EmpathyTabsInner />
    </Suspense>
  )
}
