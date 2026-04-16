/**
 * Limpia textos de insights (respuesta IA / JSON guardado) para la UI y para persistir.
 * Elimina cercas markdown, comillas envolventes y fragmentos de estructura JSON que a veces “filtran”.
 */

export interface InsightBloquePayload {
  titulo: string
  items: string[]
}

export interface InsightsSurveyPayload {
  resumen: string
  bloques: InsightBloquePayload[]
}

export function sanitizeInsightLine(text: unknown): string {
  if (typeof text !== 'string') return ''
  let s = text.trim()
  if (!s) return ''

  s = s.replace(/^```[\w]*\s*/i, '').replace(/\s*```$/m, '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  s = s.replace(/^\{\s*/, '').trim()

  for (let i = 0; i < 8; i++) {
    const next = s.replace(/\)\s*\}\s*$/g, '').replace(/\}\s*$/g, '').trim()
    if (next === s) break
    s = next
  }

  // Pegamento típico de arrays/objetos JSON pegado al final o en medio del texto
  s = s.replace(/\s*['"]?\s*\}\s*,\s*\{\s*/g, ' ')
  s = s.replace(/\s*['"]?\s*\]\s*,\s*\[\s*/g, ' ')
  s = s.replace(/\s*['"]\s*,\s*\{\s*"/g, ' ')
  s = s.replace(/"\s*\}\s*,\s*/g, ' ')
  s = s.replace(/\s*'\s*\}\s*,\s*\{\s*/g, ' ')
  s = s.replace(/\s*\}\s*,\s*\{\s*"/g, ' "')
  s = s.replace(/\s*,\s*"titulo"\s*:\s*"/gi, ' ')
  s = s.replace(/\s*,\s*"items"\s*:\s*\[/gi, ' ')

  for (let i = 0; i < 6; i++) {
    const next = s
      .replace(/\s*['"]\s*,\s*[\]\{\s]*$/g, '')
      .replace(/\s*[\]\}'"]+\s*$/g, '')
      .replace(/\s*,\s*$/g, '')
      .trim()
    if (next === s) break
    s = next
  }

  s = s.replace(/\s{2,}/g, ' ').trim()
  return s
}

export function sanitizeInsightsPayload(raw: InsightsSurveyPayload): InsightsSurveyPayload {
  return {
    resumen: sanitizeInsightLine(raw.resumen),
    bloques: (raw.bloques ?? []).map((b) => ({
      titulo: sanitizeInsightLine(b.titulo),
      items: (b.items ?? []).map((it) => sanitizeInsightLine(it)),
    })),
  }
}
