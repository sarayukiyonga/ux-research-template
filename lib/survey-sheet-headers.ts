/**
 * Preguntas de encuesta: textos desde la **primera fila** del Sheet vinculado.
 * Las columnas no se reordenan: el índice de columna en Sheets es el que usa la app.
 *
 * Convención de columnas (como en export de Formulario):
 * - 0: marca temporal
 * - 1–3: edad por columna de género (Hombre / Mujer / No binario)
 * - Desde 4: preguntas; el texto visible es el de la celda de encabezado (tras quitar marcas técnicas).
 *
 * Marcas opcionales en el encabezado (se eliminan del título mostrado):
 * - [ignore] — no se trata como pregunta (se ignora la columna en el panel).
 * - [closed] — pregunta cerrada (solo encuesta potenciales: distribución de respuestas).
 * - [ocupaciones] — columna de ocupación (clientes: tarjeta de ocupaciones, sin agrupación IA).
 * - [no grupos ia] — no generar agrupación IA en esa columna.
 * - [filtro] — columna usada para el filtro multi-valor (p. ej. potenciales); la primera con marca gana.
 * - [empatía] / [diseño] — subconjunto para mapa de empatía / principios de diseño; si ninguna columna
 *   lleva la marca, se usan todas las preguntas abiertas salvo ocupación.
 *
 * Título corto opcional: en la misma celda, `Corto visible | Texto largo de la pregunta`.
 *
 * Privacidad: si pasas `confidentialEmailResponseRows`, no se incluyen columnas cuyo encabezado
 * indique correo electrónico ni columnas donde alguna respuesta contenga un patrón de e-mail.
 */

import { columnHasConfidentialEmailResponses, headerIndicatesEmailField } from './confidential-email'

export const SURVEY_TIMESTAMP_COLUMN = 0
/** Primera columna de pregunta (después de marca temporal + 3 columnas demográficas). */
export const SURVEY_FIRST_QUESTION_COLUMN = 4

export type SurveyQuestionFromSheet = {
  /** Igual que columnIndex: estable para caché / Sheets guardados. */
  questionId: number
  columnIndex: number
  title: string
  shortTitle: string
  type: 'open' | 'closed'
  isOccupationColumn: boolean
  skipGroupedIa: boolean
  useAsSegmentFilter: boolean
  useForEmpathy: boolean
  useForDesign: boolean
}

const TAG =
  /\[(ignore|closed|ocupaciones|no\s*grupos?\s*ia|filtro|empatía|empathy|diseño|design)\]/gi

function stripTags(raw: string): string {
  return raw
    .replace(TAG, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readFlags(raw: string) {
  return {
    ignore: /\[ignore\]/i.test(raw),
    closed: /\[closed\]/i.test(raw),
    occupation: /\[ocupaciones\]/i.test(raw),
    noGroupedIa: /\[no\s*grupos?\s*ia\]/i.test(raw),
    segmentFilter: /\[filtro\]/i.test(raw),
    empathy: /\[empatía\]/i.test(raw) || /\[empathy\]/i.test(raw),
    design: /\[diseño\]/i.test(raw) || /\[design\]/i.test(raw),
  }
}

function splitTitle(cleaned: string): { title: string; shortTitle: string } {
  if (cleaned.includes('|')) {
    const [a, ...rest] = cleaned.split('|')
    const shortPart = a.trim()
    const longPart = rest.join('|').trim()
    const title = longPart || shortPart
    const shortTitle =
      shortPart.length > 0
        ? shortPart.length > 56
          ? `${shortPart.slice(0, 53)}…`
          : shortPart
        : title.length > 56
          ? `${title.slice(0, 53)}…`
          : title
    return { title, shortTitle }
  }
  const title = cleaned
  const shortTitle = title.length > 56 ? `${title.slice(0, 53)}…` : title
  return { title, shortTitle }
}

/**
 * A partir de la primera fila del Sheet (encabezados), construye la lista de preguntas
 * en orden creciente de índice de columna.
 */
export function parseSurveyQuestionsFromHeaderRow(
  headerRow: string[] | undefined,
  mode: 'client' | 'potential',
  options?: { maxColumnExclusive?: number; confidentialEmailResponseRows?: string[][] }
): SurveyQuestionFromSheet[] {
  const headers = headerRow ?? []
  const maxCol = Math.max(
    headers.length,
    options?.maxColumnExclusive ?? 0,
    SURVEY_FIRST_QUESTION_COLUMN + 1
  )
  const draft: Omit<SurveyQuestionFromSheet, 'isOccupationColumn' | 'skipGroupedIa' | 'useAsSegmentFilter'>[] = []

  for (let columnIndex = SURVEY_FIRST_QUESTION_COLUMN; columnIndex < maxCol; columnIndex++) {
    const raw = String(headers[columnIndex] ?? '')
    const flags = readFlags(raw)
    if (flags.ignore) continue

    const cleaned = stripTags(raw)
    if (!cleaned) continue

    const { title, shortTitle } = splitTitle(cleaned)
    const type: 'open' | 'closed' = mode === 'potential' && flags.closed ? 'closed' : 'open'

    if (options?.confidentialEmailResponseRows?.length) {
      if (headerIndicatesEmailField(raw, title)) continue
      if (columnHasConfidentialEmailResponses(options.confidentialEmailResponseRows, columnIndex)) continue
    }

    draft.push({
      questionId: columnIndex,
      columnIndex,
      title,
      shortTitle,
      type,
      useForEmpathy: flags.empathy,
      useForDesign: flags.design,
    })
  }

  let occupationColumn: number | null = null
  for (const q of draft) {
    const raw = String(headers[q.columnIndex] ?? '')
    if (readFlags(raw).occupation) {
      occupationColumn = q.columnIndex
      break
    }
  }
  if (occupationColumn == null && draft.length > 0) {
    occupationColumn = draft[0].columnIndex
  }

  let segmentFilterColumn: number | null = null
  for (const q of draft) {
    const raw = String(headers[q.columnIndex] ?? '')
    if (readFlags(raw).segmentFilter) {
      segmentFilterColumn = q.columnIndex
      break
    }
  }
  if (segmentFilterColumn == null && mode === 'potential') {
    const firstClosed = draft.find((q) => q.type === 'closed')
    if (firstClosed) segmentFilterColumn = firstClosed.columnIndex
  }

  return draft.map((q) => {
    const raw = String(headers[q.columnIndex] ?? '')
    const f = readFlags(raw)
    const isOccupationColumn = occupationColumn === q.columnIndex
    const skipGroupedIa = f.noGroupedIa || isOccupationColumn
    const useAsSegmentFilter = segmentFilterColumn === q.columnIndex
    return {
      ...q,
      isOccupationColumn,
      skipGroupedIa,
      useAsSegmentFilter,
    }
  })
}

export function getSegmentFilterColumnIndex(questions: SurveyQuestionFromSheet[]): number | null {
  const q = questions.find((x) => x.useAsSegmentFilter)
  return q ? q.columnIndex : null
}

/** Columnas (título + índice) para voz de empatía: [empatía] o todas las abiertas no ocupación. */
export function empathyVoiceColumns(questions: SurveyQuestionFromSheet[]): { title: string; colIndex: number }[] {
  const marked = questions.filter((q) => q.useForEmpathy && q.type === 'open')
  const pool =
    marked.length > 0
      ? marked
      : questions.filter((q) => q.type === 'open' && !q.isOccupationColumn)
  return pool.map((q) => ({ title: q.title, colIndex: q.columnIndex }))
}

/** Columnas para principios de diseño: [diseño] o abiertas no ocupación (máx. 8). */
export function designVoiceColumns(questions: SurveyQuestionFromSheet[]): { title: string; colIndex: number }[] {
  const marked = questions.filter((q) => q.useForDesign && q.type === 'open')
  const pool =
    marked.length > 0
      ? marked
      : questions.filter((q) => q.type === 'open' && !q.isOccupationColumn)
  return pool.slice(0, 8).map((q) => ({ title: q.title, colIndex: q.columnIndex }))
}
