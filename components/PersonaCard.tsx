'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface PersonaCardProps {
  byQuestion: { questionId: number; answers: string[] }[]
  demographic: { men: string[]; women: string[]; nonBinary: string[] }
}

function renderMarkdown(text: string) {
  const lines = text.split('\n')
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

export function PersonaCard({ byQuestion, demographic }: PersonaCardProps) {
  const [persona, setPersona] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function generate() {
      try {
        const res = await fetch('/api/persona', {
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
          if (cancelled) return
          text += decoder.decode(value, { stream: true })
          setPersona(text)
        }
      } catch {
        if (!cancelled) setPersona('Error al generar el User Persona. Recarga la página.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    generate()
    return () => { cancelled = true }
  }, [])

  return (
    <Card className="w-full border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✦</span>
          <CardTitle className="text-base font-semibold text-violet-800">
            User Persona — Cliente tipo de Patri
          </CardTitle>
        </div>
        <p className="text-xs text-gray-400 mt-1">Generado con IA a partir de todas las respuestas</p>
      </CardHeader>

      <CardContent>
        {loading && !persona ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="space-y-1 prose-sm max-w-none">
            {renderMarkdown(persona)}
            {loading && (
              <span className="inline-block h-4 w-0.5 bg-violet-400 animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
