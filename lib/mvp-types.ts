import { JOURNEY_BASE_CANAL_ID } from './user-journey-channels'

export const MVP_VERSION = 1 as const

export type MVPNotaColor = 'amarillo' | 'naranja'
export type MVPNotaTamano = 'sm' | 'md' | 'lg'

export interface MVPNota {
  id: string
  texto: string
  /** 0 = izquierda (poco valor negocio) → 100 = derecha (mucho valor negocio) */
  x: number
  /** 0 = arriba (mucho valor usuario) → 100 = abajo (poco valor usuario) */
  y: number
  color: MVPNotaColor
  tamano: MVPNotaTamano
  origenHmw?: string | null
}

export interface MVPPersist {
  version: typeof MVP_VERSION
  notas: MVPNota[]
}

export function newMVPNotaId(): string {
  return `nota_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function createEmptyMVPPersist(): MVPPersist {
  return { version: MVP_VERSION, notas: [] }
}

export function isMVPPersist(v: unknown): v is MVPPersist {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return o.version === MVP_VERSION && Array.isArray(o.notas)
}

export function normalizeMVPNota(raw: unknown): MVPNota | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.texto !== 'string' || !o.texto.trim()) return null
  return {
    id: typeof o.id === 'string' ? o.id : newMVPNotaId(),
    texto: String(o.texto).trim().slice(0, 80),
    x: typeof o.x === 'number' ? Math.max(0, Math.min(100, o.x)) : 50,
    y: typeof o.y === 'number' ? Math.max(0, Math.min(100, o.y)) : 50,
    color: o.color === 'naranja' ? 'naranja' : 'amarillo',
    tamano: o.tamano === 'sm' ? 'sm' : o.tamano === 'lg' ? 'lg' : 'md',
    origenHmw: typeof o.origenHmw === 'string' ? o.origenHmw : null,
  }
}

export function normalizeMVPPersist(raw: unknown): MVPPersist {
  if (!isMVPPersist(raw)) return createEmptyMVPPersist()
  return {
    version: MVP_VERSION,
    notas: raw.notas.map(normalizeMVPNota).filter((n): n is MVPNota => n !== null),
  }
}

/** Bloque legible para prompts de IA (eje X negocio, Y usuario; y bajo = más valor usuario). */
export function mvpPersistToPlainTextForIa(mvp: MVPPersist): string {
  if (mvp.notas.length === 0) return '(Sin notas en la matriz MVP guardada.)'
  return mvp.notas
    .map((n, i) => {
      const enCuadranteMvp = n.x > 50 && n.y < 50
      const matriz =
        n.color === 'naranja' || enCuadranteMvp
          ? 'destacada en matriz (candidata fuerte a MVP)'
          : 'fuera del cuadrante MVP prioritario'
      const orig = n.origenHmw?.trim() ? ` · ${n.origenHmw.trim()}` : ''
      return `${i + 1}. "${n.texto}" — valor negocio x=${n.x}/100 — valor usuario y=${n.y}/100 (0=mucho para el usuario, 100=poco) — tamaño=${n.tamano} — ${matriz}${orig}`
    })
    .join('\n')
}

// ── Bundle: «Todos los canales» (generic) + matriz por canal (mismo criterio que MoSCoW) ──

export const MVP_BUNDLE_VERSION = 2 as const

export interface MVPBundlePersist {
  version: typeof MVP_BUNDLE_VERSION
  generic: MVPPersist
  canales: Record<string, MVPPersist>
}

/** Mismo valor que en MoSCoW (`/api/mvp-ia` recibe `scope: "all"`). */
export const MVP_SCOPE_ALL = 'all' as const

export function createEmptyMVPBundle(): MVPBundlePersist {
  return { version: MVP_BUNDLE_VERSION, generic: createEmptyMVPPersist(), canales: {} }
}

function isCombinedMvpScope(scope: string): boolean {
  return scope === MVP_SCOPE_ALL || scope === 'generic'
}

/** Fusiona tableros MVP duplicados bajo `journey_base` hacia `generic`. */
export function unifyJourneyBaseMVPBundle(bundle: MVPBundlePersist): MVPBundlePersist {
  const jb = bundle.canales[JOURNEY_BASE_CANAL_ID]
  if (!jb) return bundle
  const merged: MVPPersist = {
    version: MVP_VERSION,
    notas: [...normalizeMVPPersist(bundle.generic).notas, ...normalizeMVPPersist(jb).notas],
  }
  const rest = Object.fromEntries(
    Object.entries(bundle.canales).filter(([k]) => k !== JOURNEY_BASE_CANAL_ID)
  ) as Record<string, MVPPersist>
  return { ...bundle, generic: merged, canales: rest }
}

/** Lee celda `mvp`: bundle v2 o legacy v1 (solo notas → `generic`). */
export function normalizeMVPStoredJson(raw: unknown): MVPBundlePersist {
  if (!raw || typeof raw !== 'object') return createEmptyMVPBundle()
  const o = raw as Record<string, unknown>
  let bundle: MVPBundlePersist
  if (o.version === MVP_BUNDLE_VERSION && o.generic && typeof o.canales === 'object') {
    const canales: Record<string, MVPPersist> = {}
    for (const [k, v] of Object.entries(o.canales as Record<string, unknown>)) {
      if (k) canales[k] = normalizeMVPPersist(v)
    }
    bundle = { version: MVP_BUNDLE_VERSION, generic: normalizeMVPPersist(o.generic), canales }
  } else if (isMVPPersist(raw)) {
    bundle = { version: MVP_BUNDLE_VERSION, generic: normalizeMVPPersist(raw), canales: {} }
  } else {
    bundle = createEmptyMVPBundle()
  }
  return unifyJourneyBaseMVPBundle(bundle)
}

export function getMVPScopePersist(bundle: MVPBundlePersist, scope: string): MVPPersist {
  if (isCombinedMvpScope(scope)) return bundle.generic
  return bundle.canales[scope] ?? createEmptyMVPPersist()
}

export function setMVPScopePersist(bundle: MVPBundlePersist, scope: string, persist: MVPPersist): MVPBundlePersist {
  const p = normalizeMVPPersist(persist)
  if (isCombinedMvpScope(scope)) return { ...bundle, generic: p }
  return { ...bundle, canales: { ...bundle.canales, [scope]: p } }
}

/** Para mapa del sitio u otras vistas globales: une todas las matrices guardadas. */
export function mvpBundleToCombinedPersist(bundle: MVPBundlePersist): MVPPersist {
  const notas: MVPNota[] = []
  notas.push(...normalizeMVPPersist(bundle.generic).notas)
  for (const p of Object.values(bundle.canales)) {
    notas.push(...normalizeMVPPersist(p).notas)
  }
  return { version: MVP_VERSION, notas }
}
