'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface QA {
  question: string
  answer: string
  themeLabel: string
}

interface CeoInsightsProps {
  qas: QA[]
}

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-lg font-bold text-gray-900 mt-6 mb-2 first:mt-0">
          {line.replace('## ', '')}
        </h2>
      )
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <li key={key++} className="ml-4 text-sm text-gray-700 leading-relaxed list-disc mb-1">
          {line.replace(/^[-•]\s/, '')}
        </li>
      )
    } else if (line.startsWith('---')) {
      elements.push(<hr key={key++} className="border-gray-200 my-3" />)
    } else if (line.trim() !== '') {
      elements.push(
        <p key={key++} className="text-sm text-gray-700 leading-relaxed mb-2">
          {line}
        </p>
      )
    }
  }
  return elements
}

export function CeoInsights({ qas }: CeoInsightsProps) {
  const [insights, setInsights] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function generate() {
      try {
        const res = await fetch('/api/ceo-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qas }),
        })
        if (!res.ok || !res.body) throw new Error(`Error ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let text = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (cancelled) return
          text += decoder.decode(value, { stream: true })
          setInsights(text)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    generate()
    return () => { cancelled = true }
  }, [])

  return (
    <Card className="w-full border-violet-200 bg-gradient-to-br from-violet-50 to-white">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">✦</span>
          <CardTitle className="text-base font-semibold text-violet-800">
            Informe estratégico — Análisis IA de la entrevista
          </CardTitle>
        </div>
        <p className="text-xs text-gray-400 mt-1">Generado automáticamente a partir de las respuestas de Patricia</p>
      </CardHeader>
      <CardContent>
        {loading && !insights && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-5 w-1/4 mt-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {insights && (
          <div className="space-y-0.5">
            {renderMarkdown(insights)}
            {loading && (
              <span className="inline-block h-4 w-0.5 bg-violet-400 animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
