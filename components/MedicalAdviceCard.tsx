'use client'

import { useEffect, useState } from 'react'
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

interface Group {
  label: string
  count: number
  color: string
  examples: string[]
  interpretation: string
}

interface MedicalAdviceCardProps {
  answers: string[]
}

export function MedicalAdviceCard({ answers }: MedicalAdviceCardProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Group | null>(null)

  useEffect(() => {
    if (answers.length === 0) { setLoading(false); return }

    fetch('/api/medical-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Badge variant="secondary" className="mb-2 text-xs font-normal">
              Pregunta 3 — Situación de salud previa
            </Badge>
            <CardTitle className="text-base font-semibold leading-snug text-gray-800">
              ¿Qué les decían los médicos? Recomendaciones agrupadas por similitud
            </CardTitle>
          </div>
          <Badge className="shrink-0 text-xs">{answers.length} respuestas</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {!loading && groups.length > 0 && (
          <>
            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={groups}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                style={{ cursor: 'pointer' }}
              >
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={160}
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
                      opacity={selected && selected.label !== g.label ? 0.3 : 1}
                      onClick={() => setSelected(selected?.label === g.label ? null : g)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Group pills */}
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
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: selected?.label === g.label ? '#fff' : g.color }}
                  />
                  {g.label}
                  <span className="ml-0.5 opacity-70">({g.count})</span>
                </button>
              ))}
            </div>

            {/* Detail panel */}
            {selected && (
              <div
                className="rounded-xl p-4 space-y-3"
                style={{ backgroundColor: selected.color + '10', borderLeft: `3px solid ${selected.color}` }}
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
                      "{ex}"
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
