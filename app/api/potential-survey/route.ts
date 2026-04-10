import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import {
  POTENTIAL_SHEET_ID,
  POTENTIAL_SHEET_RANGE,
  POTENTIAL_QUESTIONS,
  POTENTIAL_DEMOGRAPHIC_COLUMNS,
} from '@/lib/potential-questions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function GET() {
  try {
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
    const dataRows = rows.slice(1).filter((row) => row.some(Boolean))

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
      lastUpdated: lastRow?.[0] ?? '',
      byQuestion,
      distributions,
      demographic,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
