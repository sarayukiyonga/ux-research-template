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
