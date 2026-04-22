import { google } from 'googleapis'
import { SHEET_ID, SHEET_RANGE, DEMOGRAPHIC_COLUMNS } from './questions'
import { getConfidentialEmailExcludedColumnIndices } from './confidential-email'
import {
  parseSurveyQuestionsFromHeaderRow,
  type SurveyQuestionFromSheet,
} from './survey-sheet-headers'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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

export interface SurveyFilters {
  gender?: string
  ageRanges?: string[]
  /** Filtro por respuestas de dolor crónico (encuesta potenciales) */
  painValues?: string[]
}

export interface SurveyFilterOptions {
  ageRanges: string[]
}

export interface SurveyData {
  totalResponses: number
  totalAll: number
  lastUpdated: string
  responses: SurveyRow[]
  byQuestion: { questionId: number; answers: string[] }[]
  /** Metadatos de preguntas (textos desde la fila 1 del Sheet), orden por columna. */
  questions: SurveyQuestionFromSheet[]
  demographic: { men: string[]; women: string[]; nonBinary: string[] }
  filterOptions: SurveyFilterOptions
}

type Gender = 'men' | 'women' | 'nonBinary'

function getRowGender(row: string[]): Gender | null {
  if ((row[DEMOGRAPHIC_COLUMNS.men] ?? '').trim()) return 'men'
  if ((row[DEMOGRAPHIC_COLUMNS.women] ?? '').trim()) return 'women'
  if ((row[DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()) return 'nonBinary'
  return null
}

function getRowAge(row: string[]): string {
  return (
    (row[DEMOGRAPHIC_COLUMNS.men] ?? '').trim() ||
    (row[DEMOGRAPHIC_COLUMNS.women] ?? '').trim() ||
    (row[DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()
  )
}

export async function getSurveyData(filters: SurveyFilters = {}): Promise<SurveyData> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  })

  const rows = res.data.values ?? []
  const headerRow = rows[0] ?? []
  const allDataRows = rows.slice(1).filter((row) => row.some(Boolean))
  const dataMaxLen = allDataRows.reduce((m, r) => Math.max(m, r.length), 0)
  const maxCol = Math.max(dataMaxLen, headerRow.length)
  const emailExcludedCols = getConfidentialEmailExcludedColumnIndices(headerRow, allDataRows, maxCol)
  const questions = parseSurveyQuestionsFromHeaderRow(headerRow, 'client', {
    maxColumnExclusive: maxCol,
    confidentialEmailResponseRows: allDataRows,
  })

  const ageRangesSet = new Set<string>()
  for (const row of allDataRows) {
    const age = getRowAge(row)
    if (age) ageRangesSet.add(age)
  }
  const ageRanges = Array.from(ageRangesSet).sort()

  const dataRows = allDataRows.filter((row) => {
    if (filters.gender && filters.gender !== 'all') {
      if (getRowGender(row) !== filters.gender) return false
    }
    if (filters.ageRanges && filters.ageRanges.length > 0) {
      if (!filters.ageRanges.includes(getRowAge(row))) return false
    }
    return true
  })

  const responses: SurveyRow[] = dataRows.map((row) => ({
    timestamp: row[0] ?? '',
    answers: row.slice(1).map((cell, i) => (emailExcludedCols.has(i + 1) ? '' : cell)),
  }))

  const byQuestion = questions.map((q) => ({
    questionId: q.questionId,
    answers: shuffle(
      dataRows
        .map((row) => row[q.columnIndex] ?? '')
        .filter((a) => a.trim() !== '')
    ),
  }))

  const demographic = {
    men: shuffle(dataRows.map((row) => row[DEMOGRAPHIC_COLUMNS.men] ?? '').filter((a) => a.trim() !== '')),
    women: shuffle(dataRows.map((row) => row[DEMOGRAPHIC_COLUMNS.women] ?? '').filter((a) => a.trim() !== '')),
    nonBinary: shuffle(dataRows.map((row) => row[DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').filter((a) => a.trim() !== '')),
  }

  const lastRow = dataRows[dataRows.length - 1]
  const lastUpdated = lastRow?.[0] ?? ''

  return {
    totalResponses: dataRows.length,
    totalAll: allDataRows.length,
    lastUpdated,
    responses,
    byQuestion,
    questions,
    demographic,
    filterOptions: { ageRanges },
  }
}
