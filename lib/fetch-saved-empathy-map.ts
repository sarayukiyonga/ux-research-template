import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'

/** Misma forma que guarda `EmpathyMapPage` / `empathy-map-saved`. */
export interface EmpathyMapSavedPayload {
  piensaSiente: string[]
  ve: string[]
  oye: string[]
  dice: string[]
  hace: string[]
  dolorFrustraciones: string[]
  necesidadesDeseos: string[]
}

export type EmpathySavedSegment = 'clientes' | 'potenciales'

function sheetName(segment: EmpathySavedSegment) {
  return segment === 'clientes' ? 'mapa-empatia-clientes' : 'mapa-empatia-potenciales'
}

function getAuthReadonly() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

function isEmpathyPayload(v: unknown): v is EmpathyMapSavedPayload {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  const keys = ['piensaSiente', 've', 'oye', 'dice', 'hace', 'dolorFrustraciones', 'necesidadesDeseos'] as const
  return keys.every((k) => Array.isArray(o[k]) && (o[k] as unknown[]).every((x) => typeof x === 'string'))
}

export type FetchSavedEmpathyResult =
  | { ok: true; data: EmpathyMapSavedPayload }
  | { ok: false; code: 'no_sheet' | 'empty' | 'invalid_json' | 'invalid_shape' }

/**
 * Lee el mapa de empatía persistido (misma hoja que GET /api/empathy-map-saved).
 * Solo lectura: no crea hojas.
 */
export async function fetchSavedEmpathyMap(segment: EmpathySavedSegment): Promise<FetchSavedEmpathyResult> {
  const name = sheetName(segment)
  const sheets = google.sheets({ version: 'v4', auth: getAuthReadonly() })

  const meta = await sheets.spreadsheets.get({ spreadsheetId: CEO_SHEET_ID })
  const exists = meta.data.sheets?.some((s) => s.properties?.title === name)
  if (!exists) return { ok: false, code: 'no_sheet' }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CEO_SHEET_ID,
    range: `${name}!A2:C2`,
  })

  const row = res.data.values?.[0]
  if (!row?.[1]?.trim()) return { ok: false, code: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(row[1])
  } catch {
    return { ok: false, code: 'invalid_json' }
  }

  if (!isEmpathyPayload(parsed)) return { ok: false, code: 'invalid_shape' }

  return { ok: true, data: parsed }
}

const SECTION_LABELS: { key: keyof EmpathyMapSavedPayload; label: string }[] = [
  { key: 'piensaSiente', label: 'Piensa y siente' },
  { key: 've', label: 'Ve' },
  { key: 'oye', label: 'Oye' },
  { key: 'dice', label: 'Dice' },
  { key: 'hace', label: 'Hace' },
  { key: 'dolorFrustraciones', label: 'Dolores y frustraciones' },
  { key: 'necesidadesDeseos', label: 'Necesidades y deseos' },
]

/** Texto plano para el prompt de insights a partir del JSON del mapa. */
export function empathyMapToPlainText(data: EmpathyMapSavedPayload): string {
  return SECTION_LABELS.map(({ key, label }) => {
    const items = data[key] ?? []
    if (items.length === 0) return `## ${label}\n(sin notas en esta sección)`
    return `## ${label}\n${items.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
  }).join('\n\n')
}
