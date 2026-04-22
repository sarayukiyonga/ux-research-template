import { JOURNEY_BASE_CANAL_ID } from './user-journey-channels'

export const MOSCOW_VERSION = 1 as const

export type MoSCoWCategoria = 'must' | 'should' | 'could' | 'wont'
export type MoSCoWColor = 'amarillo' | 'naranja' | 'blanco'
export type MoSCoWTamano = 'sm' | 'md' | 'lg'

export const MOSCOW_CATEGORIAS: MoSCoWCategoria[] = ['must', 'should', 'could', 'wont']

export const MOSCOW_LABELS: Record<MoSCoWCategoria, { titulo: string; descripcion: string; bg: string; border: string; badge: string }> = {
  must: {
    titulo: 'Must',
    descripcion: '¿Cuál es lo mínimo que tienes que hacer para ayudar a tus personas?',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-500 text-white',
  },
  should: {
    titulo: 'Should',
    descripcion: 'Puede hacerse en una versión 2, pero muy importante.',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-400 text-white',
  },
  could: {
    titulo: 'Could',
    descripcion: 'Podría hacerse en una versión 1 si hay tiempo y recursos.',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    badge: 'bg-gray-400 text-white',
  },
  wont: {
    titulo: "Won't",
    descripcion: 'Tal vez se puede hacer alguna, muy complejas o innecesarias ahora.',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    badge: 'bg-slate-400 text-white',
  },
}

export interface MoSCoWNota {
  id: string
  texto: string
  color: MoSCoWColor
  tamano: MoSCoWTamano
  /** Qué funcionalidad del MVP origina esta nota */
  origenMVP?: string | null
}

export type MoSCoWNotas = Record<MoSCoWCategoria, MoSCoWNota[]>

export interface MoSCoWPersist {
  version: typeof MOSCOW_VERSION
  notas: MoSCoWNotas
}

export function newMoSCoWId(): string {
  return `msw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function createEmptyNotas(): MoSCoWNotas {
  return { must: [], should: [], could: [], wont: [] }
}

export function createEmptyMoSCoWPersist(): MoSCoWPersist {
  return { version: MOSCOW_VERSION, notas: createEmptyNotas() }
}

export function isMoSCoWPersist(v: unknown): v is MoSCoWPersist {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return o.version === MOSCOW_VERSION && !!o.notas && typeof o.notas === 'object'
}

function normalizeNota(raw: unknown): MoSCoWNota | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.texto !== 'string' || !o.texto.trim()) return null
  return {
    id: typeof o.id === 'string' ? o.id : newMoSCoWId(),
    texto: String(o.texto).trim().slice(0, 80),
    color: o.color === 'naranja' ? 'naranja' : o.color === 'blanco' ? 'blanco' : 'amarillo',
    tamano: o.tamano === 'sm' ? 'sm' : o.tamano === 'lg' ? 'lg' : 'md',
    origenMVP: typeof o.origenMVP === 'string' ? o.origenMVP : null,
  }
}

export function normalizeMoSCoWPersist(raw: unknown): MoSCoWPersist {
  if (!isMoSCoWPersist(raw)) return createEmptyMoSCoWPersist()
  const notas = createEmptyNotas()
  for (const cat of MOSCOW_CATEGORIAS) {
    const arr = (raw.notas as Record<string, unknown>)[cat]
    if (Array.isArray(arr)) {
      notas[cat] = arr.map(normalizeNota).filter((n): n is MoSCoWNota => n !== null)
    }
  }
  return { version: MOSCOW_VERSION, notas }
}

// ── Bundle: «Todos los canales» (generic) + un tablero por canal de comunicación ──

export const MOSCOW_BUNDLE_VERSION = 2 as const

/**
 * `generic` = tablero **Todos los canales** (journey + ideas FUNC/CONT de todos los medios).
 * `canales[id]` = MoSCoW solo para ese canal (mismo id que en User Journey).
 */
export interface MoSCoWBundlePersist {
  version: typeof MOSCOW_BUNDLE_VERSION
  generic: MoSCoWPersist
  canales: Record<string, MoSCoWPersist>
}

/** Alias histórico; en UI/API preferir `MOSCOW_SCOPE_ALL`. */
export const MOSCOW_UI_SCOPE_GENERIC = 'generic' as const

/** Ámbito combinado en selectores y API (`GET`/`POST` MoSCoW). */
export const MOSCOW_SCOPE_ALL = 'all' as const

export function createEmptyMoSCoWBundle(): MoSCoWBundlePersist {
  return { version: MOSCOW_BUNDLE_VERSION, generic: createEmptyMoSCoWPersist(), canales: {} }
}

/** Une dos tableros MoSCoW (mismas categorías). */
export function mergeMoSCoWPersist(a: MoSCoWPersist, b: MoSCoWPersist): MoSCoWPersist {
  const pa = normalizeMoSCoWPersist(a)
  const pb = normalizeMoSCoWPersist(b)
  const out = createEmptyMoSCoWPersist()
  for (const cat of MOSCOW_CATEGORIAS) {
    out.notas[cat] = [...pa.notas[cat], ...pb.notas[cat]]
  }
  return out
}

/**
 * El id `journey_base` en el catálogo es el mismo concepto que «Todos los canales» en MoSCoW.
 * Si existía un tablero en `canales[journey_base]`, se fusiona en `generic` y se elimina la clave duplicada.
 */
export function unifyJourneyBaseMoSCoWBundle(bundle: MoSCoWBundlePersist): MoSCoWBundlePersist {
  const jb = bundle.canales[JOURNEY_BASE_CANAL_ID]
  if (!jb) return bundle
  const merged = mergeMoSCoWPersist(bundle.generic, jb)
  const restCanales = Object.fromEntries(
    Object.entries(bundle.canales).filter(([k]) => k !== JOURNEY_BASE_CANAL_ID)
  ) as Record<string, MoSCoWPersist>
  return { ...bundle, generic: merged, canales: restCanales }
}

/** Lee JSON de `moscow`: bundle v2 o legacy v1 (solo notas → se guarda en `generic`). */
export function normalizeMoSCoWStoredJson(raw: unknown): MoSCoWBundlePersist {
  if (!raw || typeof raw !== 'object') return createEmptyMoSCoWBundle()
  const o = raw as Record<string, unknown>
  let bundle: MoSCoWBundlePersist
  if (o.version === MOSCOW_BUNDLE_VERSION && o.generic && typeof o.canales === 'object') {
    const canales: Record<string, MoSCoWPersist> = {}
    for (const [k, v] of Object.entries(o.canales as Record<string, unknown>)) {
      if (k) canales[k] = normalizeMoSCoWPersist(v)
    }
    bundle = { version: MOSCOW_BUNDLE_VERSION, generic: normalizeMoSCoWPersist(o.generic), canales }
  } else if (isMoSCoWPersist(raw)) {
    bundle = { version: MOSCOW_BUNDLE_VERSION, generic: normalizeMoSCoWPersist(raw), canales: {} }
  } else {
    bundle = createEmptyMoSCoWBundle()
  }
  return unifyJourneyBaseMoSCoWBundle(bundle)
}

function isCombinedScope(scope: string): boolean {
  return scope === MOSCOW_SCOPE_ALL || scope === MOSCOW_UI_SCOPE_GENERIC
}

export function getScopePersist(bundle: MoSCoWBundlePersist, scope: string): MoSCoWPersist {
  if (isCombinedScope(scope)) return bundle.generic
  return bundle.canales[scope] ?? createEmptyMoSCoWPersist()
}

export function setScopePersist(bundle: MoSCoWBundlePersist, scope: string, persist: MoSCoWPersist): MoSCoWBundlePersist {
  const p = normalizeMoSCoWPersist(persist)
  if (isCombinedScope(scope)) return { ...bundle, generic: p }
  return { ...bundle, canales: { ...bundle.canales, [scope]: p } }
}

export function countBundleTotalNotas(bundle: MoSCoWBundlePersist): number {
  const count = (x: MoSCoWPersist) => MOSCOW_CATEGORIAS.reduce((s, c) => s + x.notas[c].length, 0)
  let t = count(bundle.generic)
  for (const x of Object.values(bundle.canales)) t += count(x)
  return t
}

/** Une «Todos los canales» + tableros por canal (MVP, sitemap, etc.). */
export function moscowBundleToCombinedPersist(bundle: MoSCoWBundlePersist): MoSCoWPersist {
  const out = createEmptyMoSCoWPersist()
  const mergeFrom = (p: MoSCoWPersist) => {
    const q = normalizeMoSCoWPersist(p)
    for (const cat of MOSCOW_CATEGORIAS) {
      out.notas[cat].push(...q.notas[cat])
    }
  }
  mergeFrom(bundle.generic)
  for (const p of Object.values(bundle.canales)) mergeFrom(p)
  return out
}
