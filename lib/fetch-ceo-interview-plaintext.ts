import { google } from 'googleapis'
import { CEO_SHEET_ID, CEO_QUESTIONS } from '@/lib/ceo-questions'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

/** Texto plano de la entrevista CEO para prompts de IA (misma forma que en otras rutas). */
export async function fetchCeoInterviewPlaintext(): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: CEO_SHEET_ID, range: 'A:N' })
  const rows = res.data.values ?? []
  const dataRow = rows[1]
  if (!dataRow) return '(Sin datos de entrevista CEO)'
  return CEO_QUESTIONS.map((q) => {
    const answer = dataRow[q.columnIndex]?.trim() ?? ''
    return `[${q.themeLabel}] ${q.question}\nPatricia: "${answer}"`
  }).join('\n\n---\n\n')
}
