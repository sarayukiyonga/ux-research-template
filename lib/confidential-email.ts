/**
 * Evita exponer direcciones de correo de encuestas: columnas con correos en respuestas
 * o encabezados que indican campo de email no deben cargarse ni mostrarse.
 *
 * La constante de primera columna de pregunta debe coincidir con survey-sheet-headers.
 */
const FIRST_SURVEY_QUESTION_COLUMN = 4

/** Patrón razonable para direcciones en texto (no intenta cubrir RFC completo). */
const EMAIL_IN_TEXT = /[a-z0-9][a-z0-9._%+~-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/i

export function cellContainsEmailLike(value: string): boolean {
  const t = (value ?? '').trim()
  if (!t) return false
  return EMAIL_IN_TEXT.test(t)
}

export function headerIndicatesEmailField(rawHeader: string, displayTitle: string): boolean {
  const blob = `${rawHeader}\n${displayTitle}`.toLowerCase()
  if (/\be[\s_-]*mail\b/i.test(blob)) return true
  if (/\bcorreo\s+(electrónico|electronico)\b/i.test(blob)) return true
  if (/dirección\s+de\s+correo/i.test(blob)) return true
  if (/\bmail\s+address\b/i.test(blob)) return true
  return false
}

export function columnHasConfidentialEmailResponses(rows: string[][], columnIndex: number): boolean {
  for (const row of rows) {
    if (cellContainsEmailLike(String(row[columnIndex] ?? ''))) return true
  }
  return false
}

/** Título aproximado tras quitar marcas `[...]` (alineado con el uso en encabezados de encuesta). */
function approximateTitleFromRawHeader(raw: string): string {
  const noTags = raw.replace(/\[[^\]]+\]/gi, ' ').replace(/\s+/g, ' ').trim()
  if (!noTags) return ''
  if (noTags.includes('|')) {
    const parts = noTags.split('|').map((p) => p.trim())
    const longPart = parts.slice(1).join('|').trim()
    return longPart || parts[0] || ''
  }
  return noTags
}

/**
 * Índices de columna (en el Sheet) que deben omitirse por privacidad de correo
 * y borrarse en arrays de respuestas serializados.
 */
export function getConfidentialEmailExcludedColumnIndices(
  headerRow: string[],
  responseRows: string[][],
  maxColumnExclusive: number
): Set<number> {
  const s = new Set<number>()
  for (let c = FIRST_SURVEY_QUESTION_COLUMN; c < maxColumnExclusive; c++) {
    const raw = String(headerRow[c] ?? '')
    const approxTitle = approximateTitleFromRawHeader(raw)
    const hasAnyValue = responseRows.some((r) => String(r[c] ?? '').trim() !== '')
    if (approxTitle === '' && !hasAnyValue) continue
    if (headerIndicatesEmailField(raw, approxTitle)) {
      s.add(c)
      continue
    }
    if (columnHasConfidentialEmailResponses(responseRows, c)) {
      s.add(c)
    }
  }
  return s
}
