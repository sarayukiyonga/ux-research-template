'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface DemographicCardProps {
  men: string[]
  women: string[]
  nonBinary: string[]
}

function parseAges(answers: string[]) {
  const counts: Record<string, number> = {}
  for (const a of answers) {
    const clean = a.trim()
    if (!clean) continue
    counts[clean] = (counts[clean] ?? 0) + 1
  }
  return counts
}

function buildChartData(men: string[], women: string[], nonBinary: string[]) {
  const menCounts = parseAges(men)
  const womenCounts = parseAges(women)
  const nbCounts = parseAges(nonBinary)
  const allKeys = Array.from(
    new Set([...Object.keys(menCounts), ...Object.keys(womenCounts), ...Object.keys(nbCounts)])
  ).sort()
  return allKeys.map((key) => ({
    name: key,
    Hombres: menCounts[key] ?? 0,
    Mujeres: womenCounts[key] ?? 0,
    'No binario': nbCounts[key] ?? 0,
  }))
}

export function DemographicCard({ men, women, nonBinary }: DemographicCardProps) {
  const data = buildChartData(men, women, nonBinary)
  const total = men.length + women.length + nonBinary.length

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <Badge variant="secondary" className="text-xs font-normal truncate max-w-[75%]">
            Pregunta 1 — Edad y género
          </Badge>
          <Badge className="shrink-0 text-xs whitespace-nowrap">{total} resp.</Badge>
        </div>
        <CardTitle className="text-sm sm:text-base font-semibold leading-snug text-gray-800">
          Edad y género de los participantes
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary pills */}
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Hombres: <strong>{men.length}</strong>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1 text-sm text-pink-700">
            <span className="h-2 w-2 rounded-full bg-pink-400" />
            Mujeres: <strong>{women.length}</strong>
          </div>
          {nonBinary.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              No binario: <strong>{nonBinary.length}</strong>
            </div>
          )}
        </div>

        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Hombres" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Mujeres" fill="#f472b6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="No binario" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Sin datos disponibles</p>
        )}
      </CardContent>
    </Card>
  )
}
