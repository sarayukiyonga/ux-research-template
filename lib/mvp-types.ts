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
