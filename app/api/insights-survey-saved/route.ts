import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'

export const dynamic = 'force-dynamic'

type Segment = 'clientes' | 'potenciales'

function sheetName(segment: Segment) {
  return segment === 'clientes' ? 'insights-clientes' : 'insights-potenciales'
}

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function ensureSheetExists(sheets: ReturnType<typeof google.sheets>, name: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: CEO_SHEET_ID })
  const exists = meta.data.sheets?.some((s) => s.properties?.title === name)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: CEO_SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
    })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const seg = searchParams.get('segment') as Segment | null
    if (seg !== 'clientes' && seg !== 'potenciales') {
      return NextResponse.json({ error: 'segment=clientes|potenciales requerido' }, { status: 400 })
    }

    const name = sheetName(seg)
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    await ensureSheetExists(sheets, name)

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: `${name}!A2:C2`,
    })

    const row = res.data.values?.[0]
    if (!row || !row[1]) return NextResponse.json({ saved: null })

    return NextResponse.json({
      saved: {
        savedAt: row[0] ?? '',
        data: JSON.parse(row[1]),
        filters: row[2] ? JSON.parse(row[2]) : null,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { segment, data, filters } = await req.json()
    if (segment !== 'clientes' && segment !== 'potenciales') {
      return NextResponse.json({ error: 'segment requerido' }, { status: 400 })
    }

    const name = sheetName(segment as Segment)
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    await ensureSheetExists(sheets, name)

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
            range: `${name}!A1:C1`,
            values: [['Guardado el', 'Insights (JSON)', 'Filtros (JSON)']],
          },
          {
            range: `${name}!A2:C2`,
            values: [[savedAt, JSON.stringify(data), JSON.stringify(filters ?? {})]],
          },
        ],
      },
    })

    return NextResponse.json({ ok: true, savedAt })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
