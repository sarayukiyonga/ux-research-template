import type { JourneyForPersona, UserJourneyBundle } from '@/lib/user-journey-bundle'
import { isJourneyForPersona, isUserJourneyBundle } from '@/lib/user-journey-bundle'
import {
  DEFAULT_USER_JOURNEY_CANAL_ID,
  catalogoContainsId,
  defaultJourneyCanalCatalogo,
  ensureBaseChannelInCatalog,
  isKnownUserJourneyCanalId,
  syncPresetCanalLabelsInCatalog,
  type JourneyCanalDef,
  normalizeCanalInCatalog,
} from '@/lib/user-journey-channels'

export type { JourneyCanalDef } from '@/lib/user-journey-channels'

export const USER_JOURNEY_PERSIST_VERSION = 2 as const
export const USER_JOURNEY_PERSIST_V3 = 3 as const

/** JSON guardado v2: un bundle por canal (mismo par actual/potencial por canal). */
export interface UserJourneyMultiPersist {
  version: typeof USER_JOURNEY_PERSIST_VERSION
  canales: Record<string, UserJourneyBundle>
  canalActivoId: string
}

/** v3: canales y mapas independientes por tipo de cliente. */
export interface SegmentoJourneyState {
  catalogo: JourneyCanalDef[]
  canalActivoId: string
  mapas: Record<string, JourneyForPersona>
}

export interface UserJourneyV3Persist {
  version: typeof USER_JOURNEY_PERSIST_V3
  clienteActual: SegmentoJourneyState
  clientePotencial: SegmentoJourneyState
}

export type UserJourneySegmento = 'clienteActual' | 'clientePotencial'

function isSegmentoJourneyState(x: unknown): x is SegmentoJourneyState {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (!Array.isArray(o.catalogo) || o.catalogo.length === 0) return false
  if (!o.catalogo.every((c) => c && typeof c === 'object' && typeof (c as JourneyCanalDef).id === 'string')) {
    return false
  }
  if (typeof o.canalActivoId !== 'string' || !o.canalActivoId.trim()) return false
  if (!o.mapas || typeof o.mapas !== 'object') return false
  const mapas = o.mapas as Record<string, unknown>
  for (const k of Object.keys(mapas)) {
    if (!isJourneyForPersona(mapas[k])) return false
  }
  return true
}

export function isUserJourneyV3Persist(v: unknown): v is UserJourneyV3Persist {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (o.version !== USER_JOURNEY_PERSIST_V3) return false
  return isSegmentoJourneyState(o.clienteActual) && isSegmentoJourneyState(o.clientePotencial)
}

export function isUserJourneyMultiPersist(v: unknown): v is UserJourneyMultiPersist {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (o.version !== USER_JOURNEY_PERSIST_VERSION) return false
  if (typeof o.canalActivoId !== 'string' || !o.canalActivoId.trim()) return false
  if (!o.canales || typeof o.canales !== 'object') return false
  const canales = o.canales as Record<string, unknown>
  const keys = Object.keys(canales)
  if (keys.length === 0) return false
  return keys.every((k) => isUserJourneyBundle(canales[k]))
}

export function legacyBundleToMulti(bundle: UserJourneyBundle): UserJourneyMultiPersist {
  return {
    version: USER_JOURNEY_PERSIST_VERSION,
    canales: { [DEFAULT_USER_JOURNEY_CANAL_ID]: bundle },
    canalActivoId: DEFAULT_USER_JOURNEY_CANAL_ID,
  }
}

export function migrateV2toV3(multi: UserJourneyMultiPersist): UserJourneyV3Persist {
  const keys = Object.keys(multi.canales)
  const baseCat = defaultJourneyCanalCatalogo()
  const extraIds = keys.filter((k) => !baseCat.some((b) => b.id === k))
  const cat: JourneyCanalDef[] = [...baseCat, ...extraIds.map((id) => ({ id, label: id }))]
  const canalGlobal = normalizeCanalInCatalog(multi.canalActivoId, cat)
  const ca: SegmentoJourneyState = { catalogo: [...cat], canalActivoId: canalGlobal, mapas: {} }
  const cp: SegmentoJourneyState = { catalogo: [...cat], canalActivoId: canalGlobal, mapas: {} }
  for (const k of keys) {
    const b = multi.canales[k]
    if (isUserJourneyBundle(b)) {
      ca.mapas[k] = b.clienteActual
      cp.mapas[k] = b.clientePotencial
    }
  }
  return { version: USER_JOURNEY_PERSIST_V3, clienteActual: ca, clientePotencial: cp }
}

export type ParsedJourneyCell =
  | { kind: 'legacy'; bundle: UserJourneyBundle }
  | { kind: 'multi'; multi: UserJourneyMultiPersist }
  | { kind: 'v3'; v3: UserJourneyV3Persist }

export function parsePersistedJourneyCell(raw: unknown): ParsedJourneyCell | null {
  if (isUserJourneyV3Persist(raw)) return { kind: 'v3', v3: raw }
  if (isUserJourneyMultiPersist(raw)) return { kind: 'multi', multi: raw }
  if (isUserJourneyBundle(raw)) return { kind: 'legacy', bundle: raw }
  return null
}

export function toJourneyV3(p: ParsedJourneyCell): UserJourneyV3Persist {
  if (p.kind === 'v3') return p.v3
  if (p.kind === 'multi') return migrateV2toV3(p.multi)
  return migrateV2toV3(legacyBundleToMulti(p.bundle))
}

export function createEmptyJourneyV3(): UserJourneyV3Persist {
  const cat = defaultJourneyCanalCatalogo()
  const seg = (): SegmentoJourneyState => ({
    catalogo: [...cat],
    canalActivoId: DEFAULT_USER_JOURNEY_CANAL_ID,
    mapas: {},
  })
  return { version: USER_JOURNEY_PERSIST_V3, clienteActual: seg(), clientePotencial: seg() }
}

/** Catálogos guardados antes de `journey_base`: añade el canal base y normaliza el activo. */
export function withJourneyBaseInCatalogs(v3: UserJourneyV3Persist): UserJourneyV3Persist {
  const caCat = syncPresetCanalLabelsInCatalog(ensureBaseChannelInCatalog(v3.clienteActual.catalogo))
  const cpCat = syncPresetCanalLabelsInCatalog(ensureBaseChannelInCatalog(v3.clientePotencial.catalogo))
  return {
    ...v3,
    clienteActual: {
      ...v3.clienteActual,
      catalogo: caCat,
      canalActivoId: normalizeCanalInCatalog(v3.clienteActual.canalActivoId, caCat),
    },
    clientePotencial: {
      ...v3.clientePotencial,
      catalogo: cpCat,
      canalActivoId: normalizeCanalInCatalog(v3.clientePotencial.canalActivoId, cpCat),
    },
  }
}

/** v2 helpers (compat) */
export function getBundleForChannel(multi: UserJourneyMultiPersist, canalId: string): UserJourneyBundle | null {
  const b = multi.canales[canalId]
  return b && isUserJourneyBundle(b) ? b : null
}

export function getBundleForWebFlowConsumer(multi: UserJourneyMultiPersist): UserJourneyBundle | null {
  if (multi.canales.web && isUserJourneyBundle(multi.canales.web)) return multi.canales.web
  const active = multi.canales[multi.canalActivoId]
  if (active && isUserJourneyBundle(active)) return active
  const firstKey = Object.keys(multi.canales)[0]
  if (!firstKey) return null
  const first = multi.canales[firstKey]
  return first && isUserJourneyBundle(first) ? first : null
}

export type UserJourneySavedFilters = {
  fuente?: string
  /** @deprecated — usar segmentoActivo + canalPorSegmento */
  canalActivoId?: string
  segmentoActivo?: UserJourneySegmento
  canalPorSegmento?: Partial<Record<UserJourneySegmento, string>>
}

export function parseUserJourneySavedFilters(raw: unknown): UserJourneySavedFilters {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try {
      return parseUserJourneySavedFilters(JSON.parse(raw))
    } catch {
      return {}
    }
  }
  if (typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: UserJourneySavedFilters = {}
  if (typeof o.canalActivoId === 'string' && o.canalActivoId.trim()) out.canalActivoId = o.canalActivoId.trim()
  if (typeof o.fuente === 'string') out.fuente = o.fuente
  if (o.segmentoActivo === 'clienteActual' || o.segmentoActivo === 'clientePotencial') {
    out.segmentoActivo = o.segmentoActivo
  }
  if (o.canalPorSegmento && typeof o.canalPorSegmento === 'object') {
    const cps = o.canalPorSegmento as Record<string, unknown>
    const ca = cps.clienteActual
    const cp = cps.clientePotencial
    out.canalPorSegmento = {}
    if (typeof ca === 'string' && ca.trim()) out.canalPorSegmento.clienteActual = ca.trim()
    if (typeof cp === 'string' && cp.trim()) out.canalPorSegmento.clientePotencial = cp.trim()
  }
  return out
}

export function resolveCanalForSegment(
  filters: UserJourneySavedFilters,
  v3: UserJourneyV3Persist,
  segment: UserJourneySegmento
): string {
  const seg = v3[segment]
  const fromFilter = filters.canalPorSegmento?.[segment]
  if (fromFilter && catalogoContainsId(seg.catalogo, fromFilter)) return fromFilter
  if (catalogoContainsId(seg.catalogo, seg.canalActivoId)) return seg.canalActivoId
  return seg.catalogo[0]!.id
}

export type FlowJourneyPair = {
  clienteActual: { canalId: string; journey: JourneyForPersona }
  clientePotencial: { canalId: string; journey: JourneyForPersona }
}

/** Resuelve el par de journeys para User Flow; `request` permite forzar canal por segmento (p. ej. UI de User Flow). */
export function resolveFlowJourneyPairFromRequest(
  v3: UserJourneyV3Persist,
  filtersUnknown: unknown,
  request?: Partial<Record<UserJourneySegmento, string>>
): FlowJourneyPair | null {
  const f = parseUserJourneySavedFilters(filtersUnknown)
  const ca =
    typeof request?.clienteActual === 'string' && request.clienteActual.trim()
      ? request.clienteActual.trim()
      : resolveCanalForSegment(f, v3, 'clienteActual')
  const cp =
    typeof request?.clientePotencial === 'string' && request.clientePotencial.trim()
      ? request.clientePotencial.trim()
      : resolveCanalForSegment(f, v3, 'clientePotencial')
  const ja = v3.clienteActual.mapas[ca]
  const jp = v3.clientePotencial.mapas[cp]
  if (!ja || !jp) return null
  return {
    clienteActual: { canalId: ca, journey: ja },
    clientePotencial: { canalId: cp, journey: jp },
  }
}

export function resolveOneSegmentJourneyFromRequest(
  v3: UserJourneyV3Persist,
  filtersUnknown: unknown,
  segment: UserJourneySegmento,
  requestCanal?: string
): { canalId: string; journey: JourneyForPersona } | null {
  const f = parseUserJourneySavedFilters(filtersUnknown)
  const canalId =
    typeof requestCanal === 'string' && requestCanal.trim()
      ? requestCanal.trim()
      : resolveCanalForSegment(f, v3, segment)
  const j = v3[segment].mapas[canalId]
  if (!j) return null
  return { canalId, journey: j }
}

export function getJourneyPairForUserFlow(
  cell: ParsedJourneyCell | null,
  filtersUnknown: unknown
): FlowJourneyPair | null {
  if (!cell) return null
  return resolveFlowJourneyPairFromRequest(toJourneyV3(cell), filtersUnknown, undefined)
}

export function savedJourneyCellHasFlowBundle(journeyCell: unknown, filtersUnknown: unknown): boolean {
  const p = parsePersistedJourneyCell(journeyCell)
  if (!p) return false
  return getJourneyPairForUserFlow(p, filtersUnknown) !== null
}

export function savedJourneyCellHasUsableBundle(raw: unknown): boolean {
  return savedJourneyCellHasFlowBundle(raw, undefined)
}

/** @deprecated v2 — usar resolveCanalForSegment con v3 */
export function resolveCanalIdForUserFlow(filters: unknown, multi: UserJourneyMultiPersist): string {
  const f = parseUserJourneySavedFilters(filters)
  if (f.canalActivoId && isKnownUserJourneyCanalId(f.canalActivoId) && getBundleForChannel(multi, f.canalActivoId)) {
    return f.canalActivoId
  }
  return normalizeCanalInCatalog(multi.canalActivoId, defaultJourneyCanalCatalogo())
}

/** @deprecated */
export function getUserFlowBundle(
  cell: ParsedJourneyCell,
  filtersUnknown: unknown
): { bundle: UserJourneyBundle; canalId: string } | null {
  const pair = getJourneyPairForUserFlow(cell, filtersUnknown)
  if (!pair) return null
  const bundle: UserJourneyBundle = {
    clienteActual: pair.clienteActual.journey,
    clientePotencial: pair.clientePotencial.journey,
  }
  return { bundle, canalId: pair.clienteActual.canalId }
}

export function mergeCatalogosUnique(a: JourneyCanalDef[], b: JourneyCanalDef[]): JourneyCanalDef[] {
  const seen = new Set<string>()
  const out: JourneyCanalDef[] = []
  for (const c of [...a, ...b]) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}
