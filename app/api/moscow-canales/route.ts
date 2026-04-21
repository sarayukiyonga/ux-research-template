import { NextResponse } from 'next/server'
import { fetchSavedUserJourneyFromSheets } from '@/lib/fetch-saved-user-journey'
import { JOURNEY_BASE_CANAL_ID } from '@/lib/user-journey-channels'
import { MOSCOW_UI_SCOPE_GENERIC } from '@/lib/moscow-types'

export const dynamic = 'force-dynamic'

/** Pestañas MoSCoW: «Todos los canales» + canales del catálogo (sin duplicar journey_base). */
export async function GET() {
  try {
    const journey = await fetchSavedUserJourneyFromSheets()
    if (!journey.ok) {
      return NextResponse.json({ tabs: [{ id: MOSCOW_UI_SCOPE_GENERIC, label: 'Todos los canales' }] })
    }

    const seen = new Set<string>()
    const extras: { id: string; label: string }[] = []

    for (const seg of [journey.v3.clienteActual, journey.v3.clientePotencial]) {
      for (const c of seg.catalogo) {
        if (c.id === JOURNEY_BASE_CANAL_ID) continue
        if (seen.has(c.id)) continue
        seen.add(c.id)
        extras.push({ id: c.id, label: c.label })
      }
    }

    extras.sort((a, b) => a.label.localeCompare(b.label, 'es'))

    return NextResponse.json({
      tabs: [{ id: MOSCOW_UI_SCOPE_GENERIC, label: 'Todos los canales' }, ...extras],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
