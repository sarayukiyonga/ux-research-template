import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { CEO_SHEET_ID, CEO_QUESTIONS } from '@/lib/ceo-questions'
import { SHEET_ID, SHEET_RANGE, DEMOGRAPHIC_COLUMNS } from '@/lib/questions'
import { POTENTIAL_SHEET_ID, POTENTIAL_SHEET_RANGE, POTENTIAL_DEMOGRAPHIC_COLUMNS, POTENTIAL_QUESTIONS } from '@/lib/potential-questions'

interface SurveyFilters {
  gender?: string
  ageRanges?: string[]
  painValues?: string[]
}

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

const PAIN_COL = POTENTIAL_QUESTIONS.find((q) => q.id === 1)!.columnIndex

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

async function getCeoInterview(): Promise<string> {
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

const CLIENT_EMPATHY_COLS: { title: string; colIndex: number }[] = [
  { title: '¿Qué te decían los médicos o tu entorno sobre tu salud antes de conocer a la entrenadora?', colIndex: 5 },
  { title: '¿Qué actividad te costaba más realizar antes de empezar a entrenar?', colIndex: 6 },
  { title: '¿Qué te frenaba a la hora de apuntarte a un gimnasio convencional?', colIndex: 7 },
  { title: '¿Qué viste en ella que te dio la confianza para poner tu salud en sus manos?', colIndex: 8 },
  { title: '¿Cómo describirías la sensación física y mental justo después de una sesión grupal?', colIndex: 9 },
  { title: '¿Qué te aporta entrenar con otras personas con situaciones similares a la tuya?', colIndex: 10 },
  { title: '¿Sientes que lo que pagas es una inversión en tu salud o un gasto de ocio? ¿Por qué?', colIndex: 12 },
  { title: '¿Recuerdas algún momento en el que sentiste que el entrenamiento realmente estaba funcionando?', colIndex: 13 },
  { title: 'En el sistema actual de Patri, ¿qué es lo que más te cuesta o te da más pereza?', colIndex: 15 },
]

const POTENTIAL_EMPATHY_COLS: { title: string; colIndex: number }[] = [
  { title: '¿Qué es lo primero que piensas cuando oyes "Entrenamiento Personal de Salud"?', colIndex: 5 },
  { title: '¿Qué te gusta y qué no de tu centro actual?', colIndex: 8 },
  { title: '¿Cuál es el motivo principal por el que no haces ejercicio dirigido actualmente?', colIndex: 11 },
  { title: 'Si buscaras ayuda para un dolor/lesión, ¿dónde mirarías primero?', colIndex: 13 },
  { title: '¿Qué valoras más en un profesional de la salud?', colIndex: 14 },
  { title: '¿Qué echas de menos en la oferta de bienestar actual en Martorell?', colIndex: 16 },
]

const MAX_PER_Q = 10

async function getClientVoice(filters: SurveyFilters = {}): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: SHEET_RANGE })
  const rows = res.data.values ?? []
  let dataRows = rows.slice(1).filter((row) => row.some(Boolean))

  if (filters.gender && filters.gender !== 'all') {
    dataRows = dataRows.filter((row) => clientGender(row) === filters.gender)
  }
  if (filters.ageRanges?.length) {
    dataRows = dataRows.filter((row) => filters.ageRanges!.includes(clientAge(row)))
  }

  const blocks = CLIENT_EMPATHY_COLS.map(({ title, colIndex }) => {
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
  let dataRows = rows.slice(1).filter((row) => row.some(Boolean))

  if (filters.gender && filters.gender !== 'all') {
    dataRows = dataRows.filter((row) => potentialGender(row) === filters.gender)
  }
  if (filters.ageRanges?.length) {
    dataRows = dataRows.filter((row) => filters.ageRanges!.includes(potentialAge(row)))
  }
  if (filters.painValues?.length) {
    dataRows = dataRows.filter((row) => filters.painValues!.includes((row[PAIN_COL] ?? '').trim()))
  }

  const blocks = POTENTIAL_EMPATHY_COLS.map(({ title, colIndex }) => {
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
  const { filters = {} } = await req.json()

  const [interview, clientVoice, potentialVoice] = await Promise.all([
    getCeoInterview(),
    getClientVoice(filters),
    getPotentialVoice(filters),
  ])

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema,
    system: `Eres un UX researcher experto en mapas de empatía aplicados a marcas de salud y bienestar.
Tu tarea es construir un mapa de empatía del cliente/usuario de MOA a partir de tres fuentes:
1. Entrevista a la fundadora Patricia Dorado (visión, valores, cómo percibe a sus clientes)
2. Respuestas reales de clientes actuales de MOA
3. Respuestas de clientes potenciales (personas que aún no son clientes)

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
- Sin repetición entre secciones`,
    prompt: `=== ENTREVISTA A LA FUNDADORA ===\n${interview}\n\n=== VOZ DE CLIENTES ACTUALES ===\n${clientVoice}\n\n=== VOZ DE CLIENTES POTENCIALES ===\n${potentialVoice}`,
  })

  return NextResponse.json(object)
}
