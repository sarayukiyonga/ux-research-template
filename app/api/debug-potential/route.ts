import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const SHEET_ID = '17TiRexoLK-jEWhgJ3sgO2KiK5BbqikoaZfUlqXabAJU'

export async function GET() {
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'A1:Z2',
    })
    const rows = res.data.values ?? []
    const headers = rows[0] ?? []
    const sample = rows[1] ?? []
    return NextResponse.json(
      headers.map((h, i) => ({ col: i, letter: String.fromCharCode(65 + i), header: h, sample: sample[i] ?? '' }))
    )
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
