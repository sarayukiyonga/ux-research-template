'use client'

import { useMemo } from 'react'
import type { CardSortingConfig } from '@/lib/card-sorting-types'
import type { CardSortingSubmissionStored } from '@/lib/card-sorting-submissions-types'
import { buildSubmissionAggregation } from '@/lib/card-sorting-submissions-types'

export function CardSortingSubmissionsInsights({
  config,
  submissions,
}: {
  config: CardSortingConfig
  submissions: CardSortingSubmissionStored[]
}) {
  const agg = useMemo(
    () => buildSubmissionAggregation(config.cards, config.categories, submissions),
    [config.cards, config.categories, submissions]
  )

  if (agg.participantCount === 0) {
    return (
      <p className="text-sm text-gray-500">
        Aún no hay participaciones guardadas. Cada visitante en la página pública genera un ID anónimo y su
        ordenación se guarda sola al mover tarjetas.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-700">
        <strong className="text-gray-900">{agg.participantCount}</strong>{' '}
        {agg.participantCount === 1 ? 'persona ha' : 'personas han'} participado. La tabla resume cuántas veces cada
        tarjeta se colocó en cada categoría (todas las ordenaciones).
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-max border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-3 py-2 font-semibold text-gray-900">
                Tarjeta
              </th>
              {agg.columnOrder.map((col) => (
                <th
                  key={col}
                  className="max-w-[140px] px-2 py-2 font-semibold text-gray-800 align-bottom whitespace-normal"
                  title={col}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agg.rows.map((row) => (
              <tr key={row.card.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                <td className="sticky left-0 z-10 border-r border-gray-100 bg-white px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                  {row.card.label}
                </td>
                {agg.columnOrder.map((col) => {
                  const n = row.countsByColumn[col] ?? 0
                  return (
                    <td
                      key={col}
                      className={`px-2 py-2 text-center tabular-nums ${
                        n === 0 ? 'text-gray-300' : 'text-gray-900 font-semibold'
                      }`}
                    >
                      {n}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Detalle por participante</h3>
        <ul className="space-y-2">
          {agg.byParticipant.map((p) => (
            <li key={p.participantId} className="rounded-lg border border-gray-200 bg-gray-50/80">
              <details className="group">
                <summary className="cursor-pointer list-none px-3 py-2 text-sm text-gray-800 [&::-webkit-details-marker]:hidden flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-mono text-xs text-violet-700">{p.participantId.slice(0, 12)}…</span>
                    <span className="text-gray-500 text-xs ml-2">
                      {new Date(p.updatedAt).toLocaleString('es-ES', {
                        timeZone: 'Europe/Madrid',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </span>
                  <span className="text-xs text-violet-600 group-open:hidden">Ver ordenación</span>
                  <span className="text-xs text-violet-600 hidden group-open:inline">Ocultar</span>
                </summary>
                <ol className="border-t border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 space-y-1 list-decimal list-inside max-h-60 overflow-y-auto">
                  {p.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
