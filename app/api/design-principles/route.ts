import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { CEO_SHEET_ID, CEO_QUESTIONS } from '@/lib/ceo-questions'
import { SHEET_ID, SHEET_RANGE } from '@/lib/questions'
import { POTENTIAL_SHEET_ID } from '@/lib/potential-questions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const schema = z.object({
  summary: z
    .string()
    .describe('2-3 frases que sinteticen la esencia de diseño de MOA, usando las propias palabras de Patricia y de los clientes cuando sea posible'),
  principles: z
    .array(
      z.object({
        icon: z.string().describe('Un emoji representativo'),
        title: z.string().describe('Nombre del principio (3-5 palabras)'),
        description: z
          .string()
          .describe('Qué significa para MOA y por qué importa — con referencia a lo que Patricia o los clientes han dicho (2-3 frases)'),
        guidelines: z
          .array(z.string())
          .describe('3 reglas aplicables en cualquier soporte: web, app, espacio físico, materiales impresos'),
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

async function getCeoInterview(): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CEO_SHEET_ID,
    range: 'A:N',
  })
  const rows = res.data.values ?? []
  const dataRow = rows[1]
  if (!dataRow) throw new Error('Sin datos en la hoja CEO')

  return CEO_QUESTIONS.map((q) => {
    const answer = dataRow[q.columnIndex]?.trim() ?? ''
    return `[${q.themeLabel}] ${q.question}\nPatricia: "${answer}"`
  }).join('\n\n---\n\n')
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

async function getPotentialVoice(): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: POTENTIAL_SHEET_ID,
    range: 'A:Q',
  })
  const rows = res.data.values ?? []
  const dataRows = rows.slice(1).filter((row) => row.some(Boolean))

  if (dataRows.length === 0) return '(Sin respuestas todavía en esta encuesta)'

  const blocks = POTENTIAL_DESIGN_COLS.map(({ title, colIndex }) => {
    const answers = dataRows
      .map((row) => row[colIndex]?.trim() ?? '')
      .filter((a) => a.length > 0)
      .slice(0, MAX_ANSWERS_PER_QUESTION)

    if (answers.length === 0) return null

    return `${title}\n${answers.map((a, i) => `  ${i + 1}. "${a}"`).join('\n')}`
  }).filter(Boolean)

  return blocks.length > 0 ? blocks.join('\n\n---\n\n') : '(Sin respuestas relevantes todavía)'
}

async function getClientVoice(): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  })
  const rows = res.data.values ?? []
  const dataRows = rows.slice(1).filter((row) => row.some(Boolean))

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
  const { formAnswers } = await req.json()

  const [interview, clientVoice, potentialVoice] = await Promise.all([
    getCeoInterview(),
    getClientVoice(),
    getPotentialVoice(),
  ])

  const { object } = await generateObject({
    model: 'openai/gpt-5.4',
    schema,
    system: `Eres un director de diseño con experiencia en sistemas de diseño multiplataforma para marcas de salud y bienestar.
Tu tarea es crear los principios de diseño de MOA a partir de cuatro fuentes complementarias:
1. La entrevista a su fundadora — su intención, valores y visión
2. Las respuestas reales de sus clientes actuales — cómo perciben MOA y qué palabras usan
3. Las respuestas de clientes potenciales — sus expectativas, barreras y lo que echan de menos
4. Un formulario de prioridades respondido por Patricia — sus decisiones y límites de diseño

Los principios deben ser válidos en cualquier soporte: web, app, espacio físico, materiales impresos.
Cuando los clientes actuales y potenciales coincidan en algo, refuérzalo. Cuando haya diferencias entre lo que esperan los potenciales y lo que valoran los actuales, úsalas para afinar el principio.
Usa las propias palabras de Patricia y de los clientes siempre que puedas.
NO inventes nada que no se pueda trazar a las cuatro fuentes.
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

Genera los principios de diseño de MOA integrando las cuatro fuentes.
- La entrevista define la intención y el carácter de marca.
- Los clientes actuales validan lo que ya funciona.
- Los clientes potenciales revelan las expectativas y fricciones del público que aún no ha llegado.
- El formulario fija las prioridades y los límites.

Cada principio debe responder a: "¿Cómo reconozco que este diseño es de MOA y no de otro?"`,
  })

  return NextResponse.json(object)
}
