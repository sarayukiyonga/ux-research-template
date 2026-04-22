'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

export interface Group {
  label: string
  count: number
  color: string
  examples: string[]
  interpretation: string
}

interface GroupedResponseCardProps {
  questionTitle: string
  shortTitle: string
  answers: string[]
  groups: Group[]
  loading: boolean
  error: string
  onRetry: () => void
}

export function GroupedResponseCard({
  questionTitle,
  shortTitle,
  answers,
  groups,
  loading,
  error,
  onRetry,
}: GroupedResponseCardProps) {
  const [selected, setSelected] = useState<Group | null>(null)

  if (answers.length === 0) return null

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="inline-flex flex-wrap items-center rounded-full border border-transparent bg-secondary text-secondary-foreground px-2 py-0.5 text-xs font-normal leading-snug min-w-0">
            {shortTitle} — Resumen agrupado
          </span>
          <Badge className="shrink-0 text-xs whitespace-nowrap mt-0.5">{answers.length} resp.</Badge>
        </div>
        <CardTitle className="text-sm sm:text-base font-semibold leading-snug text-gray-800">
          {questionTitle}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-xs text-red-500">{error}</p>
            <button
              onClick={onRetry}
              className="ml-3 text-xs px-3 py-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors shrink-0"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <p className="text-sm text-gray-500 py-4 text-center">
            Sin agrupación guardada en Sheets para esta pregunta. Usa «Generar análisis» arriba (o Reintentar si falló
            la IA).
          </p>
        )}

        {!loading && groups.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={Math.max(160, groups.length * 40)}>
              <BarChart
                data={groups}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={170}
                  tick={{ fontSize: 11, fill: '#374151' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const g = payload[0].payload as Group
                    return (
                      <div className="rounded-lg border bg-white shadow-sm px-3 py-2 text-xs max-w-xs">
                        <p className="font-semibold text-gray-800 mb-1">{g.label}</p>
                        <p className="text-gray-500">{g.interpretation}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {groups.map((g, i) => (
                    <Cell
                      key={i}
                      fill={g.color}
                      opacity={selected && selected.label !== g.label ? 0.25 : 1}
                      onClick={() => setSelected(selected?.label === g.label ? null : g)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.label}
                  onClick={() => setSelected(selected?.label === g.label ? null : g)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all"
                  style={{
                    borderColor: g.color,
                    backgroundColor: selected?.label === g.label ? g.color : 'transparent',
                    color: selected?.label === g.label ? '#fff' : g.color,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: selected?.label === g.label ? '#fff' : g.color }}
                  />
                  {g.label}
                  <span className="opacity-70">({g.count})</span>
                </button>
              ))}
            </div>

            {selected && (
              <div
                className="rounded-xl p-4 space-y-3"
                style={{
                  backgroundColor: selected.color + '12',
                  borderLeft: `3px solid ${selected.color}`,
                }}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-0.5">{selected.label}</p>
                  <p className="text-xs text-gray-500">{selected.interpretation}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-600">Ejemplos de respuestas:</p>
                  {selected.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-white px-3 py-2 text-xs text-gray-700 italic border border-gray-100"
                    >
                      {`\u201C${ex}\u201D`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
