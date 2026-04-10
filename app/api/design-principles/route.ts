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
    system: `Eres un director de diseño con experiencia en sistemas de diseño multiplataforma para marcas de salud y bienestar.
Tu tarea es traducir las decisiones de valores y personalidad de la fundadora de MOA en principios de diseño universales.
Estos principios deben funcionar en cualquier soporte: web, app móvil, espacio físico, materiales impresos, redes sociales.
NO inventes ni añadas nada que no se desprenda directamente de sus respuestas.
Cada principio debe poder trazarse hasta una o varias respuestas del formulario.
Responde siempre en español.`,
    prompt: `Patricia Dorado, fundadora de MOA (centro de entrenamiento y salud en Martorell), ha respondido este formulario sobre los valores y la personalidad de su marca:

${formAnswers}

Genera los principios de diseño de MOA basándote EXCLUSIVAMENTE en estas respuestas.
Estos principios deben ser válidos para cualquier soporte (web, app, espacio físico, materiales).

Cada principio debe:
1. Estar anclado a una emoción o valor que Patricia ha expresado, no a una solución técnica concreta
2. Ser aplicable tanto a una pantalla como a un cartel, una sala de entrenamiento o una notificación push
3. Incluir 3 reglas de aplicación concretas pero genéricas (no solo web)
4. Responder a la pregunta: "¿Cómo reconozco que este diseño es de MOA?"`,
  })

  return NextResponse.json(object)
}
