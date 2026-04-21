import { NextResponse } from 'next/server'
import { fetchSavedUserJourneyFromSheets } from '@/lib/fetch-saved-user-journey'
import { fetchSavedUserJourneyIdeasFromSheets } from '@/lib/fetch-saved-user-journey-ideas'
import { createEmptyIdeasPersist } from '@/lib/user-journey-ideas-persist'
import { buildMoscowScopeOptions } from '@/lib/moscow-scope-options'
import { MOSCOW_SCOPE_ALL } from '@/lib/moscow-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [journeyRes, ideasRes] = await Promise.all([
      fetchSavedUserJourneyFromSheets(),
      fetchSavedUserJourneyIdeasFromSheets(),
    ])

    if (!journeyRes.ok) {
      return NextResponse.json({
        options: [{ id: MOSCOW_SCOPE_ALL, label: 'Todos los canales' }],
      })
    }

    const ideas = ideasRes.ok ? ideasRes.data : createEmptyIdeasPersist()
    const options = buildMoscowScopeOptions(journeyRes.v3, ideas)
    return NextResponse.json({ options })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
