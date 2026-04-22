import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import {
  defaultCardSortingConfig,
  normalizeCardSortingConfig,
  type CardSortingConfig,
} from '@/lib/card-sorting-types'

export const CARD_SORTING_SHEET_NAME = 'card_sorting'

function getAuthReadonly() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

function getAuthWrite() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function ensureSheetExists(sheets: ReturnType<typeof google.sheets>) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: CEO_SHEET_ID })
  const exists = meta.data.sheets?.some((s) => s.properties?.title === CARD_SORTING_SHEET_NAME)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: CEO_SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: CARD_SORTING_SHEET_NAME } } }],
      },
    })
  }
}

export async function loadCardSortingConfigFromSheets(): Promise<{
  savedAt: string | null
  config: CardSortingConfig
}> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { savedAt: null, config: defaultCardSortingConfig() }
  }
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuthReadonly() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: `${CARD_SORTING_SHEET_NAME}!A2:B2`,
    })
    const row = res.data.values?.[0]
    if (!row?.[1]?.trim()) {
      return { savedAt: null, config: defaultCardSortingConfig() }
    }
    return {
      savedAt: (row[0] ?? '').trim() || null,
      config: normalizeCardSortingConfig(JSON.parse(row[1])),
    }
  } catch {
    return { savedAt: null, config: defaultCardSortingConfig() }
  }
}

export async function saveCardSortingConfigToSheets(config: CardSortingConfig): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuthWrite() })
  await ensureSheetExists(sheets)
  const normalized = normalizeCardSortingConfig(config)
  const savedAt = new Date().toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: CEO_SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        {
          range: `${CARD_SORTING_SHEET_NAME}!A1:B1`,
          values: [['Guardado el', 'Card sorting (JSON)']],
        },
        {
          range: `${CARD_SORTING_SHEET_NAME}!A2:B2`,
          values: [[savedAt, JSON.stringify(normalized)]],
        },
      ],
    },
  })
  return savedAt
}
