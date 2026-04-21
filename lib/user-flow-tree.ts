import { z } from 'zod'
import {
  DEFAULT_USER_JOURNEY_CANAL_ID,
  defaultJourneyCanalCatalogo,
  normalizeCanalInCatalog,
  type JourneyCanalDef,
} from '@/lib/user-journey-channels'
import { mergeCatalogosUnique, type UserJourneyV3Persist } from '@/lib/user-journey-persist'

export const pasoSchema = z.object({
  orden: z.number().int().min(1).max(24),
  tituloBolita: z.string().max(36),
  descripcion: z.string().max(200),
  tipo: z.enum(['entrada', 'navegacion', 'conversion', 'salida']),
  /** Tipo del elemento objetivo al que retrocede: paso o decisión */
  retornoTipo: z.enum(['paso', 'decision']).nullable(),
  /** tituloBolita (si tipo=paso) o tituloDiamante (si tipo=decision) del destino */
  retornoA: z.string().max(36).nullable(),
  /** Etiqueta de la flecha de vuelta (ej. "Reintentar", "Si falla") */
  retornoLabel: z.string().max(80).nullable(),
})

export type FlowPaso = z.infer<typeof pasoSchema>

export type FlowNodo = FlowLineal | FlowDecision

export interface FlowLineal {
  tipo: 'lineal'
  pasos: FlowPaso[]
  clicsEntrePasos: string[]
  /** Tras el último paso del tramo; null = fin en esa rama. */
  despues: FlowNodo | null
}

export interface FlowDecision {
  tipo: 'decision'
  tituloDiamante: string
  descripcion: string
  ramas: Array<{ etiqueta: string; siguiente: FlowNodo }>
}

const tituloDiamanteSchema = z.string().max(36)

/** Unión recursiva (Zod 4: evitar `discriminatedUnion` + `lazy`, puede romper inferencia/validación). */
export const flowNodoSchema: z.ZodType<FlowNodo> = z.lazy(() =>
  z.union([
    z.object({
      tipo: z.literal('lineal'),
      pasos: z.array(pasoSchema).min(1).max(10),
      clicsEntrePasos: z.array(z.string().max(100)),
      despues: z.union([flowNodoSchema, z.null()]),
    }),
    z.object({
      tipo: z.literal('decision'),
      tituloDiamante: tituloDiamanteSchema.describe('Texto muy corto dentro del rombo (pregunta o condición)'),
      descripcion: z.string().max(240),
      ramas: z
        .array(
          z.object({
            etiqueta: z.string().max(80).describe('Etiqueta de la flecha: Sí, No, Primera vez, etc.'),
            siguiente: flowNodoSchema,
          })
        )
        .min(2)
        .max(3),
    }),
  ])
)

export const userFlowLineSchema = z.object({
  arquetipo: z.string().max(90),
  deDondeEntra: z.string().max(260),
  objetivoConversion: z.string().max(260),
  raiz: flowNodoSchema,
})

export type UserFlowLine = z.infer<typeof userFlowLineSchema>

function alignClics(pasos: { orden: number }[], clics: string[]): string[] {
  const n = Math.max(0, pasos.length - 1)
  const out = [...clics].slice(0, n)
  while (out.length < n) out.push('Continúa en la web')
  return out
}

/**
 * Elimina retornoA de un paso si apunta a un paso con orden >= el propio
 * (retorno hacia adelante o al mismo paso, ambos inválidos).
 */
function sanitizeRetornos(pasos: FlowPaso[]): FlowPaso[] {
  const sorted = [...pasos].sort((a, b) => a.orden - b.orden)
  return sorted.map((p) => {
    if (!p.retornoA || !p.retornoTipo) return p
    // Solo es válido si el paso destino existe y tiene orden MENOR que el actual
    if (p.retornoTipo === 'paso') {
      const target = sorted.find((t) => t.tituloBolita === p.retornoA)
      if (!target || target.orden >= p.orden) {
        return { ...p, retornoTipo: null, retornoA: null, retornoLabel: null }
      }
    }
    return p
  })
}

export function normalizeFlowNode(n: FlowNodo): FlowNodo {
  if (n.tipo === 'lineal') {
    const pasos = sanitizeRetornos([...n.pasos].sort((a, b) => a.orden - b.orden))
    return {
      tipo: 'lineal',
      pasos,
      clicsEntrePasos: alignClics(pasos, n.clicsEntrePasos),
      despues: n.despues == null ? null : normalizeFlowNode(n.despues),
    }
  }
  return {
    tipo: 'decision',
    tituloDiamante: n.tituloDiamante,
    descripcion: n.descripcion,
    ramas: n.ramas.map((r) => ({
      etiqueta: r.etiqueta,
      siguiente: normalizeFlowNode(r.siguiente),
    })),
  }
}

export function normalizeUserFlowLine(raw: UserFlowLine): UserFlowLine {
  return {
    ...raw,
    raiz: normalizeFlowNode(raw.raiz),
  }
}

/** Convierte el formato antiguo (solo pasos + clics) al árbol con un único tramo lineal. */
export function legacyLinealToRaiz(pasos: FlowPaso[], clicsEntrePasos: string[]): FlowNodo {
  const p = [...pasos].sort((a, b) => a.orden - b.orden)
  return {
    tipo: 'lineal',
    pasos: p,
    clicsEntrePasos: alignClics(p, clicsEntrePasos),
    despues: null,
  }
}

function isPaso(x: unknown): x is FlowPaso {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  const t = o.tipo
  return (
    typeof o.orden === 'number' &&
    typeof o.tituloBolita === 'string' &&
    typeof o.descripcion === 'string' &&
    (t === 'entrada' || t === 'navegacion' || t === 'conversion' || t === 'salida')
  )
}

export function isFlowNodo(x: unknown): x is FlowNodo {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (o.tipo === 'lineal') {
    if (!Array.isArray(o.pasos) || o.pasos.length < 1) return false
    if (!Array.isArray(o.clicsEntrePasos)) return false
    if (!o.pasos.every(isPaso)) return false
    const n = Math.max(0, o.pasos.length - 1)
    if (o.clicsEntrePasos.length !== n) return false
    if (o.despues != null && !isFlowNodo(o.despues)) return false
    return true
  }
  if (o.tipo === 'decision') {
    if (typeof o.tituloDiamante !== 'string' || typeof o.descripcion !== 'string') return false
    if (!Array.isArray(o.ramas) || o.ramas.length < 2) return false
    return o.ramas.every(
      (r: unknown) =>
        r &&
        typeof r === 'object' &&
        typeof (r as Record<string, unknown>).etiqueta === 'string' &&
        isFlowNodo((r as Record<string, unknown>).siguiente)
    )
  }
  return false
}

export function isUserFlowLine(x: unknown): x is UserFlowLine {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.arquetipo !== 'string' || typeof o.deDondeEntra !== 'string') return false
  if (typeof o.objetivoConversion !== 'string') return false
  if (o.raiz != null && isFlowNodo(o.raiz)) return true
  // legado
  if (Array.isArray(o.pasos) && o.pasos.length >= 1 && Array.isArray(o.clicsEntrePasos) && o.pasos.every(isPaso)) {
    return true
  }
  return false
}

/** Acepta respuesta API nueva (`raiz`) o guardado legado (`pasos` + `clicsEntrePasos`). */
export function parseUserFlowLine(raw: unknown): UserFlowLine | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.arquetipo !== 'string' || typeof o.deDondeEntra !== 'string' || typeof o.objetivoConversion !== 'string')
    return null

  if (o.raiz != null && isFlowNodo(o.raiz)) {
    return normalizeUserFlowLine({
      arquetipo: o.arquetipo,
      deDondeEntra: o.deDondeEntra,
      objetivoConversion: o.objetivoConversion,
      raiz: o.raiz,
    })
  }

  if (Array.isArray(o.pasos) && o.pasos.every(isPaso) && Array.isArray(o.clicsEntrePasos)) {
    return normalizeUserFlowLine({
      arquetipo: o.arquetipo,
      deDondeEntra: o.deDondeEntra,
      objetivoConversion: o.objetivoConversion,
      raiz: legacyLinealToRaiz(o.pasos as FlowPaso[], o.clicsEntrePasos as string[]),
    })
  }

  return null
}

export interface UserFlowBundle {
  clienteActual: UserFlowLine
  clientePotencial: UserFlowLine
}

export function parseUserFlowBundle(raw: unknown): UserFlowBundle | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if ((o as { version?: unknown }).version === 3) return null
  const ca = parseUserFlowLine(o.clienteActual)
  const cp = parseUserFlowLine(o.clientePotencial)
  if (!ca || !cp) return null
  return { clienteActual: ca, clientePotencial: cp }
}

export interface SegmentoFlowState {
  catalogo: JourneyCanalDef[]
  canalActivoId: string
  diagramas: Record<string, UserFlowLine>
}

export interface UserFlowV3Persist {
  version: 3
  clienteActual: SegmentoFlowState
  clientePotencial: SegmentoFlowState
}

function isSegmentoFlowState(x: unknown): x is SegmentoFlowState {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (!Array.isArray(o.catalogo) || o.catalogo.length === 0) return false
  if (!o.catalogo.every((c) => c && typeof c === 'object' && typeof (c as JourneyCanalDef).id === 'string')) {
    return false
  }
  if (typeof o.canalActivoId !== 'string' || !o.canalActivoId.trim()) return false
  if (!o.diagramas || typeof o.diagramas !== 'object') return false
  return true
}

export function isUserFlowV3Persist(v: unknown): v is UserFlowV3Persist {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (o.version !== 3) return false
  return isSegmentoFlowState(o.clienteActual) && isSegmentoFlowState(o.clientePotencial)
}

function normalizeDiagramasMap(raw: Record<string, unknown>): Record<string, UserFlowLine> {
  const out: Record<string, UserFlowLine> = {}
  for (const [k, v] of Object.entries(raw)) {
    const line = parseUserFlowLine(v)
    if (line) out[k] = line
  }
  return out
}

export function normalizeUserFlowV3(p: UserFlowV3Persist): UserFlowV3Persist {
  const normSeg = (s: SegmentoFlowState): SegmentoFlowState => ({
    catalogo: s.catalogo,
    canalActivoId: normalizeCanalInCatalog(s.canalActivoId, s.catalogo),
    diagramas: normalizeDiagramasMap(s.diagramas as unknown as Record<string, unknown>),
  })
  return {
    version: 3,
    clienteActual: normSeg(p.clienteActual),
    clientePotencial: normSeg(p.clientePotencial),
  }
}

export function migrateFlowBundleToV3(bundle: UserFlowBundle): UserFlowV3Persist {
  const cat = defaultJourneyCanalCatalogo()
  const wid = DEFAULT_USER_JOURNEY_CANAL_ID
  return {
    version: 3,
    clienteActual: {
      catalogo: [...cat],
      canalActivoId: wid,
      diagramas: { [wid]: normalizeUserFlowLine(bundle.clienteActual) },
    },
    clientePotencial: {
      catalogo: [...cat],
      canalActivoId: wid,
      diagramas: { [wid]: normalizeUserFlowLine(bundle.clientePotencial) },
    },
  }
}

export function parseUserFlowPersist(raw: unknown): UserFlowV3Persist | null {
  if (!raw || typeof raw !== 'object') return null
  if (isUserFlowV3Persist(raw)) {
    return normalizeUserFlowV3(raw)
  }
  const legacy = parseUserFlowBundle(raw)
  if (legacy) return migrateFlowBundleToV3(legacy)
  return null
}

export function syncFlowCatalogFromJourneyV3(
  flow: UserFlowV3Persist,
  journey: UserJourneyV3Persist
): UserFlowV3Persist {
  const out: UserFlowV3Persist = {
    version: 3,
    clienteActual: {
      ...flow.clienteActual,
      catalogo: mergeCatalogosUnique(flow.clienteActual.catalogo, journey.clienteActual.catalogo),
    },
    clientePotencial: {
      ...flow.clientePotencial,
      catalogo: mergeCatalogosUnique(flow.clientePotencial.catalogo, journey.clientePotencial.catalogo),
    },
  }
  out.clienteActual.canalActivoId = normalizeCanalInCatalog(
    flow.clienteActual.canalActivoId,
    out.clienteActual.catalogo
  )
  out.clientePotencial.canalActivoId = normalizeCanalInCatalog(
    flow.clientePotencial.canalActivoId,
    out.clientePotencial.catalogo
  )
  return normalizeUserFlowV3(out)
}

export function getFlowLineForSegmentChannel(
  flow: UserFlowV3Persist,
  segment: 'clienteActual' | 'clientePotencial',
  canalId: string
): UserFlowLine | null {
  return flow[segment].diagramas[canalId] ?? null
}

export function emptyFlowV3(): UserFlowV3Persist {
  const cat = defaultJourneyCanalCatalogo()
  const seg = (): SegmentoFlowState => ({
    catalogo: [...cat],
    canalActivoId: DEFAULT_USER_JOURNEY_CANAL_ID,
    diagramas: {},
  })
  return { version: 3, clienteActual: seg(), clientePotencial: seg() }
}
