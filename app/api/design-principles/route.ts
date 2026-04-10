import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { CEO_SHEET_ID, CEO_QUESTIONS } from '@/lib/ceo-questions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const schema = z.object({
  summary: z
    .string()
    .describe('2-3 frases que sinteticen la esencia de diseño de MOA, citando las propias palabras de Patricia cuando sea posible'),
  principles: z
    .array(
      z.object({
        icon: z.string().describe('Un emoji representativo'),
        title: z.string().describe('Nombre del principio (3-5 palabras)'),
        description: z
          .string()
          .describe('Qué significa para MOA y de dónde viene — anclado en lo que Patricia ha dicho (2-3 frases)'),
        guidelines: z
          .array(z.string())
          .describe('3 reglas aplicables en cualquier soporte: web, app, espacio físico, materiales'),
        color: z.string().describe('Color hex de acento'),
      })
    )
    .describe('5-7 principios de diseño ordenados por importancia'),
})

async function getCeoInterview(): Promise<string> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
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

export async function POST(req: Request) {
  const { formAnswers } = await req.json()

  const interview = await getCeoInterview()

  const { object } = await generateObject({
    model: 'openai/gpt-5.4',
    schema,
    system: `Eres un director de diseño con experiencia en sistemas de diseño multiplataforma para marcas de salud y bienestar.
Tu tarea es crear los principios de diseño de MOA a partir de dos fuentes:
1. La entrevista completa a su fundadora (fuente principal, rica en contexto)
2. Tres respuestas clave que Patricia ha dado expresamente para guiar el diseño (matices específicos)

Los principios deben ser válidos en cualquier soporte: web, app, espacio físico, materiales impresos.
Usa siempre las palabras y expresiones de Patricia cuando puedas — los principios deben sonar a ella.
NO inventes nada que no pueda trazarse a lo que ella ha dicho.
Responde siempre en español.`,
    prompt: `ENTREVISTA A PATRICIA DORADO, FUNDADORA DE MOA:

${interview}

---

RESPUESTAS DEL FORMULARIO DE DISEÑO (matices específicos aportados por Patricia):

${formAnswers}

---

Genera los principios de diseño de MOA combinando ambas fuentes.
La entrevista es el contexto y la voz. Las respuestas del formulario son las prioridades y los límites.
Cada principio debe responder a: "¿Cómo reconozco que este diseño es de MOA y no de otro?"`,
  })

  return NextResponse.json(object)
}
