import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const schema = z.object({
  summary: z
    .string()
    .describe('1-2 frases que sinteticen la dirección de diseño elegida por Patricia'),
  principles: z
    .array(
      z.object({
        icon: z.string().describe('Un emoji representativo'),
        title: z.string().describe('Nombre del principio (3-5 palabras)'),
        description: z
          .string()
          .describe('Qué significa este principio para MOA y por qué Patricia lo eligió (2-3 frases)'),
        guidelines: z
          .array(z.string())
          .describe('3 reglas concretas y accionables para aplicar en el diseño web'),
        color: z.string().describe('Color hex de acento para este principio'),
      })
    )
    .describe('5-7 principios de diseño derivados directamente de las respuestas del formulario, ordenados por importancia'),
})

export async function POST(req: Request) {
  const { formAnswers } = await req.json()

  const { object } = await generateObject({
    model: 'openai/gpt-5.4',
    schema,
    system: `Eres un consultor de diseño web especializado en marcas de salud y bienestar.
Tu tarea es traducir las decisiones concretas tomadas por la fundadora de MOA en un formulario en principios de diseño claros y accionables.
NO inventes ni añadas nada que no se desprenda directamente de sus respuestas.
Cada principio debe poder trazarse hasta una o varias respuestas del formulario.
Responde siempre en español.`,
    prompt: `Patricia Dorado, fundadora de MOA (centro de entrenamiento y salud en Martorell), ha respondido este formulario de diseño:

${formAnswers}

Genera los principios de diseño para la web de MOA basándote EXCLUSIVAMENTE en estas respuestas.
Cada principio debe:
1. Reflejar una decisión real que Patricia ha tomado
2. Ser accionable para un diseñador o desarrollador web
3. Incluir 3 reglas concretas de aplicación`,
  })

  return NextResponse.json(object)
}
