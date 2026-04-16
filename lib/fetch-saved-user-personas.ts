import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'

const SHEET_NAME = 'user-persona'

function getAuthReadonly() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

/** Par guardado por la página User Persona (estructura flexible tras JSON.parse). */
export type SavedPersonasPair = Record<string, unknown> & {
  clienteActual: Record<string, unknown>
  clientePotencial: Record<string, unknown>
}

function isPersonaShape(p: unknown): p is Record<string, unknown> {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return (
    typeof o.nombre === 'string' &&
    Array.isArray(o.motivaciones) &&
    Array.isArray(o.necesidades) &&
    Array.isArray(o.puntosDeDolor)
  )
}

function isSavedPersonasPair(v: unknown): v is SavedPersonasPair {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return isPersonaShape(o.clienteActual) && isPersonaShape(o.clientePotencial)
}

export type FetchSavedPersonasResult =
  | { ok: true; data: SavedPersonasPair }
  | { ok: false; code: 'no_sheet' | 'empty' | 'invalid_json' | 'invalid_shape' }

export async function fetchSavedUserPersonas(): Promise<FetchSavedPersonasResult> {
  const sheets = google.sheets({ version: 'v4', auth: getAuthReadonly() })

  const meta = await sheets.spreadsheets.get({ spreadsheetId: CEO_SHEET_ID })
  const exists = meta.data.sheets?.some((s) => s.properties?.title === SHEET_NAME)
  if (!exists) return { ok: false, code: 'no_sheet' }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CEO_SHEET_ID,
    range: `${SHEET_NAME}!A2:C2`,
  })

  const row = res.data.values?.[0]
  if (!row?.[1]?.trim()) return { ok: false, code: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(row[1])
  } catch {
    return { ok: false, code: 'invalid_json' }
  }

  if (!isSavedPersonasPair(parsed)) return { ok: false, code: 'invalid_shape' }

  return { ok: true, data: parsed }
}

function stringifyList(arr: unknown, max = 8): string {
  if (!Array.isArray(arr)) return '(sin datos)'
  return arr
    .filter((x) => typeof x === 'string' && (x as string).trim())
    .slice(0, max)
    .map((x) => `  - ${x}`)
    .join('\n')
}

/** Un solo user persona en texto plano (p. ej. para prompts que no deben mezclar segmentos). */
export function personaRecordToPlainText(sectionTitle: string, p: Record<string, unknown>): string {
  const edu = typeof p.educacion === 'string' ? p.educacion : ''
  const ubi = typeof p.ubicacion === 'string' ? p.ubicacion : ''
  const occ = typeof p.ocupacion === 'string' ? p.ocupacion : ''
  const frase = typeof p.frase === 'string' ? p.frase : ''
  const edad = typeof p.edad === 'number' ? p.edad : p.edad
  const gen = typeof p.genero === 'string' ? p.genero : ''
  const tags = Array.isArray(p.tags) ? (p.tags as string[]).join(', ') : ''

  const canales = (p as Record<string, unknown>).canalesBusquedaSolucion
  const canalesTxt =
    Array.isArray(canales) && canales.some((x) => typeof x === 'string' && (x as string).trim())
      ? `Canales / medios para buscar soluciones a sus necesidades:\n${stringifyList(canales)}`
      : ''

  return [
    `### ${sectionTitle}`,
    `Nombre: ${p.nombre ?? ''}`,
    `Edad: ${edad} · Género (persona): ${gen}`,
    `Educación: ${edu}`,
    `Ubicación: ${ubi}`,
    `Ocupación: ${occ}`,
    `Tags: ${tags}`,
    `Frase (1ª persona): ${frase}`,
    canalesTxt,
    `Motivaciones:\n${stringifyList(p.motivaciones)}`,
    `Necesidades:\n${stringifyList(p.necesidades)}`,
    `Puntos de dolor:\n${stringifyList(p.puntosDeDolor)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Texto para el modelo: un bloque por persona. */
export function personasPairToPlainText(data: SavedPersonasPair): string {
  return `${personaRecordToPlainText('USER PERSONA — CLIENTE ACTUAL', data.clienteActual)}\n\n${personaRecordToPlainText(
    'USER PERSONA — CLIENTE POTENCIAL',
    data.clientePotencial
  )}`
}
