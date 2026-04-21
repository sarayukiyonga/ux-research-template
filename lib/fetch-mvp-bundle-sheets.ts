import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import {
  createEmptyMVPBundle,
  normalizeMVPStoredJson,
  type MVPBundlePersist,
} from '@/lib/mvp-types'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

/** Lee el bundle MVP desde `mvp!A2:B2` o devuelve bundle vacío. */
export async function fetchMVPBundleFromSheets(): Promise<MVPBundlePersist> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: 'mvp!A2:B2',
    })
    const row = res.data.values?.[0]
    if (!row?.[1]?.trim()) return createEmptyMVPBundle()
    return normalizeMVPStoredJson(JSON.parse(row[1]))
  } catch {
    return createEmptyMVPBundle()
  }
}
