/**
 * Tipos y validación del JSON del User Journey Map (Sheets).
 * Sin dependencias de Node/googleapis: seguro de importar desde Client Components.
 */

export interface JourneyEtapa {
  orden: number
  titulo: string
  descripcion: string
  puntosDeDolor: string[]
  /** Canales de marketing activos en esta etapa (boca a boca, Instagram, web, WhatsApp…). */
  canalesDeMarketing: string
  /** Qué debe hacer la marca / el canal (p. ej. web) en esta etapa respecto al POV y al HMW. */
  rolWebFrenteAlPov: string
}

export interface JourneyForPersona {
  etiquetaPersona: string
  etapas: JourneyEtapa[]
  etapaOrdenPovResuelto: number
  sintesis: string
}

export interface UserJourneyBundle {
  clienteActual: JourneyForPersona
  clientePotencial: JourneyForPersona
}

function isEtapa(x: unknown): x is JourneyEtapa {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.orden === 'number' &&
    typeof o.titulo === 'string' &&
    typeof o.descripcion === 'string' &&
    Array.isArray(o.puntosDeDolor) &&
    typeof o.rolWebFrenteAlPov === 'string'
    // canalesDeMarketing es opcional para compatibilidad con datos guardados anteriores
  )
}

export function isJourneyForPersona(x: unknown): x is JourneyForPersona {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.etiquetaPersona !== 'string' || typeof o.sintesis !== 'string') return false
  if (typeof o.etapaOrdenPovResuelto !== 'number') return false
  if (!Array.isArray(o.etapas) || o.etapas.length < 3) return false
  return o.etapas.every(isEtapa)
}

/** Valida el JSON guardado en Sheets (misma forma que exige la API de user-journey). */
export function isUserJourneyBundle(v: unknown): v is UserJourneyBundle {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return isJourneyForPersona(o.clienteActual) && isJourneyForPersona(o.clientePotencial)
}
