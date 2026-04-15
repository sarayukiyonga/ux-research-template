'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { loadCache, saveCache, clearCache } from '@/lib/ai-cache'

interface CategoryData {
  count: number
  mainRisks: string[]
}

export interface OccupationResult {
  categorized: {
    profession: string
    category: string
    physicalRisks: string[]
  }[]
  summary: {
    sedentaria: CategoryData
    dePieProlongado: CategoryData
    trabajoFisicoIntenso: CategoryData
    mixta: CategoryData
    jubilada: CategoryData
  }
}

interface OccupationsCardProps {
  answers: string[]
  cacheKey?: string
  sheetBacked?: boolean
  sheetData?: OccupationResult | null
  sheetSavedAt?: string
  sheetLoading?: boolean
  sheetError?: string
  hideRefreshButton?: boolean
}

const CATEGORIES = [
  {
    key: 'sedentaria' as const,
    label: 'Sedentaria',
    color: '#7c3aed',
    icon: '💻',
    description: 'Oficina, administración, conducción...',
  },
  {
    key: 'dePieProlongado' as const,
    label: 'De pie prolongado',
    color: '#2563eb',
    icon: '🛍️',
    description: 'Comercio, hostelería, peluquería...',
  },
  {
    key: 'trabajoFisicoIntenso' as const,
    label: 'Trabajo físico intenso',
    color: '#dc2626',
    icon: '🔧',
    description: 'Construcción, limpieza, agricultura...',
  },
  {
    key: 'mixta' as const,
    label: 'Mixta',
    color: '#d97706',
    icon: '🔄',
    description: 'Docente, comercial, sanitario...',
  },
  {
    key: 'jubilada' as const,
    label: 'Jubilada/o | Parada/o',
    color: '#059669',
    icon: '🌿',
    description: 'Retirada del mercado laboral o sin empleo',
  },
]

export function OccupationsCard({
  answers,
  cacheKey = 'occupations',
  sheetBacked = false,
  sheetData = null,
  sheetSavedAt = '',
  sheetLoading = false,
  sheetError = '',
  hideRefreshButton = false,
}: OccupationsCardProps) {
  const [data, setData] = useState<OccupationResult | null>(sheetBacked ? sheetData : null)
  const [loading, setLoading] = useState(sheetBacked ? sheetLoading : true)
  const [error, setError] = useState(sheetBacked ? sheetError : '')
  const [selected, setSelected] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState(sheetBacked ? sheetSavedAt : '')

  useEffect(() => {
    if (!sheetBacked) return
    setData(sheetData)
    setSavedAt(sheetSavedAt)
    setLoading(sheetLoading)
    setError(sheetError)
  }, [sheetBacked, sheetData, sheetSavedAt, sheetLoading, sheetError])

  async function load(force = false) {
    if (sheetBacked) return
    if (answers.length === 0) { setLoading(false); return }

    if (!force) {
      const cached = loadCache<OccupationResult>(cacheKey)
      if (cached) {
        setData(cached.data)
        setSavedAt(cached.savedAt)
        setLoading(false)
        return
      }
    } else {
      clearCache(cacheKey)
    }

    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/occupations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const d = await r.json()
      setData(d)
      const at = saveCache(cacheKey, d)
      setSavedAt(at)
    } catch {
      setError('Error al analizar las profesiones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sheetBacked) return
    load()
  }, [sheetBacked]) // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = data
    ? CATEGORIES.map((c) => ({
        name: c.label,
        value: data.summary[c.key].count,
        color: c.color,
      })).filter((d) => d.value > 0)
    : []

  const selectedCategory = selected
    ? CATEGORIES.find((c) => c.label === selected)
    : null

  const selectedProfessions = selected && data
    ? data.categorized.filter((p) => p.category === selected)
    : []

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="inline-flex flex-wrap items-center rounded-full border border-transparent bg-secondary text-secondary-foreground px-2 py-0.5 text-xs font-normal leading-snug min-w-0">
            Pregunta 2 — Ocupación
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {!sheetBacked && !hideRefreshButton && !loading && data && (
              <button
                onClick={() => load(true)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-100 transition-colors"
              >
                ↺ Actualizar
              </button>
            )}
            <Badge className="text-xs whitespace-nowrap mt-0.5">{answers.length} resp.</Badge>
          </div>
        </div>
        <CardTitle className="text-sm sm:text-base font-semibold leading-snug text-gray-800">
          Profesiones por carga física y riesgo musculoesquelético
        </CardTitle>
        {savedAt && !loading && (
          <p className="text-xs text-gray-300 mt-1">Guardado el {savedAt}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        {sheetBacked && !loading && !error && !data && answers.length > 0 && (
          <p className="text-sm text-gray-500 py-6 text-center">
            No hay análisis de ocupaciones guardado en Sheets para estos filtros. Pulsa «Generar análisis» arriba.
          </p>
        )}

        {data && (
          <>
            {/* Pie chart */}
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  onClick={(entry) =>
                    setSelected(selected === entry.name ? null : entry.name ?? null)
                  }
                  style={{ cursor: 'pointer' }}
                >
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      opacity={selected && selected !== entry.name ? 0.3 : 1}
                      stroke={selected === entry.name ? '#1f2937' : 'transparent'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} personas`, '']}
                  contentStyle={{ borderRadius: '8px', fontSize: 12 }}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Category cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {CATEGORIES.filter((c) => data.summary[c.key].count > 0).map((cat) => {
                const catData = data.summary[cat.key]
                const isSelected = selected === cat.label
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelected(isSelected ? null : cat.label)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'border-gray-900 bg-gray-50 shadow-sm'
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="font-semibold text-sm text-gray-800">{cat.label}</span>
                      <span
                        className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: cat.color }}
                      >
                        {catData.count}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {catData.mainRisks.map((risk, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                          {risk}
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Drill-down: professions in selected category */}
            {selectedCategory && selectedProfessions.length > 0 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">
                  {selectedCategory.icon} {selectedCategory.label} — detalle de profesiones
                </p>
                <div className="space-y-2">
                  {selectedProfessions.map((p, i) => (
                    <div key={i} className="rounded-lg bg-white border border-gray-100 px-3 py-2">
                      <p className="text-sm font-medium text-gray-800">{p.profession}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.physicalRisks.map((risk, j) => (
                          <span
                            key={j}
                            className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
                          >
                            {risk}
                          </span>
                        ))}
                      </div>
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
