import type { CardSortingConfig } from '@/lib/card-sorting-types'
import type { CardSortingSubmissionStored } from '@/lib/card-sorting-submissions-types'
import { buildSubmissionAggregation } from '@/lib/card-sorting-submissions-types'

/** Texto para el prompt del mapa del sitio: agregación de card sorting (participantes reales). */
export function buildCardSortingBlockForSitemapIa(
  config: CardSortingConfig,
  submissions: CardSortingSubmissionStored[]
): string {
  if (config.cards.length === 0) {
    return `No hay tarjetas guardadas en la configuración de card sorting. Ignora esta sección para la arquitectura.`
  }

  if (submissions.length === 0) {
    return [
      `Hay ${config.cards.length} tarjetas definidas en card sorting, pero **0 participaciones** guardadas aún.`,
      `Tarjetas del ejercicio (referencia de vocabulario y piezas de la web): ${config.cards.map((c) => `"${c.label}"`).join(', ')}.`,
      `Categorías previstas en el ejercicio: ${config.categories.map((c) => c.label).join(' · ')}.`,
      `Sin datos de participantes, usa sobre todo el MVP para el mapa; las categorías anteriores solo orientan el lenguaje.`,
    ].join('\n')
  }

  const agg = buildSubmissionAggregation(config.cards, config.categories, submissions)
  const n = agg.participantCount
  const lines: string[] = [
    `**${n}** ${n === 1 ? 'persona participó' : 'personas participaron'} en el card sorting (ordenación de tarjetas en categorías).`,
    `Ámbito MVP asociado a la configuración (si aplica): ${config.mvpScopeLabel ?? '—'}.`,
    '',
    '**Distribución agregada** (por tarjeta: categoría → nº de participantes que la colocaron ahí; útil para ver consenso):',
    '',
  ]

  for (const row of agg.rows) {
    const bits = agg.columnOrder
      .map((col) => {
        const c = row.countsByColumn[col] ?? 0
        return c > 0 ? `${col}: ${c}/${n}` : null
      })
      .filter((x): x is string => x !== null)
    const dominant = [...agg.columnOrder]
      .filter((col) => col !== 'Sin clasificar')
      .reduce<{ col: string; c: number } | null>((acc, col) => {
        const c = row.countsByColumn[col] ?? 0
        if (c === 0) return acc
        if (!acc || c > acc.c) return { col, c }
        return acc
      }, null)
    const domStr =
      dominant && dominant.c > 0 ? ` → predominio relativo: «${dominant.col}» (${dominant.c}/${n})` : ''
    lines.push(`- **${row.card.label}**${domStr}`)
    if (bits.length) lines.push(`  ${bits.join(' · ')}`)
  }

  lines.push('')
  lines.push(
    '**Cómo usar esto en el mapa del sitio:** las tarjetas con fuerte consenso en una misma categoría (p. ej. «menú principal») deberían quedar visibles en la navegación principal o en la portada; lo que muchos dejaron «secundario» o «sin clasificar» puede ir a secciones secundarias o reforzar el etiquetado. No contradigas el MVP: el card sorting refuerza **cómo agrupan los usuarios** las piezas, no sustituye prioridad de negocio.'
  )

  return lines.join('\n')
}
