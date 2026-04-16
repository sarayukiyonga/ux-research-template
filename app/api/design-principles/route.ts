import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { fetchCeoInterviewPlaintext } from '@/lib/fetch-ceo-interview-plaintext'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'
import { SHEET_ID, SHEET_RANGE, DEMOGRAPHIC_COLUMNS } from '@/lib/questions'
import { POTENTIAL_SHEET_ID, POTENTIAL_SHEET_RANGE, POTENTIAL_DEMOGRAPHIC_COLUMNS, POTENTIAL_QUESTIONS } from '@/lib/potential-questions'

interface SurveyFilters {
  gender?: string
  ageRanges?: string[]
  painValues?: string[]
}

// ── Client survey filter helpers ───────────────────────────────────────────────

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

// ── Potential survey filter helpers ────────────────────────────────────────────

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

const schema = z.object({
  summary: z
    .string()
    .describe('2-3 frases que sinteticen la esencia de diseño de MOA, usando las propias palabras de Patricia y de los clientes cuando sea posible'),
  groups: z
    .array(
      z.object({
        icon: z.string().describe('Un emoji representativo del bloque'),
        name: z.string().describe('Nombre del bloque temático en mayúsculas (3-5 palabras, evocador y directo)'),
        color: z.string().describe('Color hex de acento del bloque'),
        principleIndices: z
          .array(z.number().int().min(0))
          .describe('Índices (0-based) de los principios del array `principles` que pertenecen a este bloque'),
      })
    )
    .describe('Exactamente 3 bloques temáticos que agrupan todos los principios. Cada principio debe pertenecer a un único bloque.'),
  principles: z
    .array(
      z.object({
        icon: z.string().describe('Un emoji representativo'),
        title: z.string().describe('Nombre del principio de diseño (3-5 palabras, orientado a decisiones visuales o comunicativas)'),
        description: z
          .string()
          .describe('Qué implica este principio en términos de diseño y comunicación — con referencia a lo que Patricia o los clientes han dicho (2-3 frases). Debe quedar claro cómo afecta a decisiones concretas de diseño, NO a valores o promesas de servicio.'),
        guidelines: z
          .array(z.string())
          .describe('3 reglas de diseño concretas y aplicables: cómo se traduce este principio en tipografía, color, tono escrito, fotografía, layout, iconografía o interacción. Válidas para web, app, espacio físico y materiales impresos.'),
        color: z.string().describe('Color hex de acento'),
      })
    )
    .describe('5-7 principios de diseño ordenados por importancia'),
})

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

async function requireCeoInterviewForDesign(): Promise<string> {
  const t = await fetchCeoInterviewPlaintext()
  if (t === '(Sin datos de entrevista CEO)') throw new Error('Sin datos en la hoja CEO')
  return t
}

// Questions most relevant for design: how they arrived, trust, post-session feeling, group value
const DESIGN_RELEVANT_QUESTION_COLS: { title: string; colIndex: number }[] = [
  { title: '¿Qué te decían los médicos o tu entorno sobre tu salud antes de conocer a la entrenadora?', colIndex: 5 },
  { title: '¿Qué te frenaba a la hora de apuntarte a un gimnasio convencional?', colIndex: 7 },
  { title: '¿Qué viste en ella que te dio la confianza para poner tu salud en sus manos?', colIndex: 8 },
  { title: '¿Cómo describirías la sensación física y mental justo después de una sesión grupal?', colIndex: 9 },
  { title: '¿Qué te aporta entrenar con otras personas con situaciones similares a la tuya?', colIndex: 10 },
]
const MAX_ANSWERS_PER_QUESTION = 8

// Most design-relevant questions from the potential clients survey
const POTENTIAL_DESIGN_COLS: { title: string; colIndex: number }[] = [
  { title: '¿Qué es lo primero que piensas cuando oyes "Entrenamiento Personal de Salud"?', colIndex: 5 },
  { title: '¿Qué te gusta y qué no de tu centro actual?', colIndex: 8 },
  { title: 'Si buscaras ayuda para un dolor/lesión, ¿dónde mirarías primero?', colIndex: 13 },
  { title: '¿Qué valoras más en un profesional de la salud?', colIndex: 14 },
  { title: '¿Qué echas de menos en la oferta de bienestar actual en Martorell?', colIndex: 16 },
]

async function getPotentialVoice(filters: SurveyFilters = {}): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: POTENTIAL_SHEET_ID,
    range: POTENTIAL_SHEET_RANGE,
  })
  const rows = res.data.values ?? []
  let dataRows = rows.slice(1).filter((row) => row.some(Boolean))

  if (filters.gender && filters.gender !== 'all') {
    dataRows = dataRows.filter((row) => potentialGender(row) === filters.gender)
  }
  if (filters.ageRanges && filters.ageRanges.length > 0) {
    dataRows = dataRows.filter((row) => filters.ageRanges!.includes(potentialAge(row)))
  }
  if (filters.painValues && filters.painValues.length > 0) {
    dataRows = dataRows.filter((row) => filters.painValues!.includes((row[PAIN_COL] ?? '').trim()))
  }

  if (dataRows.length === 0) return '(Sin respuestas para los filtros seleccionados)'

  const blocks = POTENTIAL_DESIGN_COLS.map(({ title, colIndex }) => {
    const answers = dataRows
      .map((row) => row[colIndex]?.trim() ?? '')
      .filter((a) => a.length > 0)
      .slice(0, MAX_ANSWERS_PER_QUESTION)

    if (answers.length === 0) return null

    return `${title}\n${answers.map((a, i) => `  ${i + 1}. "${a}"`).join('\n')}`
  }).filter(Boolean)

  return blocks.length > 0 ? blocks.join('\n\n---\n\n') : '(Sin respuestas relevantes para los filtros seleccionados)'
}

async function getClientVoice(filters: SurveyFilters = {}): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  })
  const rows = res.data.values ?? []
  let dataRows = rows.slice(1).filter((row) => row.some(Boolean))

  if (filters.gender && filters.gender !== 'all') {
    dataRows = dataRows.filter((row) => clientGender(row) === filters.gender)
  }
  if (filters.ageRanges && filters.ageRanges.length > 0) {
    dataRows = dataRows.filter((row) => filters.ageRanges!.includes(clientAge(row)))
  }

  return DESIGN_RELEVANT_QUESTION_COLS.map(({ title, colIndex }) => {
    const answers = dataRows
      .map((row) => row[colIndex]?.trim() ?? '')
      .filter((a) => a.length > 0)
      .slice(0, MAX_ANSWERS_PER_QUESTION)

    if (answers.length === 0) return null

    const lines = answers.map((a, i) => `  ${i + 1}. "${a}"`).join('\n')
    return `${title}\n${lines}`
  }).filter(Boolean).join('\n\n---\n\n')
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const formAnswers = body.formAnswers
  const filtersClientes: SurveyFilters = body.filtersClientes ?? body.filters ?? {}
  const filtersPotenciales: SurveyFilters = body.filtersPotenciales ?? body.filters ?? {}

  const [interview, clientVoice, potentialVoice] = await Promise.all([
    requireCeoInterviewForDesign(),
    getClientVoice(filtersClientes),
    getPotentialVoice(filtersPotenciales),
  ])

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema,
    system: `Eres un director de diseño con experiencia en sistemas de diseño multiplataforma para marcas de salud y bienestar.
Tu tarea es crear los PRINCIPIOS DE DISEÑO de MOA — no valores de empresa, no principios de negocio, no normas de atención al cliente.

Un principio de diseño responde a: ¿Cómo debe verse, sentirse y comunicarse MOA en cualquier soporte? Afecta directamente a decisiones visuales y comunicativas: tipografía, color, espaciado, jerarquía, tono de voz escrito, iconografía, fotografía, layout, interacción, naming de secciones, microcopy.

Ejemplos de lo que SÍ es un principio de diseño:
- "Usa espacio en blanco generoso para transmitir calma, no urgencia"
- "El tono escrito es el de una persona que te conoce, nunca el de un folleto clínico"
- "La fotografía muestra movimiento real, no poses perfectas"

Ejemplos de lo que NO es un principio de diseño (y debes evitar):
- "Acompañamos a cada persona en su proceso" → eso es una promesa de servicio
- "Trabajamos con rigor y profesionalidad" → eso es un valor de empresa
- "La salud es un derecho" → eso es una creencia, no una decisión de diseño

Fuentes que usarás para extraer los principios:
1. La entrevista a su fundadora — su intención visual y de comunicación
2. Las respuestas reales de sus clientes actuales — las palabras y sensaciones que describen la experiencia
3. Las respuestas de clientes potenciales — sus expectativas visuales y comunicativas, sus barreras perceptivas
4. Un formulario de prioridades de diseño respondido por Patricia — sus decisiones y límites

Los principios deben ser válidos en cualquier soporte: web, app, espacio físico, materiales impresos.
Cuando los clientes actuales y potenciales coincidan en algo, refuérzalo. Cuando haya diferencias entre lo que esperan los potenciales y lo que valoran los actuales, úsalas para afinar el principio.
Usa las propias palabras de Patricia y de los clientes siempre que puedas.
NO inventes nada que no se pueda trazar a las cuatro fuentes.
${MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO}
Responde siempre en español.`,
    prompt: `FUENTE 1 — ENTREVISTA A PATRICIA DORADO, FUNDADORA DE MOA:

${interview}

---

FUENTE 2 — VOZ DE LOS CLIENTES ACTUALES (encuesta de satisfacción):

${clientVoice}

---

FUENTE 3 — VOZ DE LOS CLIENTES POTENCIALES (encuesta de captación — público que aún no es cliente):

${potentialVoice}

---

FUENTE 4 — FORMULARIO DE PRIORIDADES DE DISEÑO (respondido por Patricia):

${formAnswers}

---

Genera los principios de DISEÑO de MOA integrando las cuatro fuentes.
- La entrevista define la intención visual y el carácter comunicativo de la marca.
- Los clientes actuales validan las sensaciones y palabras que describen la experiencia percibida.
- Los clientes potenciales revelan las expectativas visuales y las barreras perceptivas del público que aún no ha llegado.
- El formulario fija las prioridades y los límites de diseño.

Cada principio debe responder a: "¿Cómo reconozco que ESTE diseño es de MOA y no de cualquier otro centro de salud?"
Cada guideline debe poder usarse para tomar una decisión de diseño concreta: elegir una fuente, escribir un CTA, seleccionar una foto, diseñar un layout.

Además, agrupa los principios en exactamente 3 bloques temáticos (campo \`groups\`). Cada bloque debe:
- Tener un nombre evocador en mayúsculas (ej. "HUMANO Y CERCANO", "SEGURO Y ADAPTADO", "PROGRESO REAL")
- Contener los índices (0-based) de los principios que le corresponden
- Los 3 bloques deben cubrir TODOS los principios generados sin solapamientos`,
  })

  return NextResponse.json(object)
}
