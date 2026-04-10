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

function renderLines(lines: string[]) {
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

function renderMarkdown(text: string, isStreaming = false) {
  const lines = text.split('\n')
  if (!isStreaming) return renderLines(lines)

  // While streaming: render completed lines with markdown,
  // show the in-progress last line as plain text to avoid flickering
  const completedLines = lines.slice(0, -1)
  const currentLine = lines[lines.length - 1]

  return [
    ...renderLines(completedLines),
    currentLine
      ? <span key="current" className="text-sm text-gray-700 leading-relaxed">{currentLine}</span>
      : null,
  ].filter(Boolean)
}

export function CeoInsights({ qas }: CeoInsightsProps) {
  const [insights, setInsights] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function generate() {
    setLoading(true)
    setError(false)
    setInsights('')

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
        text += decoder.decode(value, { stream: true })
        setInsights(text)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card className="w-full border-violet-200 bg-gradient-to-br from-violet-50 to-white">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">✦</span>
            <CardTitle className="text-base font-semibold text-violet-800">
              Informe estratégico — Análisis IA de la entrevista
            </CardTitle>
          </div>
          {!loading && (error || insights) && (
            <button
              onClick={generate}
              className="shrink-0 text-xs px-3 py-1 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors font-medium"
            >
              ↺ Reintentar
            </button>
          )}
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

        {!loading && error && !insights && (
          <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-xs text-red-500">No se pudo generar el informe estratégico.</p>
            <button
              onClick={generate}
              className="ml-3 text-xs px-3 py-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors shrink-0"
            >
              Reintentar
            </button>
          </div>
        )}

        {insights && (
          <div className="space-y-0.5">
            {renderMarkdown(insights, loading)}
            {loading && (
              <span className="inline-block h-4 w-0.5 bg-violet-400 animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
