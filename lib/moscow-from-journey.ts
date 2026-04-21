import { JOURNEY_BASE_CANAL_ID, getCanalPromptFields } from '@/lib/user-journey-channels'
import { journeySegmentToMoSCoWBlock } from '@/lib/fetch-saved-user-journey'
import {
  getIdeasForSegmentChannel,
  ideasToMoSCoWPromptBlock,
  type UserJourneyIdeasPersist,
} from '@/lib/user-journey-ideas-persist'
import type { UserJourneyV3Persist } from '@/lib/user-journey-persist'
import { MOSCOW_UI_SCOPE_GENERIC } from '@/lib/moscow-types'

/** Ideas FUNC/CONT del journey para el ámbito MoSCoW (genérico = todos los canales / journey_base). */
export function countJourneyIdeasForMoSCoWScope(
  ideas: UserJourneyIdeasPersist,
  uiScope: string
): number {
  const canalId = uiScope === MOSCOW_UI_SCOPE_GENERIC ? JOURNEY_BASE_CANAL_ID : uiScope
  return (
    getIdeasForSegmentChannel(ideas, 'clienteActual', canalId).length +
    getIdeasForSegmentChannel(ideas, 'clientePotencial', canalId).length
  )
}

/** Bloque de texto journey + ideas solo para un canal (o todos los canales si scope es genérico). */
export function buildJourneyMoSCoWPromptBlock(
  v3: UserJourneyV3Persist,
  ideas: UserJourneyIdeasPersist,
  uiScope: string
): string | null {
  const canalFilter = uiScope === MOSCOW_UI_SCOPE_GENERIC ? JOURNEY_BASE_CANAL_ID : uiScope
  const parts: string[] = []
  let anyMap = false

  for (const seg of ['clienteActual', 'clientePotencial'] as const) {
    const st = v3[seg]
    const segHuman = seg === 'clienteActual' ? 'Cliente actual' : 'Cliente potencial'
    for (const canal of st.catalogo) {
      if (canal.id !== canalFilter) continue
      const j = st.mapas[canal.id]
      if (!j?.etapas?.length) continue
      anyMap = true
      const meta = getCanalPromptFields(canal.id, st.catalogo)
      parts.push(journeySegmentToMoSCoWBlock(j, `USER JOURNEY — ${segHuman}`, meta.label))
      const ideaChunk = ideasToMoSCoWPromptBlock(
        getIdeasForSegmentChannel(ideas, seg, canal.id),
        j,
        meta.label,
        segHuman
      )
      if (ideaChunk.trim()) parts.push(ideaChunk)
    }
  }

  if (!anyMap) return null
  return parts.join('\n\n---\n\n')
}
