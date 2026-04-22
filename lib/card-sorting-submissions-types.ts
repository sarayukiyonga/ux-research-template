import type { CardSortingCard, CardSortingCategory } from '@/lib/card-sorting-types'

/** Cuerpo enviado por el cliente (autosave). */
export interface CardSortingSubmitBody {
  participantId: string
  assignments: Record<string, string>
  /** id de categoría → etiqueta visible en el momento del guardado. */
  categoryLabels: Record<string, string>
}

/** Documento almacenado (celda JSON + columnas A/B en Sheets). */
export interface CardSortingSubmissionStored extends CardSortingSubmitBody {
  updatedAt: string
}

const PID_RE = /^[a-zA-Z0-9_-]{8,80}$/

export function isValidParticipantId(id: unknown): id is string {
  return typeof id === 'string' && PID_RE.test(id)
}

export function normalizeSubmitBody(raw: unknown): CardSortingSubmitBody | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isValidParticipantId(o.participantId)) return null
  const assignments: Record<string, string> = {}
  if (o.assignments && typeof o.assignments === 'object') {
    for (const [k, v] of Object.entries(o.assignments as Record<string, unknown>)) {
      const cardId = String(k).trim().slice(0, 80)
      const catId = typeof v === 'string' ? v.trim().slice(0, 80) : ''
      if (cardId && catId) assignments[cardId] = catId
    }
  }
  const categoryLabels: Record<string, string> = {}
  if (o.categoryLabels && typeof o.categoryLabels === 'object') {
    for (const [k, v] of Object.entries(o.categoryLabels as Record<string, unknown>)) {
      const id = String(k).trim().slice(0, 80)
      const lab = typeof v === 'string' ? v.trim().slice(0, 120) : ''
      if (id && lab) categoryLabels[id] = lab
    }
  }
  return { participantId: o.participantId.trim(), assignments, categoryLabels }
}

export function parseSubmissionRowJson(jsonStr: unknown): CardSortingSubmissionStored | null {
  if (typeof jsonStr !== 'string' || !jsonStr.trim()) return null
  try {
    const raw = JSON.parse(jsonStr) as unknown
    const base = normalizeSubmitBody(raw)
    if (!base) return null
    const o = raw as Record<string, unknown>
    const updatedAt =
      typeof o.updatedAt === 'string' && o.updatedAt.trim() ? o.updatedAt.trim() : new Date(0).toISOString()
    return { ...base, updatedAt }
  } catch {
    return null
  }
}

/** Etiqueta de columna para agregación (preset por id actual; extra por texto guardado). */
export function resolveAssignmentColumnLabel(
  submission: CardSortingSubmissionStored,
  cardId: string,
  presetCategories: CardSortingCategory[]
): string {
  const catId = submission.assignments[cardId]
  if (!catId) return 'Sin clasificar'
  const preset = presetCategories.find((c) => c.id === catId)
  if (preset) return preset.label
  const custom = submission.categoryLabels[catId]
  return custom?.trim() || 'Categoría sin nombre'
}

export interface AggregatedCell {
  card: CardSortingCard
  countsByColumn: Record<string, number>
}

export function buildSubmissionAggregation(
  cards: CardSortingCard[],
  presetCategories: CardSortingCategory[],
  submissions: CardSortingSubmissionStored[]
): {
  participantCount: number
  columnOrder: string[]
  rows: AggregatedCell[]
  byParticipant: { participantId: string; updatedAt: string; lines: string[] }[]
} {
  const participantCount = submissions.length

  const columnKeySet = new Set<string>()
  columnKeySet.add('Sin clasificar')
  for (const c of presetCategories) columnKeySet.add(c.label)

  for (const sub of submissions) {
    for (const card of cards) {
      columnKeySet.add(resolveAssignmentColumnLabel(sub, card.id, presetCategories))
    }
  }

  const presetOrder = ['Sin clasificar', ...presetCategories.map((c) => c.label)]
  const rest = Array.from(columnKeySet).filter((l) => !presetOrder.includes(l))
  rest.sort((a, b) => a.localeCompare(b, 'es'))
  const columnOrder = [...presetOrder.filter((l) => columnKeySet.has(l)), ...rest]

  const rows: AggregatedCell[] = cards.map((card) => {
    const countsByColumn: Record<string, number> = {}
    for (const col of columnOrder) countsByColumn[col] = 0
    for (const sub of submissions) {
      const lab = resolveAssignmentColumnLabel(sub, card.id, presetCategories)
      const key = columnOrder.includes(lab) ? lab : lab
      countsByColumn[key] = (countsByColumn[key] ?? 0) + 1
    }
    return { card, countsByColumn }
  })

  const byParticipant = submissions
    .map((sub) => {
      const lines = cards.map((card) => {
        const lab = resolveAssignmentColumnLabel(sub, card.id, presetCategories)
        return `${card.label} → ${lab}`
      })
      return {
        participantId: sub.participantId,
        updatedAt: sub.updatedAt,
        lines,
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return { participantCount, columnOrder, rows, byParticipant }
}
