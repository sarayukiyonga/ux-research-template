import type { JourneyForPersona } from '@/lib/user-journey-bundle'

export const USER_JOURNEY_IDEAS_VERSION = 1 as const

export type JourneyIdeaTipo = 'funcionalidad' | 'contenido'

export interface JourneyIdeaItem {
  id: string
  tipo: JourneyIdeaTipo
  /** Orden de etapa del mapa (1..n) al que enlaza la idea */
  etapaOrden: number
  texto: string
}

export interface UserJourneyIdeasPersist {
  version: typeof USER_JOURNEY_IDEAS_VERSION
  clienteActual: Record<string, JourneyIdeaItem[]>
  clientePotencial: Record<string, JourneyIdeaItem[]>
}

function isJourneyIdeaItem(x: unknown): x is JourneyIdeaItem {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    (o.tipo === 'funcionalidad' || o.tipo === 'contenido') &&
    typeof o.etapaOrden === 'number' &&
    Number.isInteger(o.etapaOrden) &&
    typeof o.texto === 'string'
  )
}

function isRecordOfIdeas(x: unknown): x is Record<string, JourneyIdeaItem[]> {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  for (const v of Object.values(o)) {
    if (!Array.isArray(v) || !v.every(isJourneyIdeaItem)) return false
  }
  return true
}

export function isUserJourneyIdeasPersist(v: unknown): v is UserJourneyIdeasPersist {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (o.version !== USER_JOURNEY_IDEAS_VERSION) return false
  return isRecordOfIdeas(o.clienteActual) && isRecordOfIdeas(o.clientePotencial)
}

export function createEmptyIdeasPersist(): UserJourneyIdeasPersist {
  return {
    version: USER_JOURNEY_IDEAS_VERSION,
    clienteActual: {},
    clientePotencial: {},
  }
}

export function normalizeUserJourneyIdeasPersist(raw: unknown): UserJourneyIdeasPersist {
  if (isUserJourneyIdeasPersist(raw)) return raw
  return createEmptyIdeasPersist()
}

export function newJourneyIdeaId(): string {
  return `idea_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export function getIdeasForSegmentChannel(
  persist: UserJourneyIdeasPersist,
  segment: 'clienteActual' | 'clientePotencial',
  canalId: string
): JourneyIdeaItem[] {
  const bucket = persist[segment]
  return bucket[canalId] ?? []
}

/** Texto para prompts (User Flow): ideas agrupadas por etapa del journey. */
export function ideasToFlowPromptBlock(
  items: JourneyIdeaItem[],
  journey: JourneyForPersona,
  canalLabel: string
): string {
  if (items.length === 0) return ''

  const etapaTitulo = (orden: number) => {
    const e = journey.etapas.find((x) => x.orden === orden)
    return e ? `${orden}. ${e.titulo}` : `Etapa orden ${orden}`
  }

  const byEtapa = new Map<number, JourneyIdeaItem[]>()
  for (const it of items) {
    const k = it.etapaOrden
    if (!byEtapa.has(k)) byEtapa.set(k, [])
    byEtapa.get(k)!.push(it)
  }
  const ordenes = [...byEtapa.keys()].sort((a, b) => a - b)

  const blocks = ordenes.map((ord) => {
    const list = byEtapa.get(ord)!
    const lines = list.map(
      (i) => `    - [${i.tipo === 'funcionalidad' ? 'FUNC' : 'CONT'}] ${i.texto.replace(/\s+/g, ' ').trim()}`
    )
    return `  **${etapaTitulo(ord)}** (${canalLabel})\n${lines.join('\n')}`
  })

  return `### IDEAS DE FUNCIONALIDADES Y CONTENIDOS (fuente principal del diagrama)\nCanal: **${canalLabel}**. Persona en mapa: ${journey.etiquetaPersona}.\n\n${blocks.join('\n\n')}\n\n**Instrucción**: cada paso del User Flow debe ejecutar, refinar o mostrar en pantalla estas ideas donde encaje; no inventes un producto distinto al que describen las ideas salvo que el contexto POV lo exija explícitamente.`
}

