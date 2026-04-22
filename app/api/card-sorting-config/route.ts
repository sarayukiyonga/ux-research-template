import { NextResponse } from 'next/server'
import {
  loadCardSortingConfigFromSheets,
  saveCardSortingConfigToSheets,
} from '@/lib/card-sorting-sheets'
import { loadCardSortingSubmissionsFromSheets } from '@/lib/card-sorting-submissions-sheets'
import { normalizeCardSortingConfig, type CardSortingConfig } from '@/lib/card-sorting-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [{ savedAt, config }, submissions] = await Promise.all([
      loadCardSortingConfigFromSheets(),
      loadCardSortingSubmissionsFromSheets(),
    ])
    return NextResponse.json({ savedAt, config, submissions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { config?: unknown }
    if (body.config == null) {
      return NextResponse.json({ error: 'Falta config' }, { status: 400 })
    }
    const config = normalizeCardSortingConfig(body.config) as CardSortingConfig
    const savedAt = await saveCardSortingConfigToSheets(config)
    return NextResponse.json({ ok: true, savedAt, config })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
