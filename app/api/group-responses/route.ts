import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const schema = z.object({
  groups: z
    .array(
      z.object({
        label: z.string().describe('Nombre corto del grupo (máx 5 palabras)'),
        count: z.number(),
        color: z.string().describe('Color hex representativo'),
        examples: z
          .array(z.string())
          .describe('2-3 frases representativas de los participantes'),
        interpretation: z
          .string()
          .describe('1 frase sobre qué refleja este patrón'),
      })
    )
    .describe('Entre 3 y 7 grupos, ordenados de mayor a menor frecuencia'),
})

const COLORS = [
  '#7c3aed', '#2563eb', '#dc2626', '#d97706',
  '#059669', '#0891b2', '#9333ea', '#be185d',
]

export async function POST(req: Request) {
  const { questionTitle, answers } = await req.json()

  const { object } = await generateObject({
    model: 'openai/gpt-5.4',
    schema,
    system: `Eres un investigador UX y psicólogo especializado en bienestar y salud.
Analiza respuestas abiertas de encuestas y agrúpalas por similitud semántica.
Usa colores de esta lista: ${COLORS.join(', ')}.
Responde siempre en español.`,
    prompt: `Pregunta de la encuesta: "${questionTitle}"

Respuestas de los participantes (${answers.length} en total):
${answers.map((a: string, i: number) => `${i + 1}. "${a}"`).join('\n')}

Agrupa estas respuestas en categorías por similitud semántica (no literal).
Cada respuesta debe pertenecer a un único grupo.
El total de counts debe sumar ${answers.length}.
Sé específico con los nombres de los grupos — que reflejen el contenido real de las respuestas.`,
  })

  return NextResponse.json(object)
}
