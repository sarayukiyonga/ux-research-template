import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { CEO_SHEET_ID, CEO_QUESTIONS } from '@/lib/ceo-questions'
import { SHEET_ID, SHEET_RANGE, DEMOGRAPHIC_COLUMNS } from '@/lib/questions'
import { POTENTIAL_SHEET_ID, POTENTIAL_SHEET_RANGE, POTENTIAL_DEMOGRAPHIC_COLUMNS, POTENTIAL_QUESTIONS } from '@/lib/potential-questions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Auth ───────────────────────────────────────────────────────────────────────

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

// ── Schema ─────────────────────────────────────────────────────────────────────

const PersonaSchema = z.object({
  nombre: z.string().describe('Nombre ficticio representativo del segmento'),
  genero: z.enum(['mujer', 'hombre', 'no_binario']).describe('Género predominante en el segmento de datos'),
  edad: z.number().describe('Edad representativa del segmento'),
  educacion: z.string().describe('Nivel de estudios más común en el segmento'),
  ubicacion: z.string().describe('Zona geográfica o contexto de vida representativo'),
  estadoCivil: z.string().describe('Estado civil más representado en el segmento'),
  ocupacion: z.string().describe('Ocupación o situación laboral representativa'),
  tags: z
    .array(z.string().max(20))
    .min(4)
    .max(6)
    .describe('4-6 rasgos de personalidad o características clave muy breves'),
  frase: z
    .string()
    .max(130)
    .describe('Frase representativa de esta persona, en primera persona, que capture su esencia'),
  motivaciones: z
    .array(z.string().max(90))
    .min(4)
    .max(5)
    .describe('4-5 motivaciones principales concretas y directas'),
  necesidades: z
    .array(z.string().max(90))
    .min(4)
    .max(5)
    .describe('4-5 necesidades clave que busca satisfacer'),
  puntosDeDolor: z
    .array(z.string().max(90))
    .min(4)
    .max(5)
    .describe('4-5 puntos de dolor, barreras o frustraciones principales'),
  personalidad: z.object({
    introvertidoExtrovertido: z
      .number()
      .min(1)
      .max(5)
      .describe('Escala 1–5: 1=muy introvertido, 5=muy extrovertido'),
    pensamientoSentimiento: z
      .number()
      .min(1)
      .max(5)
      .describe('Escala 1–5: 1=muy analítico/racional, 5=muy emocional/empático'),
    organizadoEspontaneo: z
      .number()
      .min(1)
      .max(5)
      .describe('Escala 1–5: 1=muy organizado/planificador, 5=muy espontáneo/flexible'),
    seguroInseguro: z
      .number()
      .min(1)
      .max(5)
      .describe('Escala 1–5: 1=muy seguro de sí mismo, 5=muy inseguro/ansioso'),
    intuitivoObservador: z
      .number()
      .min(1)
      .max(5)
      .describe('Escala 1–5: 1=muy intuitivo/visionario, 5=muy observador/detallista'),
  }),
  habilidadesTecnicas: z.object({
    internet: z.number().min(1).max(5).describe('Nivel de comodidad usando internet 1–5'),
    redesSociales: z.number().min(1).max(5).describe('Nivel de uso de redes sociales 1–5'),
    comprasOnline: z.number().min(1).max(5).describe('Nivel de uso de compras/reservas online 1–5'),
  }),
})

const schema = z.object({
  clienteActual: PersonaSchema.describe(
    'User Persona representativo de los CLIENTES ACTUALES de MOA (ya entrenan con Patri)'
  ),
  clientePotencial: PersonaSchema.describe(
    'User Persona representativo de los CLIENTES POTENCIALES de MOA (todavía no son clientes)'
  ),
})

// ── Data helpers ───────────────────────────────────────────────────────────────

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

async function getCeoInterview(): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: CEO_SHEET_ID, range: 'A:N' })
  const rows = res.data.values ?? []
  const dataRow = rows[1]
  if (!dataRow) return '(Sin datos)'
  return CEO_QUESTIONS.map((q) => {
    const answer = dataRow[q.columnIndex]?.trim() ?? ''
    return `[${q.themeLabel}] ${q.question}\nPatricia: "${answer}"`
  }).join('\n\n---\n\n')
}

async function getClientSurveyText(filters: SurveyFilters = {}): Promise<string> {
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

  // Demographics summary
  const genders = rows.map(clientGender).filter(Boolean)
  const ages = rows.map(clientAge).filter(Boolean)
  const genderCount = { men: 0, women: 0, nonBinary: 0 } as Record<string, number>
  genders.forEach((g) => { genderCount[g!] = (genderCount[g!] ?? 0) + 1 })
  const ageCount: Record<string, number> = {}
  ages.forEach((a) => { ageCount[a] = (ageCount[a] ?? 0) + 1 })

  const demoSummary = [
    `Total respuestas: ${rows.length}`,
    `Género: mujeres=${genderCount.women ?? 0}, hombres=${genderCount.men ?? 0}`,
    `Edades: ${Object.entries(ageCount).sort().map(([k, v]) => `${k}(${v})`).join(', ')}`,
  ].join('\n')

  const blocks = CLIENT_COLS.map((ci) => {
    const q = header[ci]?.trim() ?? `Col ${ci}`
    const answers = rows.map((r) => r[ci]?.trim() ?? '').filter((a) => a.length > 2).slice(0, 12)
    if (answers.length === 0) return null
    return `${q}\n${answers.map((a, i) => `  ${i + 1}. "${a}"`).join('\n')}`
  }).filter(Boolean)

  return `DEMOGRAFÍA:\n${demoSummary}\n\nRESPUESTAS:\n${blocks.join('\n\n---\n\n')}`
}

async function getPotentialSurveyText(filters: SurveyFilters = {}): Promise<string> {
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

  const genders = rows.map(potentialGender).filter(Boolean)
  const ages = rows.map(potentialAge).filter(Boolean)
  const genderCount = { men: 0, women: 0, nonBinary: 0 } as Record<string, number>
  genders.forEach((g) => { genderCount[g!] = (genderCount[g!] ?? 0) + 1 })
  const ageCount: Record<string, number> = {}
  ages.forEach((a) => { ageCount[a] = (ageCount[a] ?? 0) + 1 })
  const painCount: Record<string, number> = {}
  rows.forEach((r) => {
    const p = (r[PAIN_COL] ?? '').trim()
    if (p) painCount[p] = (painCount[p] ?? 0) + 1
  })

  const demoSummary = [
    `Total respuestas: ${rows.length}`,
    `Género: mujeres=${genderCount.women ?? 0}, hombres=${genderCount.men ?? 0}`,
    `Edades: ${Object.entries(ageCount).sort().map(([k, v]) => `${k}(${v})`).join(', ')}`,
    `Dolor crónico: ${Object.entries(painCount).map(([k, v]) => `${k}(${v})`).join(', ')}`,
  ].join('\n')

  const blocks = POTENTIAL_COLS.map((ci) => {
    const q = header[ci]?.trim() ?? `Col ${ci}`
    const answers = rows.map((r) => r[ci]?.trim() ?? '').filter((a) => a.length > 2).slice(0, 12)
    if (answers.length === 0) return null
    return `${q}\n${answers.map((a, i) => `  ${i + 1}. "${a}"`).join('\n')}`
  }).filter(Boolean)

  return `DEMOGRAFÍA:\n${demoSummary}\n\nRESPUESTAS:\n${blocks.join('\n\n---\n\n')}`
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const filters: SurveyFilters = body.filters ?? {}

  const [interview, clientText, potentialText] = await Promise.all([
    getCeoInterview(),
    getClientSurveyText(filters),
    getPotentialSurveyText(filters),
  ])

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema,
    system: `Eres un UX researcher experto en user personas aplicadas a marcas de salud y bienestar.
Tu tarea es crear DOS user personas detallados y realistas para MOA, entrenadora personal de salud en Martorell (Barcelona):
1. Un persona representativo de los CLIENTES ACTUALES (ya entrenan con Patri)
2. Un persona representativo de los CLIENTES POTENCIALES (aún no son clientes)

INSTRUCCIONES:
- Basa los datos demográficos (edad, género, educación, ocupación) en la distribución REAL de las encuestas.
- Las motivaciones, necesidades y puntos de dolor deben ser concretos, directos y basados en las respuestas reales.
- Los rasgos de personalidad y habilidades técnicas deben reflejar el perfil inferido de las respuestas.
- La frase debe ser una cita representativa en primera persona que capture la esencia del perfil.
- Los dos personas deben ser CLARAMENTE DISTINTOS entre sí.
- Usa nombres españoles/catalanes representativos del área de Martorell.`,
    prompt: `=== ENTREVISTA A LA FUNDADORA (contexto del negocio) ===\n${interview}\n\n=== ENCUESTA CLIENTES ACTUALES ===\n${clientText}\n\n=== ENCUESTA CLIENTES POTENCIALES ===\n${potentialText}`,
  })

  return NextResponse.json(object)
}
