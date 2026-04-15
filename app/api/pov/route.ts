import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { SHEET_ID, SHEET_RANGE, DEMOGRAPHIC_COLUMNS } from '@/lib/questions'
import { POTENTIAL_SHEET_ID, POTENTIAL_SHEET_RANGE, POTENTIAL_DEMOGRAPHIC_COLUMNS, POTENTIAL_QUESTIONS } from '@/lib/potential-questions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

// ── Demographic helpers ────────────────────────────────────────────────────────

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

// ── Schema ─────────────────────────────────────────────────────────────────────

const statementSchema = z.object({
  usuario: z
    .string()
    .max(60)
    .describe('Descripción breve del tipo de usuario (ej: "La persona con dolor crónico", "La mujer activa de 40+")'),
  necesidad: z
    .string()
    .max(100)
    .describe('La necesidad concreta en forma de verbo infinitivo o frase verbal (ej: "encontrar un entrenamiento adaptado a sus limitaciones físicas")'),
  insight: z
    .string()
    .max(150)
    .describe('El hallazgo o motivación profunda que explica el por qué (ej: "siente que los gimnasios convencionales no están diseñados para alguien como ella")'),
})

const schema = z.object({
  clienteActual: statementSchema.describe(
    'UN solo POV sintetizando la encuesta de CLIENTES ACTUALES de MOA. Usa SOLO evidencias de ese bloque.'
  ),
  clientePotencial: statementSchema.describe(
    'UN solo POV sintetizando la encuesta de CLIENTES POTENCIALES. Usa SOLO evidencias de ese bloque. Debe ser distinto al de clientes actuales.'
  ),
})

// ── Data fetchers ─────────────────────────────────────────────────────────────

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
    const answers = rows.map((r) => r[ci]?.trim() ?? '').filter((a) => a.length > 2).slice(0, 15)
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
    const answers = rows.map((r) => r[ci]?.trim() ?? '').filter((a) => a.length > 2).slice(0, 15)
    if (answers.length === 0) return null
    return `${q}\n${answers.map((a, i) => `  ${i + 1}. "${a}"`).join('\n')}`
  }).filter(Boolean)

  return blocks.length > 0 ? blocks.join('\n\n---\n\n') : '(Sin respuestas con los filtros seleccionados)'
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const filters: SurveyFilters = body.filters ?? {}

  const [clientVoice, potentialVoice] = await Promise.all([
    getClientVoice(filters),
    getPotentialVoice(filters),
  ])

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema,
    system: `Eres un UX researcher experto en Design Thinking aplicado a marcas de salud y bienestar.
Debes generar EXACTAMENTE DOS declaraciones POV (Point of View) para MOA (entrenadora personal de salud en Martorell, Barcelona):

1. "clienteActual": UN solo POV basado ÚNICAMENTE en las respuestas de CLIENTES ACTUALES (ya entrenan con Patri). No uses datos del bloque de potenciales.
2. "clientePotencial": UN solo POV basado ÚNICAMENTE en las respuestas de CLIENTES POTENCIALES. No uses datos del bloque de clientes actuales.

FORMATO DE CADA POV (tres campos que se unirán en frase):
[Usuario] necesita [Necesidad] porque [Insight].

REGLAS:
- El USUARIO describe un arquetipo específico y humano, no genérico.
- La NECESIDAD es un verbo en infinitivo o frase verbal que describe qué quiere conseguir. Concreta y accionable.
- El INSIGHT es el hallazgo emocional o contextual profundo que explica el por qué.
- Los dos POV deben ser claramente distintos entre sí.
- Si un bloque de datos está vacío o dice "(Sin respuestas...)", genera un POV prudente que indique la falta de datos o un perfil hipotético muy conservador basado solo en lo disponible.
- Escribe en español natural y fluido.`,
    prompt: `=== SOLO PARA "clienteActual" — CLIENTES ACTUALES ===\n${clientVoice}\n\n=== SOLO PARA "clientePotencial" — CLIENTES POTENCIALES ===\n${potentialVoice}`,
  })

  return NextResponse.json(object)
}
