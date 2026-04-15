import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'

/** Misma forma que guarda `SurveyInsightsPage` / `insights-survey-saved`. */
export interface InsightBloqueSaved {
  titulo: string
  items: string[]
}

export interface InsightsSavedPayload {
  resumen: string
  bloques: InsightBloqueSaved[]
}

export type InsightsSavedSegment = 'clientes' | 'potenciales'

function sheetName(segment: InsightsSavedSegment) {
  return segment === 'clientes' ? 'insights-clientes' : 'insights-potenciales'
}

function getAuthReadonly() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

function isInsightsPayload(v: unknown): v is InsightsSavedPayload {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (typeof o.resumen !== 'string' || !Array.isArray(o.bloques)) return false
  if (o.bloques.length === 0) return false
  return (o.bloques as unknown[]).every((b) => {
    if (!b || typeof b !== 'object') return false
    const x = b as Record<string, unknown>
    return typeof x.titulo === 'string' && Array.isArray(x.items) && (x.items as unknown[]).every((i) => typeof i === 'string')
  })
}

export type FetchSavedInsightsResult =
  | { ok: true; data: InsightsSavedPayload }
  | { ok: false; code: 'no_sheet' | 'empty' | 'invalid_json' | 'invalid_shape' }

/**
 * Lee insights persistidos (misma hoja que GET /api/insights-survey-saved).
 * Solo lectura: no crea hojas.
 */
export async function fetchSavedInsights(segment: InsightsSavedSegment): Promise<FetchSavedInsightsResult> {
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

  if (!isInsightsPayload(parsed)) return { ok: false, code: 'invalid_shape' }

  return { ok: true, data: parsed }
}

export function insightsToPlainText(data: InsightsSavedPayload): string {
  const bloques = (data.bloques ?? [])
    .map((b) => {
      const items = (b.items ?? []).map((t, i) => `  ${i + 1}. ${t}`).join('\n')
      return `## ${b.titulo}\n${items}`
    })
    .join('\n\n')
  return `### Resumen ejecutivo\n${data.resumen}\n\n### Bloques de insights\n\n${bloques}`
}
