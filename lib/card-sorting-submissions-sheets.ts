import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import type { CardSortingSubmissionStored, CardSortingSubmitBody } from '@/lib/card-sorting-submissions-types'
import { parseSubmissionRowJson } from '@/lib/card-sorting-submissions-types'

export const CARD_SORTING_RESPONSES_SHEET = 'card_sorting_resp'

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

async function ensureResponsesSheetExists(sheets: ReturnType<typeof google.sheets>) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: CEO_SHEET_ID })
  const exists = meta.data.sheets?.some((s) => s.properties?.title === CARD_SORTING_RESPONSES_SHEET)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: CEO_SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: CARD_SORTING_RESPONSES_SHEET } } }],
      },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: CEO_SHEET_ID,
      range: `${CARD_SORTING_RESPONSES_SHEET}!A1:C1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['participant_id', 'updated_at', 'datos_json']],
      },
    })
  }
}

export async function loadCardSortingSubmissionsFromSheets(): Promise<CardSortingSubmissionStored[]> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return []
  }
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuthReadonly() })
    const meta = await sheets.spreadsheets.get({ spreadsheetId: CEO_SHEET_ID })
    const exists = meta.data.sheets?.some((s) => s.properties?.title === CARD_SORTING_RESPONSES_SHEET)
    if (!exists) return []

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: `${CARD_SORTING_RESPONSES_SHEET}!A2:C3000`,
    })
    const rows = res.data.values ?? []
    const out: CardSortingSubmissionStored[] = []
    for (const row of rows) {
      const cell = row?.[2]
      const parsed = parseSubmissionRowJson(cell)
      if (parsed) out.push(parsed)
    }
    const byPid = new Map<string, CardSortingSubmissionStored>()
    for (const s of out) {
      const prev = byPid.get(s.participantId)
      if (!prev || prev.updatedAt < s.updatedAt) byPid.set(s.participantId, s)
    }
    return Array.from(byPid.values())
  } catch {
    return []
  }
}

export async function upsertCardSortingSubmissionToSheets(
  participantId: string,
  body: CardSortingSubmitBody
): Promise<{ updatedAt: string }> {
  const sheets = google.sheets({ version: 'v4', auth: getAuthWrite() })
  await ensureResponsesSheetExists(sheets)

  const updatedAt = new Date().toISOString()
  const stored: CardSortingSubmissionStored = {
    participantId,
    assignments: body.assignments,
    categoryLabels: body.categoryLabels,
    updatedAt,
  }
  const json = JSON.stringify(stored)
  if (json.length > 48000) {
    throw new Error('Payload demasiado grande')
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CEO_SHEET_ID,
    range: `${CARD_SORTING_RESPONSES_SHEET}!A2:A3000`,
  })
  const colA = res.data.values ?? []
  let sheetRow = -1
  for (let i = 0; i < colA.length; i++) {
    const cell = String(colA[i]?.[0] ?? '').trim()
    if (cell === participantId) {
      sheetRow = i + 2
      break
    }
  }

  const rowValues = [[participantId, updatedAt, json]]

  if (sheetRow > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: CEO_SHEET_ID,
      range: `${CARD_SORTING_RESPONSES_SHEET}!A${sheetRow}:C${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: rowValues },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: CEO_SHEET_ID,
      range: `${CARD_SORTING_RESPONSES_SHEET}!A:C`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rowValues },
    })
  }

  return { updatedAt }
}
