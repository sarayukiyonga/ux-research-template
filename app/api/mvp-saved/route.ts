import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import {
  createEmptyMVPBundle,
  MVP_BUNDLE_VERSION,
  normalizeMVPStoredJson,
  normalizeMVPPersist,
  type MVPBundlePersist,
} from '@/lib/mvp-types'

export const dynamic = 'force-dynamic'

const SHEET_NAME = 'mvp'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function ensureSheetExists(sheets: ReturnType<typeof google.sheets>) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: CEO_SHEET_ID })
  const exists = meta.data.sheets?.some((s) => s.properties?.title === SHEET_NAME)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: CEO_SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
    })
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    await ensureSheetExists(sheets)

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: `${SHEET_NAME}!A2:B2`,
    })

    const row = res.data.values?.[0]
    if (!row || !row[1]) return NextResponse.json({ saved: null })

    const bundle = normalizeMVPStoredJson(JSON.parse(row[1]))
    return NextResponse.json({ saved: { savedAt: row[0] ?? '', bundle } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { bundle?: unknown; data?: unknown }

    let bundle: MVPBundlePersist
    if (body.bundle != null) {
      bundle = normalizeMVPStoredJson(body.bundle)
    } else if (body.data != null) {
      bundle = {
        version: MVP_BUNDLE_VERSION,
        generic: normalizeMVPPersist(body.data),
        canales: {},
      }
    } else {
      bundle = createEmptyMVPBundle()
    }

    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    await ensureSheetExists(sheets)

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
          { range: `${SHEET_NAME}!A1:B1`, values: [['Guardado el', 'MVP bundle (JSON)']] },
          { range: `${SHEET_NAME}!A2:B2`, values: [[savedAt, JSON.stringify(bundle)]] },
        ],
      },
    })

    return NextResponse.json({ ok: true, savedAt })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
