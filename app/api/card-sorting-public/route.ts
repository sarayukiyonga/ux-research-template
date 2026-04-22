import { NextResponse } from 'next/server'
import { loadCardSortingConfigFromSheets } from '@/lib/card-sorting-sheets'
import { MOSCOW_SCOPE_ALL } from '@/lib/moscow-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { savedAt, config } = await loadCardSortingConfigFromSheets()
    return NextResponse.json({
      savedAt,
      cards: config.cards,
      categories: config.categories,
      mvpScope: config.mvpScope ?? MOSCOW_SCOPE_ALL,
      mvpScopeLabel: config.mvpScopeLabel ?? 'Todos los canales',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
