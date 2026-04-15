import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { SHEET_ID, SHEET_RANGE, DEMOGRAPHIC_COLUMNS } from '@/lib/questions'
import { POTENTIAL_SHEET_ID, POTENTIAL_SHEET_RANGE, POTENTIAL_DEMOGRAPHIC_COLUMNS, POTENTIAL_QUESTIONS } from '@/lib/potential-questions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Segment = 'clientes' | 'potenciales'

interface SurveyFilters {
  gender?: string
  ageRanges?: string[]
  painValues?: string[]
}

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

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

const PAIN_COL = POTENTIAL_QUESTIONS.find((q) => q.id === 1)!.columnIndex
const CLIENT_COLS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
const POTENTIAL_COLS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]

async function getClientVoice(filters: SurveyFilters = {}): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: SHEET_RANGE })
  let rows = (res.data.values ?? []).slice(1).filter((r) => r.some(Boolean))
  const header = res.data.values?.[0] ?? []

  if (filters.gender && filters.gender !== 'all') {
    rows = rows.filter((row) => clientGender(row) === filters.gender)
  }
  if (filters.ageRanges?.length) {
    rows = rows.filter((row) => filters.ageRanges!.includes(clientAge(row)))
  }

  const blocks = CLIENT_COLS.map((ci) => {
    const q = header[ci]?.trim() ?? `Col ${ci}`
    const answers = rows.map((r) => r[ci]?.trim() ?? '').filter((a) => a.length > 2).slice(0, 18)
    if (answers.length === 0) return null
    return `${q}\n${answers.map((a, i) => `  ${i + 1}. "${a}"`).join('\n')}`
  }).filter(Boolean)

  return blocks.length > 0 ? blocks.join('\n\n---\n\n') : '(Sin respuestas con los filtros seleccionados)'
}

async function getPotentialVoice(filters: SurveyFilters = {}): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: POTENTIAL_SHEET_ID, range: POTENTIAL_SHEET_RANGE })
  let rows = (res.data.values ?? []).slice(1).filter((r) => r.some(Boolean))
  const header = res.data.values?.[0] ?? []

  if (filters.gender && filters.gender !== 'all') {
    rows = rows.filter((row) => potentialGender(row) === filters.gender)
  }
  if (filters.ageRanges?.length) {
    rows = rows.filter((row) => filters.ageRanges!.includes(potentialAge(row)))
  }
  if (filters.painValues?.length) {
    rows = rows.filter((row) => filters.painValues!.includes((row[PAIN_COL] ?? '').trim()))
  }

  const blocks = POTENTIAL_COLS.map((ci) => {
    const q = header[ci]?.trim() ?? `Col ${ci}`
    const answers = rows.map((r) => r[ci]?.trim() ?? '').filter((a) => a.length > 2).slice(0, 18)
    if (answers.length === 0) return null
    return `${q}\n${answers.map((a, i) => `  ${i + 1}. "${a}"`).join('\n')}`
  }).filter(Boolean)

  return blocks.length > 0 ? blocks.join('\n\n---\n\n') : '(Sin respuestas con los filtros seleccionados)'
}

const bloqueSchema = z.object({
  titulo: z.string().max(70).describe('Título corto del tema de insights'),
  items: z
    .array(z.string().max(240))
    .min(3)
    .max(6)
    .describe('3-6 hallazgos concretos y accionables para la entrenadora'),
})

const schema = z.object({
  resumen: z
    .string()
    .max(450)
    .describe('Párrafo ejecutivo que sintetiza lo más importante (máx. 450 caracteres)'),
  bloques: z
    .array(bloqueSchema)
    .min(5)
    .max(8)
    .describe('5-8 bloques temáticos con insights accionables'),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const filters: SurveyFilters = body.filters ?? {}
  const segment = body.segment as Segment | undefined

  if (segment !== 'clientes' && segment !== 'potenciales') {
    return NextResponse.json({ error: 'segment requerido: clientes | potenciales' }, { status: 400 })
  }

  const surveyText =
    segment === 'clientes' ? await getClientVoice(filters) : await getPotentialVoice(filters)

  const contexto =
    segment === 'clientes'
      ? 'CLIENTES ACTUALES de MOA (ya entrenan con Patricia Dorado en Martorell).'
      : 'CLIENTES POTENCIALES de MOA (aún no son clientes; encuesta de captación/perfil).'

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema,
    system: `Eres un analista de investigación cualitativa especializado en salud, fitness y experiencia de cliente.
Analizas únicamente respuestas de encuesta de ${contexto}

Tu tarea es extraer INSIGHTS accionables para Patricia (entrenadora) y su marca MOA:
- Patrones, tensiones, oportunidades y riesgos que emergen de las respuestas reales.
- Lenguaje cercano al de los encuestados cuando aporte valor.
- Cada ítem debe ser específico (no genéricos como "mejorar la comunicación" sin contexto).
- No inventes datos: si el material es escaso, dilo en el resumen y reduce la ambición de los bloques.

Estructura de salida:
- "resumen": síntesis ejecutiva.
- "bloques": temas con título + lista de insights (cada uno una idea completa en una frase).

PROHIBIDO en cualquier texto visible: llaves, corchetes, comillas JSON sueltas, fragmentos de código, bloques markdown con backticks, o signos de cierre duplicados al final de una frase. Solo español natural.`,
    prompt: `=== RESPUESTAS DE ENCUESTA (${segment === 'clientes' ? 'clientes actuales' : 'clientes potenciales'}) ===\n\n${surveyText}`,
  })

  return NextResponse.json({ segment, ...object })
}
