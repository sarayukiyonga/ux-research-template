import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { stableFiltersKey, toSurveyAiFiltersPayload, type SurveyAiFiltersPayload } from '@/lib/survey-ai-filters'

export const dynamic = 'force-dynamic'

type Segment = 'clientes' | 'potenciales'

function sheetName(segment: Segment) {
  return segment === 'clientes' ? 'survey-ai-clientes' : 'survey-ai-potenciales'
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

/** Cuerpo JSON en B2: grupos por id de pregunta, persona markdown, ocupaciones (solo clientes). */
export type SurveyAiBundleBody = {
  groups: Record<string, unknown>
  persona: string
  occupations?: unknown | null
}

function parseFilters(raw: string | undefined): SurveyAiFiltersPayload | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return null
    const x = o as Record<string, unknown>
    return toSurveyAiFiltersPayload({
      gender: typeof x.gender === 'string' ? x.gender : 'all',
      ageRanges: Array.isArray(x.ageRanges) ? x.ageRanges.map(String) : [],
      painValues: Array.isArray(x.painValues) ? x.painValues.map(String) : [],
    })
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const seg = searchParams.get('segment') as Segment | null
    const filtersRaw = searchParams.get('filters')
    if (seg !== 'clientes' && seg !== 'potenciales') {
      return NextResponse.json({ error: 'segment=clientes|potenciales requerido' }, { status: 400 })
    }
    if (!filtersRaw) {
      return NextResponse.json({ error: 'filters (JSON) requerido' }, { status: 400 })
    }

    const requested = parseFilters(filtersRaw)
    if (!requested) {
      return NextResponse.json({ error: 'filters JSON inválido' }, { status: 400 })
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

    const storedFilters = parseFilters(row[2] as string | undefined)
    if (!storedFilters || stableFiltersKey(storedFilters) !== stableFiltersKey(requested)) {
      return NextResponse.json({ saved: null })
    }

    const bundle = JSON.parse(row[1] as string) as SurveyAiBundleBody
    return NextResponse.json({
      saved: {
        savedAt: row[0] ?? '',
        filters: storedFilters,
        groups: bundle.groups ?? {},
        persona: typeof bundle.persona === 'string' ? bundle.persona : '',
        occupations: bundle.occupations ?? null,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { segment, filters, groups, persona, occupations } = body as {
      segment?: string
      filters?: SurveyAiFiltersPayload
      groups?: Record<string, unknown>
      persona?: string
      occupations?: unknown | null
    }

    if (segment !== 'clientes' && segment !== 'potenciales') {
      return NextResponse.json({ error: 'segment requerido' }, { status: 400 })
    }
    const filt = filters && typeof filters === 'object' ? toSurveyAiFiltersPayload(filters) : null
    if (!filt) {
      return NextResponse.json({ error: 'filters requerido' }, { status: 400 })
    }

    const bundle: SurveyAiBundleBody = {
      groups: groups && typeof groups === 'object' ? groups : {},
      persona: typeof persona === 'string' ? persona : '',
      occupations: segment === 'clientes' ? occupations ?? null : null,
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
            values: [['Guardado el', 'Análisis IA encuesta (JSON)', 'Filtros (JSON)']],
          },
          {
            range: `${name}!A2:C2`,
            values: [[savedAt, JSON.stringify(bundle), JSON.stringify(filt)]],
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
