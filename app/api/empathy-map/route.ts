import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { fetchCeoInterviewPlaintext } from '@/lib/fetch-ceo-interview-plaintext'
import { CLIENT_AI_SERVICE_CONTEXT } from '@/lib/client-ai-service-context'
import { SHEET_ID, SHEET_RANGE, DEMOGRAPHIC_COLUMNS } from '@/lib/questions'
import { POTENTIAL_SHEET_ID, POTENTIAL_SHEET_RANGE, POTENTIAL_DEMOGRAPHIC_COLUMNS } from '@/lib/potential-questions'
import {
  empathyVoiceColumns,
  getSegmentFilterColumnIndex,
  parseSurveyQuestionsFromHeaderRow,
} from '@/lib/survey-sheet-headers'
import { CLIENT } from '@/lib/client-config'

interface SurveyFilters {
  gender?: string
  ageRanges?: string[]
  painValues?: string[]
}

type EmpathySegment = 'clientes' | 'potenciales'

// ── Auth ───────────────────────────────────────────────────────────────────────

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

// ── Client survey helpers ──────────────────────────────────────────────────────

function clientGender(row: string[]): string | null {
  if ((row[DEMOGRAPHIC_COLUMNS.men] ?? '').trim()) return 'men'
  if ((row[DEMOGRAPHIC_COLUMNS.women] ?? '').trim()) return 'women'
  if ((row[DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()) return 'nonBinary'
  return null
}

function clientAge(row: string[]): string {
  return (
    (row[DEMOGRAPHIC_COLUMNS.men] ?? '').trim() ||
    (row[DEMOGRAPHIC_COLUMNS.women] ?? '').trim() ||
    (row[DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()
  )
}

// ── Potential survey helpers ───────────────────────────────────────────────────

function potentialGender(row: string[]): string | null {
  if ((row[POTENTIAL_DEMOGRAPHIC_COLUMNS.men] ?? '').trim()) return 'men'
  if ((row[POTENTIAL_DEMOGRAPHIC_COLUMNS.women] ?? '').trim()) return 'women'
  if ((row[POTENTIAL_DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()) return 'nonBinary'
  return null
}

function potentialAge(row: string[]): string {
  return (
    (row[POTENTIAL_DEMOGRAPHIC_COLUMNS.men] ?? '').trim() ||
    (row[POTENTIAL_DEMOGRAPHIC_COLUMNS.women] ?? '').trim() ||
    (row[POTENTIAL_DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()
  )
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Zod schema ─────────────────────────────────────────────────────────────────

const noteSchema = z
  .array(z.string().max(75))
  .min(3)
  .max(4)
  .describe('3-4 notas muy cortas (máx. 75 caracteres cada una), en primera persona o con cita directa cuando sea posible')

const schema = z.object({
  piensaSiente: noteSchema.describe(
    'Lo que el usuario PIENSA y SIENTE: miedos no expresados, preocupaciones, aspiraciones, lo que realmente le importa'
  ),
  ve: noteSchema.describe(
    'Lo que el usuario VE en su entorno: ofertas disponibles, lo que hacen sus amigos/familia, mensajes del mercado'
  ),
  oye: noteSchema.describe(
    'Lo que el usuario OYE: lo que le dicen médicos, familia, amigos, redes sociales sobre el ejercicio y la salud'
  ),
  dice: noteSchema.describe(
    'Lo que el usuario DICE: frases y citas literales extraídas de sus respuestas, lo que expresa públicamente'
  ),
  hace: noteSchema.describe(
    'Lo que el usuario HACE: comportamientos y hábitos actuales relacionados con el ejercicio y la salud'
  ),
  dolorFrustraciones: noteSchema.describe(
    'DOLORES y FRUSTRACIONES: obstáculos, miedos, frustraciones, lo que le impide avanzar'
  ),
  necesidadesDeseos: noteSchema.describe(
    'NECESIDADES y DESEOS: lo que realmente quiere conseguir, sus expectativas y deseos más profundos'
  ),
})

// ── Data fetchers ─────────────────────────────────────────────────────────────

const MAX_PER_Q = 10

async function getClientVoice(filters: SurveyFilters = {}): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: SHEET_RANGE })
  const rows = res.data.values ?? []
  const headerRow = rows[0] ?? []
  const dataMaxLen = rows.slice(1).reduce((m, r) => Math.max(m, r.length), 0)
  const allData = rows.slice(1).filter((row) => row.some(Boolean))
  const cq = parseSurveyQuestionsFromHeaderRow(headerRow, 'client', {
    maxColumnExclusive: Math.max(dataMaxLen, headerRow.length),
    confidentialEmailResponseRows: allData,
  })
  const empathyCols = empathyVoiceColumns(cq)
  let dataRows = allData

  if (filters.gender && filters.gender !== 'all') {
    dataRows = dataRows.filter((row) => clientGender(row) === filters.gender)
  }
  if (filters.ageRanges?.length) {
    dataRows = dataRows.filter((row) => filters.ageRanges!.includes(clientAge(row)))
  }

  const blocks = empathyCols.map(({ title, colIndex }) => {
    const answers = dataRows
      .map((row) => row[colIndex]?.trim() ?? '')
      .filter((a) => a.length > 2)
      .slice(0, MAX_PER_Q)
    if (answers.length === 0) return null
    return `${title}\n${answers.map((a, i) => `  ${i + 1}. "${a}"`).join('\n')}`
  }).filter(Boolean)

  return blocks.length > 0
    ? blocks.join('\n\n---\n\n')
    : '(Sin respuestas de clientes para los filtros seleccionados)'
}

async function getPotentialVoice(filters: SurveyFilters = {}): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: POTENTIAL_SHEET_ID, range: POTENTIAL_SHEET_RANGE })
  const rows = res.data.values ?? []
  const headerRow = rows[0] ?? []
  const dataMaxLen = rows.slice(1).reduce((m, r) => Math.max(m, r.length), 0)
  const allPotential = rows.slice(1).filter((row) => row.some(Boolean))
  const pq = parseSurveyQuestionsFromHeaderRow(headerRow, 'potential', {
    maxColumnExclusive: Math.max(dataMaxLen, headerRow.length),
    confidentialEmailResponseRows: allPotential,
  })
  const painCol = getSegmentFilterColumnIndex(pq)
  const empathyCols = empathyVoiceColumns(pq)
  let dataRows = allPotential

  if (filters.gender && filters.gender !== 'all') {
    dataRows = dataRows.filter((row) => potentialGender(row) === filters.gender)
  }
  if (filters.ageRanges?.length) {
    dataRows = dataRows.filter((row) => filters.ageRanges!.includes(potentialAge(row)))
  }
  if (filters.painValues?.length && painCol != null) {
    dataRows = dataRows.filter((row) => filters.painValues!.includes((row[painCol] ?? '').trim()))
  }

  const blocks = empathyCols.map(({ title, colIndex }) => {
    const answers = dataRows
      .map((row) => row[colIndex]?.trim() ?? '')
      .filter((a) => a.length > 2)
      .slice(0, MAX_PER_Q)
    if (answers.length === 0) return null
    return `${title}\n${answers.map((a, i) => `  ${i + 1}. "${a}"`).join('\n')}`
  }).filter(Boolean)

  return blocks.length > 0
    ? blocks.join('\n\n---\n\n')
    : '(Sin respuestas de clientes potenciales para los filtros seleccionados)'
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const filters: SurveyFilters = body.filters ?? {}
  const segment = body.segment as EmpathySegment | undefined

  if (segment !== 'clientes' && segment !== 'potenciales') {
    return NextResponse.json({ error: 'segment requerido: clientes | potenciales' }, { status: 400 })
  }

  const interview = await fetchCeoInterviewPlaintext()
  const surveyVoice =
    segment === 'clientes' ? await getClientVoice(filters) : await getPotentialVoice(filters)

  const audiencia =
    segment === 'clientes'
      ? `CLIENTES ACTUALES de ${CLIENT.name} (ya entrenan con ${CLIENT.ownerFirstName}). Las notas deben reflejar SOLO la voz de ese bloque de encuesta.`
      : `CLIENTES POTENCIALES de ${CLIENT.name} (aún no son clientes). Las notas deben reflejar SOLO la voz de ese bloque de encuesta.`

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema,
    system: `Eres un UX researcher experto en mapas de empatía aplicados a marcas de salud y bienestar.
Construyes UN mapa de empatía para ${CLIENT.name} (${CLIENT.serviceShort} en ${CLIENT.location}) usando:
1. Entrevista a ${CLIENT.ownerFullName} (cómo opera ${CLIENT.name}, tono de marca, **peso presencial vs online**; fuente de verdad operativa — **no la contradigas**; sin sustituir la voz literal del encuestado en las notas).
2. ${audiencia}

INSTRUCCIONES PARA CADA SECCIÓN:
- "piensaSiente": Extrae miedos, preocupaciones no dichas, lo que realmente les importa, sus aspiraciones internas.
- "ve": Lo que ven en su entorno: la oferta disponible, lo que hacen sus conocidos, los mensajes del mercado.
- "oye": Lo que les dicen médicos, familia, amigos o medios sobre ejercicio, salud y bienestar.
- "dice": Citas o paráfrasis directas de sus propias respuestas. Usa la primera persona ("Quiero...", "Siento que...", "No me gusta cuando...").
- "hace": Comportamientos y hábitos actuales: qué hacen (o no hacen) respecto al ejercicio y la salud.
- "dolorFrustraciones": Obstáculos reales, miedos, barreras, frustraciones identificadas en sus respuestas.
- "necesidadesDeseos": Lo que realmente buscan conseguir: salud, autonomía, comunidad, reconocimiento, etc.

FORMATO DE CADA NOTA:
- Máximo 80 caracteres por nota
- Directas y concretas, no abstractas
- En primera persona o como cita cuando sea posible
- Sin repetición entre secciones${CLIENT_AI_SERVICE_CONTEXT}`,
    prompt: `=== ENTREVISTA A LA FUNDADORA (contexto) ===\n${interview}\n\n=== VOZ DE ENCUESTA (${segment === 'clientes' ? 'CLIENTES ACTUALES' : 'CLIENTES POTENCIALES'}) ===\n${surveyVoice}`,
  })

  return NextResponse.json(object)
}
