import { google } from 'googleapis'
import { SHEET_ID, SHEET_RANGE, QUESTIONS, DEMOGRAPHIC_COLUMNS } from './questions'

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error(
      'Faltan variables de entorno: GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY'
    )
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export interface SurveyRow {
  timestamp: string
  answers: string[]
}

export interface SurveyData {
  totalResponses: number
  lastUpdated: string
  responses: SurveyRow[]
  byQuestion: { questionId: number; answers: string[] }[]
  demographic: { men: string[]; women: string[]; nonBinary: string[] }
}

export async function getSurveyData(): Promise<SurveyData> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  })

  const rows = res.data.values ?? []
  // First row is headers, skip it
  const dataRows = rows.slice(1).filter((row) => row.some(Boolean))

  const responses: SurveyRow[] = dataRows.map((row) => ({
    timestamp: row[0] ?? '',
    answers: row.slice(1),
  }))

  const byQuestion = QUESTIONS.map((q) => ({
    questionId: q.id,
    answers: dataRows
      .map((row) => row[q.columnIndex] ?? '')
      .filter((a) => a.trim() !== ''),
  }))

  const demographic = {
    men: dataRows
      .map((row) => row[DEMOGRAPHIC_COLUMNS.men] ?? '')
      .filter((a) => a.trim() !== ''),
    women: dataRows
      .map((row) => row[DEMOGRAPHIC_COLUMNS.women] ?? '')
      .filter((a) => a.trim() !== ''),
    nonBinary: dataRows
      .map((row) => row[DEMOGRAPHIC_COLUMNS.nonBinary] ?? '')
      .filter((a) => a.trim() !== ''),
  }

  const lastRow = dataRows[dataRows.length - 1]
  const lastUpdated = lastRow?.[0] ?? ''

  return {
    totalResponses: dataRows.length,
    lastUpdated,
    responses,
    byQuestion,
    demographic,
  }
}
