'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { loadCache, saveCache, clearCache } from '@/lib/ai-cache'

interface PersonaCardProps {
  byQuestion: { questionId: number; answers: string[] }[]
  demographic: { men: string[]; women: string[]; nonBinary: string[] }
  apiPath?: string
  title?: string
  subtitle?: string
  cacheKey?: string
}

function renderLines(lines: string[]) {
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-xl font-bold text-gray-900 mt-2">
          {line.replace('## ', '')}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-sm font-semibold text-violet-700 uppercase tracking-wide mt-5 mb-1">
          {line.replace('### ', '')}
        </h3>
      )
    } else if (line.startsWith('**"') && line.endsWith('"**')) {
      elements.push(
        <blockquote key={key++} className="border-l-4 border-violet-300 pl-4 italic text-gray-600 text-base my-3">
          {line.replace(/\*\*/g, '')}
        </blockquote>
      )
    } else if (line.startsWith('- ')) {
      elements.push(
        <li key={key++} className="ml-4 text-sm text-gray-700 leading-relaxed list-disc">
          {line.replace('- ', '')}
        </li>
      )
    } else if (line.startsWith('---')) {
      elements.push(<hr key={key++} className="border-gray-200 my-4" />)
    } else if (line.trim() !== '') {
      elements.push(
        <p key={key++} className="text-sm text-gray-700 leading-relaxed">
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

  const completedLines = lines.slice(0, -1)
  const currentLine = lines[lines.length - 1]

  return [
    ...renderLines(completedLines),
    currentLine
      ? <span key="current" className="text-sm text-gray-700 leading-relaxed">{currentLine}</span>
      : null,
  ].filter(Boolean)
}

export function PersonaCard({
  byQuestion,
  demographic,
  apiPath = '/api/persona',
  title = 'User Persona — Cliente tipo de Patri',
  subtitle = 'Generado con IA a partir de todas las respuestas',
  cacheKey = 'persona_default',
}: PersonaCardProps) {
  const [persona, setPersona] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(false)
  const [savedAt, setSavedAt] = useState('')

  async function generate(force = false) {
    if (!force) {
      const cached = loadCache<string>(cacheKey)
      if (cached) {
        setPersona(cached.data)
        setSavedAt(cached.savedAt)
        setLoading(false)
        return
      }
    } else {
      clearCache(cacheKey)
    }

    setLoading(true)
    setStreaming(true)
    setError(false)
    setPersona('')
    setSavedAt('')

    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ byQuestion, demographic }),
      })

      if (!res.ok || !res.body) throw new Error('Error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setPersona(text)
      }

      const at = saveCache(cacheKey, text)
      setSavedAt(at)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  useEffect(() => {
    generate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card className="w-full border-violet-200 bg-linear-to-br from-violet-50 to-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✦</span>
            <CardTitle className="text-base font-semibold text-violet-800">
              {title}
            </CardTitle>
          </div>
          {!loading && (persona || error) && (
            <button
              onClick={() => generate(true)}
              className="shrink-0 text-xs px-3 py-1 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors font-medium"
            >
              ↺ Actualizar
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-gray-400">{subtitle}</p>
          {savedAt && !streaming && (
            <span className="text-xs text-gray-300">· Guardado el {savedAt}</span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading && !persona && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {!loading && error && !persona && (
          <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-xs text-red-500">No se pudo generar el perfil.</p>
            <button
              onClick={() => generate(true)}
              className="ml-3 text-xs px-3 py-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors shrink-0"
            >
              Reintentar
            </button>
          </div>
        )}

        {persona && (
          <div className="space-y-1 prose-sm max-w-none">
            {renderMarkdown(persona, streaming)}
            {streaming && (
              <span className="inline-block h-4 w-0.5 bg-violet-400 animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
