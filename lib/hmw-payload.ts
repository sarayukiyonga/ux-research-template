/** Máximo de campos de respuesta por pregunta (notas / ideas) en la UI y en la generación con IA. */
export const HMW_RESPUESTAS_MAX = 5

/** Longitud máxima del texto de motivo por marca (IA o usuaria). */
export const HMW_MARCA_MOTIVO_MAX_LEN = 2000

/** Marca visual y semántica por respuesta HMW. */
export type HMWRespuestaMarca = 'mejor' | 'no_viable'

export interface HMWItem {
  pregunta: string
  /** Una o más notas por pregunta; siempre al menos un elemento (puede ser cadena vacía). */
  respuestas: string[]
  /** Opcional; alineado por índice con `respuestas` (misma longitud tras normalizar). */
  respuestasMarcas?: Array<HMWRespuestaMarca | null>
  /**
   * Texto opcional por índice: por qué esa respuesta está marcada como mejor o no viable.
   * Solo tiene sentido donde hay marca; el resto debe ser null al normalizar.
   */
  respuestasMarcaMotivos?: Array<string | null>
}

export interface HMWQuestionsPayload {
  clienteActual: HMWItem[]
  clientePotencial: HMWItem[]
}

function isMarca(v: unknown): v is HMWRespuestaMarca {
  return v === 'mejor' || v === 'no_viable'
}

/** Asegura como mucho una "mejor" por pregunta (gana la primera en el array). */
export function enforceSingleMejor(marcas: Array<HMWRespuestaMarca | null>): Array<HMWRespuestaMarca | null> {
  const out = [...marcas]
  let seen = false
  for (let i = 0; i < out.length; i++) {
    if (out[i] === 'mejor') {
      if (seen) out[i] = null
      else seen = true
    }
  }
  return out
}

/** Alinea marcas a la longitud de `respuestas` y valida valores. */
export function normalizeRespuestasMarcas(
  respuestasLen: number,
  raw: unknown
): Array<HMWRespuestaMarca | null> | undefined {
  if (respuestasLen <= 0) return undefined
  if (!Array.isArray(raw)) return undefined
  const out: Array<HMWRespuestaMarca | null> = []
  for (let i = 0; i < respuestasLen; i++) {
    const v = raw[i]
    out[i] = isMarca(v) ? v : null
  }
  const fixed = enforceSingleMejor(out)
  if (fixed.every((m) => m == null)) return undefined
  return fixed
}

/**
 * Alinea motivos con `respuestas` y marcas: solo conserva texto en índices con marca mejor/no_viable.
 */
export function syncMarcaMotivosToRespuestas(
  respuestasLen: number,
  marcas: Array<HMWRespuestaMarca | null> | undefined,
  prev: unknown
): Array<string | null> | undefined {
  if (respuestasLen <= 0) return undefined
  if (!marcas?.length) return undefined
  const out: Array<string | null> = []
  for (let i = 0; i < respuestasLen; i++) {
    const m = marcas[i] ?? null
    if (m !== 'mejor' && m !== 'no_viable') {
      out[i] = null
      continue
    }
    const raw = Array.isArray(prev) ? prev[i] : undefined
    const s = typeof raw === 'string' ? raw.trim().slice(0, HMW_MARCA_MOTIVO_MAX_LEN) : ''
    out[i] = s || null
  }
  if (out.every((x) => x == null)) return undefined
  return out
}

/** Lista de respuestas: mínimo un hueco; recorta vacíos finales salvo uno. */
export function normalizeRespuestasList(r: unknown): string[] {
  if (!Array.isArray(r)) return ['']
  const a = r.map((x) => (typeof x === 'string' ? x : ''))
  if (a.length === 0) return ['']
  if (a.length > HMW_RESPUESTAS_MAX) {
    a.length = HMW_RESPUESTAS_MAX
  }
  while (a.length > 1 && a[a.length - 1] === '') a.pop()
  return a
}

/** Recorta o rellena marcas para que coincida con `respuestas` (tras normalizar textos). */
export function syncMarcasToRespuestas(
  respuestas: string[],
  marcas?: Array<HMWRespuestaMarca | null | undefined>
): Array<HMWRespuestaMarca | null> | undefined {
  if (!marcas?.length) return undefined
  const out: Array<HMWRespuestaMarca | null> = []
  for (let i = 0; i < respuestas.length; i++) {
    const m = marcas[i]
    out[i] = m === 'mejor' || m === 'no_viable' ? m : null
  }
  const fixed = enforceSingleMejor(out)
  if (fixed.every((m) => m == null)) return undefined
  return fixed
}

function itemFromUnknown(x: unknown): HMWItem | null {
  if (typeof x === 'string') {
    const p = x.trim()
    if (!p) return null
    return { pregunta: p, respuestas: [''] }
  }
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (typeof o.pregunta !== 'string') return null
  const p = o.pregunta.trim()
  if (!p) return null
  const respuestas = normalizeRespuestasList(o.respuestas)
  const respuestasMarcas = syncMarcasToRespuestas(respuestas, o.respuestasMarcas as Array<HMWRespuestaMarca | null> | undefined)
  const item: HMWItem = { pregunta: p, respuestas }
  if (respuestasMarcas) item.respuestasMarcas = respuestasMarcas
  const motivos = syncMarcaMotivosToRespuestas(respuestas.length, respuestasMarcas, o.respuestasMarcaMotivos)
  if (motivos) item.respuestasMarcaMotivos = motivos
  return item
}

function normalizeBlock(arr: unknown[]): HMWItem[] {
  return arr.map(itemFromUnknown).filter((x): x is HMWItem => x != null)
}

/** Normaliza un solo array de ítems HMW (p. ej. respuesta parcial de la API). */
export function normalizeHmwItemArray(arr: unknown): HMWItem[] {
  if (!Array.isArray(arr)) return []
  return normalizeBlock(arr)
}

/** Acepta JSON guardado antiguo (solo string[]) o nuevo ({ pregunta, respuestas }). */
export function normalizeHmwPayload(raw: unknown): HMWQuestionsPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const ca = o.clienteActual
  const cp = o.clientePotencial
  if (!Array.isArray(ca) || !Array.isArray(cp)) return null
  const clienteActual = normalizeBlock(ca)
  const clientePotencial = normalizeBlock(cp)
  if (clienteActual.length === 0 && clientePotencial.length === 0) return null
  return { clienteActual, clientePotencial }
}

function mergeRespuestasForItem(prevRow: HMWItem | undefined, freshRow: HMWItem): string[] {
  const p = normalizeRespuestasList(prevRow?.respuestas)
  const f = normalizeRespuestasList(freshRow.respuestas)
  const len = Math.max(p.length, f.length)
  const out: string[] = []
  for (let j = 0; j < len; j++) {
    out[j] = j < p.length ? p[j] : j < f.length ? f[j] : ''
  }
  return normalizeRespuestasList(out)
}

/** Tras regenerar preguntas con la IA, conserva las respuestas en la misma posición si existe. Las marcas se recortan al nuevo número de respuestas. */
export function mergeHmwRegeneratedPreservingAnswers(
  fresh: HMWQuestionsPayload,
  previous: HMWQuestionsPayload | null
): HMWQuestionsPayload {
  if (!previous) return fresh
  const block = (f: HMWItem[], p: HMWItem[]): HMWItem[] =>
    f.map((it, i) => {
      const respuestas = mergeRespuestasForItem(p[i], it)
      const marcas = syncMarcasToRespuestas(respuestas, p[i]?.respuestasMarcas)
      const next: HMWItem = { pregunta: it.pregunta, respuestas }
      if (marcas) {
        next.respuestasMarcas = marcas
        const motivos = syncMarcaMotivosToRespuestas(respuestas.length, marcas, p[i]?.respuestasMarcaMotivos)
        if (motivos) next.respuestasMarcaMotivos = motivos
      }
      return next
    })
  return {
    clienteActual: block(fresh.clienteActual, previous.clienteActual),
    clientePotencial: block(fresh.clientePotencial, previous.clientePotencial),
  }
}

/** Tras regenerar solo un bloque de preguntas, conserva respuestas/marcas alineadas por índice de pregunta. */
export function mergeHmwRegeneratedPreservingAnswersOneBlock(
  block: 'clienteActual' | 'clientePotencial',
  freshBlock: HMWItem[],
  previous: HMWQuestionsPayload | null
): HMWQuestionsPayload {
  const prev = previous ?? { clienteActual: [], clientePotencial: [] }
  const freshFull: HMWQuestionsPayload = { ...prev, [block]: freshBlock }
  return mergeHmwRegeneratedPreservingAnswers(freshFull, prev)
}

export function hmwBlockToPlainTextForJourney(items: HMWItem[], titulo: string): string {
  if (items.length === 0) return ''
  const parts = items.map((it, i) => {
    const notas = it.respuestas
      .map((t, j) => {
        const s = t.trim()
        if (!s) return null
        const m = it.respuestasMarcas?.[j]
        const suf = m === 'mejor' ? ' [mejor]' : m === 'no_viable' ? ' [no viable]' : ''
        const mot = it.respuestasMarcaMotivos?.[j]?.trim()
        const motShort = mot && mot.length > 180 ? `${mot.slice(0, 177)}…` : mot
        const sufMot = motShort ? ` — ${motShort}` : ''
        return `      — Idea ${j + 1}: ${s}${suf}${sufMot}`
      })
      .filter(Boolean)
      .join('\n')
    return `  ${i + 1}. ${it.pregunta}${notas ? '\n' + notas : ''}`
  })
  return `### ${titulo}\n${parts.join('\n\n')}`
}

/** Textos de ayuda en pantalla (alineados con los prompts de generación con IA). */
export const HMW_AYUDA_CRITERIOS = {
  ordenTitulo: 'Orden de las respuestas (la primera es la de mayor prioridad)',
  ordenIntro:
    'Cuando la IA genera o reordena ideas, la posición 0 es la de máxima prioridad. El criterio es en cascada:',
  ordenPasos: [
    'Impacto para la persona usuaria del bloque (cliente actual o potencial, según persona, mapa de empatía y POV): primero las ideas que mejor resuelven la necesidad o frustración del contexto.',
    'Factibilidad para Patri / MOA: entre ideas de impacto parecido, antes las que se puedan implementar con menos riesgo (tiempo, coste, complejidad técnica, carga operativa).',
  ],
  ordenNota: 'Las ranuras vacías solo al final del listado. Si escribes las respuestas a mano, el orden lo decides tú.',
  marcasTitulo: 'Marcas «Mejor» y «No viable»',
  marcasMejor:
    'Solo puede haber una «Mejor» por pregunta: la idea recomendada para priorizar, equilibrando impacto para la usuaria y viabilidad para Patri. La IA aplica ese criterio; tú puedes cambiar la marca en cualquier momento.',
  marcasNoViable:
    '«No viable» marca ideas que conviene descartar por coste, tiempo, riesgo u otros motivos claros de negocio u operativos.',
  marcasMotivo:
    'En cada respuesta marcada verás un icono ? : al pulsarlo se muestra por qué está marcada. Si la marca la pones tú, puedes escribir o editar esa explicación.',
} as const
