'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CeoInsights } from './CeoInsights'
import { CeoSheetLinkHelp } from './CeoSheetLinkHelp'
import { THEME_COLORS } from '@/lib/ceo-questions'

interface QA {
  id: number
  question: string
  answer: string
  theme: string
  themeLabel: string
}

interface CeoData {
  timestamp: string
  qas: QA[]
}

function ThemeDot({ theme }: { theme: string }) {
  const color = THEME_COLORS[theme as keyof typeof THEME_COLORS] ?? '#6b7280'
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0 mt-1.5"
      style={{ backgroundColor: color }}
    />
  )
}

function QACard({ qa, index }: { qa: QA; index: number }) {
  const [open, setOpen] = useState(false)
  const color = THEME_COLORS[qa.theme as keyof typeof THEME_COLORS] ?? '#6b7280'
  const preview = qa.answer.slice(0, 120) + (qa.answer.length > 120 ? '…' : '')

  return (
    <Card className="w-full overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left cursor-pointer">
        <CardHeader className="pb-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span
              className="inline-flex flex-wrap items-center rounded-full px-2 py-0.5 text-xs font-medium leading-snug"
              style={{ backgroundColor: color + '18', color }}
            >
              {qa.themeLabel} · Pregunta {index + 1}
            </span>
            <span
              className="text-gray-400 transition-transform duration-200 shrink-0"
              style={{ fontSize: '28px', lineHeight: 1, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              ▾
            </span>
          </div>
          <CardTitle className="text-sm sm:text-base font-semibold leading-snug text-gray-800">
            {qa.question}
          </CardTitle>
          {!open && (
            <p className="text-xs text-gray-400 mt-2 italic leading-relaxed">
              {preview}
            </p>
          )}
        </CardHeader>
      </button>

      {open && (
        <CardContent className="pt-0 border-t border-gray-100">
          <div
            className="mt-3 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border-l-4"
            style={{ borderColor: color, backgroundColor: color + '08' }}
          >
            {qa.answer}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function CeoDashboard({
  ownerFullName,
  ownerRole,
  businessName,
}: {
  ownerFullName: string
  ownerRole: string
  businessName: string
}) {
  const [data, setData] = useState<CeoData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/ceo')
      .then(async (r) => {
        const d = (await r.json()) as { error?: string; qas?: QA[]; timestamp?: string }
        if (!r.ok || d.error) {
          setError(d.error ?? `Error ${r.status}: no se pudo cargar la entrevista.`)
          return
        }
        setData(d as CeoData)
      })
      .catch(() => setError('No se pudo conectar con el servidor. Comprueba la red y que la app esté en marcha.'))
  }, [])

  if (error) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-start px-1 py-4">
        <div className="w-full max-w-xl text-center space-y-2">
          <p className="text-red-600 font-semibold">No se pudo cargar la entrevista CEO</p>
          <p className="text-sm text-gray-600 leading-relaxed">{error}</p>
        </div>
        <CeoSheetLinkHelp />
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

  const themeGroups = Object.entries(
    data.qas.reduce<Record<string, QA[]>>((acc, qa) => {
      if (!acc[qa.theme]) acc[qa.theme] = []
      acc[qa.theme].push(qa)
      return acc
    }, {})
  )

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Preguntas</p>
          <p className="mt-1 text-3xl font-bold text-violet-700">{data.qas.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Entrevistada</p>
          <p className="mt-1 text-sm font-bold text-gray-800">{ownerFullName}</p>
          <p className="text-xs text-gray-400">
            {ownerRole} · {businessName}
          </p>
        </div>
      </div>

      {/* Theme legend */}
      <div className="flex flex-wrap gap-2">
        {themeGroups.map(([theme, qs]) => {
          const color = THEME_COLORS[theme as keyof typeof THEME_COLORS] ?? '#6b7280'
          return (
            <span
              key={theme}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: color + '18', color }}
            >
              <ThemeDot theme={theme} />
              {qs[0].themeLabel} ({qs.length})
            </span>
          )
        })}
      </div>

      {/* AI Insights */}
      <CeoInsights qas={data.qas} />

      {/* Q&A Cards */}
      <div className="space-y-3">
        {data.qas.map((qa, i) => (
          <QACard key={qa.id} qa={qa} index={i} />
        ))}
      </div>
    </div>
  )
}
