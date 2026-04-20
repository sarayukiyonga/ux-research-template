import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { USER_JOURNEY_PERSIST_V3 } from '@/lib/user-journey-persist'

export const dynamic = 'force-dynamic'

const SHEET_NAME = 'user-journey'
const HEADERS = [['Tipo', 'Guardado el', 'Segmento', 'Canal ID', 'Datos (JSON)']]

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

function formatSavedAt() {
  return new Date().toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type RowData = string[]

async function readDataRows(sheets: ReturnType<typeof google.sheets>): Promise<RowData[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CEO_SHEET_ID,
    range: `${SHEET_NAME}!A2:E`,
  })
  return (res.data.values ?? []) as RowData[]
}

/** True if rows are in the new multi-row format (first row type is "meta"). */
function isNewFormat(rows: RowData[]): boolean {
  return rows.length > 0 && rows[0][0] === 'meta'
}

/** Extracts journey rows from a stored v3 JSON object (old format migration). */
function v3ObjectToJourneyRows(v3Raw: unknown, savedAt: string): RowData[] {
  if (!v3Raw || typeof v3Raw !== 'object') return []
  const v3 = v3Raw as Record<string, unknown>
  const rows: RowData[] = []
  for (const seg of ['clienteActual', 'clientePotencial'] as const) {
    const segState = v3[seg] as Record<string, unknown> | null
    if (!segState?.mapas || typeof segState.mapas !== 'object') continue
    for (const [canalId, journey] of Object.entries(segState.mapas as Record<string, unknown>)) {
      if (journey) rows.push(['journey', savedAt, seg, canalId, JSON.stringify(journey)])
    }
  }
  return rows
}

async function writeRows(sheets: ReturnType<typeof google.sheets>, dataRows: RowData[]) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: CEO_SHEET_ID,
    range: `${SHEET_NAME}!A2:E500`,
  })
  const updates: { range: string; values: RowData[] }[] = [
    { range: `${SHEET_NAME}!A1:E1`, values: HEADERS },
  ]
  if (dataRows.length > 0) {
    updates.push({ range: `${SHEET_NAME}!A2:E${dataRows.length + 1}`, values: dataRows })
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: CEO_SHEET_ID,
    requestBody: { valueInputOption: 'RAW', data: updates },
  })
}

export async function GET() {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    await ensureSheetExists(sheets)
    const rows = await readDataRows(sheets)
    if (!rows.length) return NextResponse.json({ saved: null })

    if (isNewFormat(rows)) {
      // New multi-row format: row 0 = meta, rest = journey rows
      const metaRow = rows[0]
      const savedAt = metaRow[1] ?? ''
      let meta: Record<string, unknown>
      try {
        meta = JSON.parse(metaRow[4] ?? '') as Record<string, unknown>
      } catch {
        return NextResponse.json({ saved: null })
      }

      const v3: Record<string, unknown> = {
        version: USER_JOURNEY_PERSIST_V3,
        clienteActual: {
          catalogo: (meta.clienteActual as Record<string, unknown>)?.catalogo ?? [],
          canalActivoId: (meta.clienteActual as Record<string, unknown>)?.canalActivoId ?? 'web',
          mapas: {} as Record<string, unknown>,
        },
        clientePotencial: {
          catalogo: (meta.clientePotencial as Record<string, unknown>)?.catalogo ?? [],
          canalActivoId: (meta.clientePotencial as Record<string, unknown>)?.canalActivoId ?? 'web',
          mapas: {} as Record<string, unknown>,
        },
      }
      for (const row of rows.slice(1)) {
        if (row[0] !== 'journey') continue
        const seg = row[2] as 'clienteActual' | 'clientePotencial'
        const canalId = row[3]
        if ((seg === 'clienteActual' || seg === 'clientePotencial') && canalId && row[4]) {
          try {
            const segState = v3[seg] as { mapas: Record<string, unknown> }
            segState.mapas[canalId] = JSON.parse(row[4])
          } catch { /* skip malformed journey */ }
        }
      }

      return NextResponse.json({
        saved: {
          savedAt,
          journey: v3,
          filters: (meta.filters as Record<string, unknown>) ?? null,
        },
      })
    }

    // Old single-blob format: A=savedAt, B=v3JSON, C=filtersJSON
    const row = rows[0]
    if (!row?.[1]) return NextResponse.json({ saved: null })
    try {
      return NextResponse.json({
        saved: {
          savedAt: row[0] ?? '',
          journey: JSON.parse(row[1]),
          filters: row[2] ? JSON.parse(row[2]) : null,
        },
      })
    } catch {
      return NextResponse.json({ saved: null })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    await ensureSheetExists(sheets)
    const savedAt = formatSavedAt()

    // Incremental canal save: { type: 'canal', segmento, canalId, journey, meta }
    if (body.type === 'canal') {
      const segmento = body.segmento as 'clienteActual' | 'clientePotencial'
      const canalId = body.canalId as string
      const journey = body.journey
      const meta = (body.meta ?? {}) as Record<string, unknown>

      const existing = await readDataRows(sheets)
      let journeyRows: RowData[]

      if (isNewFormat(existing)) {
        // Update/insert only the one canal row, preserve the rest
        const prevJourneyRows = existing.slice(1).filter((r) => r[0] === 'journey')
        let found = false
        journeyRows = prevJourneyRows.map((r) => {
          if (r[2] === segmento && r[3] === canalId) {
            found = true
            return ['journey', savedAt, segmento, canalId, JSON.stringify(journey)]
          }
          return r
        })
        if (!found) journeyRows.push(['journey', savedAt, segmento, canalId, JSON.stringify(journey)])
      } else if (existing[0]?.[1]) {
        // Old format: migrate all existing journeys + add/update new canal
        try {
          const oldV3 = JSON.parse(existing[0][1]) as unknown
          journeyRows = v3ObjectToJourneyRows(oldV3, savedAt)
          let found = false
          journeyRows = journeyRows.map((r) => {
            if (r[2] === segmento && r[3] === canalId) {
              found = true
              return ['journey', savedAt, segmento, canalId, JSON.stringify(journey)]
            }
            return r
          })
          if (!found) journeyRows.push(['journey', savedAt, segmento, canalId, JSON.stringify(journey)])
        } catch {
          journeyRows = [['journey', savedAt, segmento, canalId, JSON.stringify(journey)]]
        }
      } else {
        journeyRows = [['journey', savedAt, segmento, canalId, JSON.stringify(journey)]]
      }

      const metaData = {
        clienteActual: {
          canalActivoId: (meta.clienteActual as Record<string, unknown>)?.canalActivoId,
          catalogo: (meta.clienteActual as Record<string, unknown>)?.catalogo,
        },
        clientePotencial: {
          canalActivoId: (meta.clientePotencial as Record<string, unknown>)?.canalActivoId,
          catalogo: (meta.clientePotencial as Record<string, unknown>)?.catalogo,
        },
        filters: meta.filters ?? {},
      }
      await writeRows(sheets, [
        ['meta', savedAt, '', '', JSON.stringify(metaData)],
        ...journeyRows,
      ])
      return NextResponse.json({ ok: true, savedAt })
    }

    // Full save (default): { journey: v3, filters }
    // Splits the full v3 into multiple rows (one per canal × segmento).
    const { journey, filters } = body as { journey: Record<string, unknown>; filters: unknown }
    const metaData = {
      clienteActual: {
        canalActivoId: (journey.clienteActual as Record<string, unknown>)?.canalActivoId,
        catalogo: (journey.clienteActual as Record<string, unknown>)?.catalogo,
      },
      clientePotencial: {
        canalActivoId: (journey.clientePotencial as Record<string, unknown>)?.canalActivoId,
        catalogo: (journey.clientePotencial as Record<string, unknown>)?.catalogo,
      },
      filters: filters ?? {},
    }
    const journeyRows = v3ObjectToJourneyRows(journey, savedAt)
    await writeRows(sheets, [
      ['meta', savedAt, '', '', JSON.stringify(metaData)],
      ...journeyRows,
    ])
    return NextResponse.json({ ok: true, savedAt })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
