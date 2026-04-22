import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { CLIENT } from '@/lib/client-config'

const SHEET_NAME = 'pov'

function getAuthReadonly() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export interface POVStatement {
  usuario: string
  necesidad: string
  insight: string
}

export interface SavedPOVPair {
  clienteActual: POVStatement
  clientePotencial: POVStatement
}

function isStatement(o: unknown): o is POVStatement {
  if (!o || typeof o !== 'object') return false
  const x = o as Record<string, unknown>
  return (
    typeof x.usuario === 'string' &&
    typeof x.necesidad === 'string' &&
    typeof x.insight === 'string'
  )
}

function isPovPair(v: unknown): v is SavedPOVPair {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return isStatement(o.clienteActual) && isStatement(o.clientePotencial)
}

export type FetchSavedPovResult =
  | { ok: true; data: SavedPOVPair; savedAt: string }
  | { ok: false; code: 'no_sheet' | 'empty' | 'invalid_json' | 'invalid_shape' }

export async function fetchSavedPovFromSheets(): Promise<FetchSavedPovResult> {
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
    parsed = JSON.parse(row[1] as string)
  } catch {
    return { ok: false, code: 'invalid_json' }
  }

  if (!isPovPair(parsed)) return { ok: false, code: 'invalid_shape' }

  return { ok: true, data: parsed, savedAt: (row[0] as string) ?? '' }
}

export function povPairToPlainTextForHmw(data: SavedPOVPair): string {
  const line = (label: string, s: POVStatement) =>
    `### ${label}\n${s.usuario} necesita ${s.necesidad} porque ${s.insight}.`

  return [
    line(`POV — CLIENTES ACTUALES (ya con ${CLIENT.ownerFirstName} / ${CLIENT.name})`, data.clienteActual),
    '',
    line('POV — CLIENTES POTENCIALES', data.clientePotencial),
  ].join('\n')
}
