import { NextResponse } from 'next/server'
import { loadCardSortingConfigFromSheets } from '@/lib/card-sorting-sheets'
import { upsertCardSortingSubmissionToSheets } from '@/lib/card-sorting-submissions-sheets'
import { normalizeSubmitBody } from '@/lib/card-sorting-submissions-types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const raw = await req.json()
    const body = normalizeSubmitBody(raw)
    if (!body) {
      return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
    }

    const { config } = await loadCardSortingConfigFromSheets()
    const allowedCardIds = new Set(config.cards.map((c) => c.id))
    const presetCatIds = new Set(config.categories.map((c) => c.id))

    const assignments: Record<string, string> = {}
    for (const [cardId, catId] of Object.entries(body.assignments)) {
      if (!allowedCardIds.has(cardId)) continue
      assignments[cardId] = catId
    }

    const categoryLabels: Record<string, string> = { ...body.categoryLabels }
    for (const c of config.categories) {
      if (!categoryLabels[c.id]) categoryLabels[c.id] = c.label
    }

    for (const catId of Object.values(assignments)) {
      if (!presetCatIds.has(catId) && !categoryLabels[catId]?.trim()) {
        categoryLabels[catId] = 'Categoría'
      }
    }

    const { updatedAt } = await upsertCardSortingSubmissionToSheets(body.participantId, {
      participantId: body.participantId,
      assignments,
      categoryLabels,
    })

    return NextResponse.json({ ok: true, updatedAt })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
