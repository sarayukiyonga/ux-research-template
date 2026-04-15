/** Número de campos de texto por pregunta HMW (ideas / notas). */
export const HMW_RESPUESTAS_POR_PREGUNTA = 3

export type HMWRespuestasTriple = [string, string, string]

export interface HMWItem {
  pregunta: string
  respuestas: HMWRespuestasTriple
}

export interface HMWQuestionsPayload {
  clienteActual: HMWItem[]
  clientePotencial: HMWItem[]
}

export function padRespuestasTriple(r: unknown): HMWRespuestasTriple {
  if (!Array.isArray(r)) return ['', '', '']
  const a = r.map((x) => (typeof x === 'string' ? x : ''))
  return [a[0] ?? '', a[1] ?? '', a[2] ?? '']
}

function itemFromUnknown(x: unknown): HMWItem | null {
  if (typeof x === 'string') {
    const p = x.trim()
    if (!p) return null
    return { pregunta: p, respuestas: ['', '', ''] }
  }
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (typeof o.pregunta !== 'string') return null
  const p = o.pregunta.trim()
  if (!p) return null
  return { pregunta: p, respuestas: padRespuestasTriple(o.respuestas) }
}

function normalizeBlock(arr: unknown[]): HMWItem[] {
  return arr.map(itemFromUnknown).filter((x): x is HMWItem => x != null)
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

/** Tras regenerar preguntas con la IA, conserva las respuestas en la misma posición si existe. */
export function mergeHmwRegeneratedPreservingAnswers(
  fresh: HMWQuestionsPayload,
  previous: HMWQuestionsPayload | null
): HMWQuestionsPayload {
  if (!previous) return fresh
  const block = (f: HMWItem[], p: HMWItem[]): HMWItem[] =>
    f.map((it, i) => ({
      pregunta: it.pregunta,
      respuestas: padRespuestasTriple(p[i]?.respuestas ?? it.respuestas),
    }))
  return {
    clienteActual: block(fresh.clienteActual, previous.clienteActual),
    clientePotencial: block(fresh.clientePotencial, previous.clientePotencial),
  }
}

export function hmwBlockToPlainTextForJourney(items: HMWItem[], titulo: string): string {
  if (items.length === 0) return ''
  const parts = items.map((it, i) => {
    const notas = it.respuestas
      .map((t, j) => {
        const s = t.trim()
        return s ? `      — Idea ${j + 1}: ${s}` : null
      })
      .filter(Boolean)
      .join('\n')
    return `  ${i + 1}. ${it.pregunta}${notas ? '\n' + notas : ''}`
  })
  return `### ${titulo}\n${parts.join('\n\n')}`
}
