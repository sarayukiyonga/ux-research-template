import type { JourneyCanalDef } from '@/lib/user-journey-channels'
import { getUserJourneyCanalMeta, JOURNEY_BASE_CANAL_ID } from '@/lib/user-journey-channels'
import type { UserJourneyV3Persist } from '@/lib/user-journey-persist'
import { countAllJourneyIdeas, countJourneyIdeasForCanal, type UserJourneyIdeasPersist } from '@/lib/user-journey-ideas-persist'
import { MOSCOW_SCOPE_ALL } from '@/lib/moscow-types'

export interface MoscowScopeOption {
  id: string
  label: string
}

export function mergeJourneyCatalogosForV3(v3: UserJourneyV3Persist): JourneyCanalDef[] {
  const ca = v3.clienteActual.catalogo
  const cp = v3.clientePotencial.catalogo
  const m = new Map<string, JourneyCanalDef>()
  for (const c of ca) {
    if (c.id?.trim()) m.set(c.id, c)
  }
  for (const c of cp) {
    if (c.id?.trim() && !m.has(c.id)) m.set(c.id, c)
  }
  return [...m.values()]
}

/** Mapa con etapas + al menos una idea FUNC/CONT guardada para ese canal. */
export function journeyCanalReadyForMoscowIa(
  v3: UserJourneyV3Persist,
  ideas: UserJourneyIdeasPersist,
  canalId: string
): boolean {
  const ideasN = countJourneyIdeasForCanal(ideas, canalId)
  if (ideasN === 0) return false
  const ca = v3.clienteActual.mapas[canalId]
  const cp = v3.clientePotencial.mapas[canalId]
  const hasMap =
    Boolean(ca?.etapas?.length) || Boolean(cp?.etapas?.length)
  return hasMap
}

/**
 * Opciones de ámbito para MoSCoW: «Todos» + un tablero por cada canal que tenga mapa con etapas e ideas FUNC/CONT.
 */
export function buildMoscowScopeOptions(
  v3: UserJourneyV3Persist,
  ideas: UserJourneyIdeasPersist
): MoscowScopeOption[] {
  const opts: MoscowScopeOption[] = [{ id: MOSCOW_SCOPE_ALL, label: 'Todos los canales' }]
  const cat = mergeJourneyCatalogosForV3(v3)
  for (const c of cat) {
    /** Mismo ámbito que «Todos los canales» en MoSCoW; no duplicar pestaña. */
    if (c.id === JOURNEY_BASE_CANAL_ID) continue
    if (!journeyCanalReadyForMoscowIa(v3, ideas, c.id)) continue
    const label = c.label?.trim() || getUserJourneyCanalMeta(c.id).label
    opts.push({ id: c.id, label })
  }
  return opts
}

/** True si hay material suficiente para el ámbito «Todos» en la IA MoSCoW. */
export function hasIdeasForAllScope(ideas: UserJourneyIdeasPersist): boolean {
  return countAllJourneyIdeas(ideas) > 0
}
