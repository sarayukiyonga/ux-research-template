import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { normalizeHmwPayload, type HMWQuestionsPayload } from '@/lib/hmw-payload'

const SHEET_NAME = 'hmw'

function getAuthReadonly() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export type FetchSavedHmwResult =
  | { ok: true; data: HMWQuestionsPayload; savedAt: string }
  | { ok: false; code: 'no_sheet' | 'empty' | 'invalid_json' | 'invalid_shape' }

export async function fetchSavedHmwFromSheets(): Promise<FetchSavedHmwResult> {
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

  const data = normalizeHmwPayload(parsed)
  if (!data) return { ok: false, code: 'invalid_shape' }

  return { ok: true, data, savedAt: (row[0] as string) ?? '' }
}
