import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import {
  POTENTIAL_SHEET_ID,
  POTENTIAL_SHEET_RANGE,
  POTENTIAL_QUESTIONS,
  POTENTIAL_DEMOGRAPHIC_COLUMNS,
} from '@/lib/potential-questions'
import { friendlySheetsReadError } from '@/lib/sheets-link-errors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Gender = 'men' | 'women' | 'nonBinary'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getRowGender(row: string[]): Gender | null {
  if ((row[POTENTIAL_DEMOGRAPHIC_COLUMNS.men] ?? '').trim()) return 'men'
  if ((row[POTENTIAL_DEMOGRAPHIC_COLUMNS.women] ?? '').trim()) return 'women'
  if ((row[POTENTIAL_DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()) return 'nonBinary'
  return null
}

function getRowAge(row: string[]): string {
  return (
    (row[POTENTIAL_DEMOGRAPHIC_COLUMNS.men] ?? '').trim() ||
    (row[POTENTIAL_DEMOGRAPHIC_COLUMNS.women] ?? '').trim() ||
    (row[POTENTIAL_DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()
  )
}

// Column index for pain question (Q1)
const PAIN_COLUMN_INDEX = POTENTIAL_QUESTIONS.find((q) => q.id === 1)!.columnIndex

export async function GET(request: NextRequest) {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        {
          error:
            'Servidor sin credenciales de Google: configura GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en .env.local.',
        },
        { status: 500 }
      )
    }

    const { searchParams } = request.nextUrl
    const genderParam = searchParams.get('gender') ?? 'all'
    const ageRangesParam = searchParams.get('ageRanges') ?? ''
    const selectedAgeRanges = ageRangesParam ? ageRangesParam.split(',').map((s) => s.trim()).filter(Boolean) : []
    const painValuesParam = searchParams.get('painValues') ?? ''
    const selectedPainValues = painValuesParam ? painValuesParam.split(',').map((s) => s.trim()).filter(Boolean) : []

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: POTENTIAL_SHEET_ID,
      range: POTENTIAL_SHEET_RANGE,
    })

    const rows = res.data.values ?? []
    const allDataRows = rows.slice(1).filter((row) => row.some(Boolean))

    // Compute filter options from the full dataset
    const ageRangesSet = new Set<string>()
    const painValuesSet = new Set<string>()
    for (const row of allDataRows) {
      const age = getRowAge(row)
      if (age) ageRangesSet.add(age)
      const pain = (row[PAIN_COLUMN_INDEX] ?? '').trim()
      if (pain) painValuesSet.add(pain)
    }
    const ageRanges = Array.from(ageRangesSet).sort()
    const painValues = Array.from(painValuesSet).sort()

    // Apply filters
    const dataRows = allDataRows.filter((row) => {
      if (genderParam !== 'all') {
        if (getRowGender(row) !== genderParam) return false
      }
      if (selectedAgeRanges.length > 0) {
        if (!selectedAgeRanges.includes(getRowAge(row))) return false
      }
      if (selectedPainValues.length > 0) {
        const pain = (row[PAIN_COLUMN_INDEX] ?? '').trim()
        if (!selectedPainValues.includes(pain)) return false
      }
      return true
    })

    const byQuestion = POTENTIAL_QUESTIONS.map((q) => ({
      questionId: q.id,
      answers: shuffle(
        dataRows
          .map((row) => row[q.columnIndex] ?? '')
          .filter((a) => a.trim() !== '')
      ),
    }))

    // For closed questions, also compute distribution
    const distributions = POTENTIAL_QUESTIONS.filter((q) => q.type === 'closed').map((q) => {
      const answers = dataRows
        .map((row) => row[q.columnIndex] ?? '')
        .filter((a) => a.trim() !== '')

      const counts: Record<string, number> = {}
      for (const a of answers) {
        counts[a] = (counts[a] ?? 0) + 1
      }
      const total = answers.length
      return {
        questionId: q.id,
        total,
        options: Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([label, count]) => ({
            label,
            count,
            pct: total > 0 ? Math.round((count / total) * 100) : 0,
          })),
      }
    })

    const demographic = {
      men: shuffle(
        dataRows
          .map((row) => row[POTENTIAL_DEMOGRAPHIC_COLUMNS.men] ?? '')
          .filter((a) => a.trim() !== '')
      ),
      women: shuffle(
        dataRows
          .map((row) => row[POTENTIAL_DEMOGRAPHIC_COLUMNS.women] ?? '')
          .filter((a) => a.trim() !== '')
      ),
      nonBinary: shuffle(
        dataRows
          .map((row) => row[POTENTIAL_DEMOGRAPHIC_COLUMNS.nonBinary] ?? '')
          .filter((a) => a.trim() !== '')
      ),
    }

    const lastRow = dataRows[dataRows.length - 1]

    return NextResponse.json({
      totalResponses: dataRows.length,
      totalAll: allDataRows.length,
      lastUpdated: lastRow?.[0] ?? '',
      byQuestion,
      distributions,
      demographic,
      filterOptions: { ageRanges, painValues },
    })
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Error desconocido'
    const msg = friendlySheetsReadError(raw, 'POTENTIAL_SURVEY_SHEET_ID')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
