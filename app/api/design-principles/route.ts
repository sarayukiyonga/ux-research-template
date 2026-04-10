import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const schema = z.object({
  moodboard: z.object({
    adjectives: z.array(z.string()).describe('6-8 adjetivos que definen la personalidad visual de MOA'),
    palette: z.array(
      z.object({
        name: z.string().describe('Nombre del color, ej: "Verde salud"'),
        hex: z.string().describe('Código hex del color'),
        usage: z.string().describe('Para qué se usa este color'),
      })
    ).describe('4-5 colores para la identidad visual'),
    typography: z.object({
      heading: z.string().describe('Familia tipográfica para títulos (Google Fonts)'),
      body: z.string().describe('Familia tipográfica para cuerpo de texto (Google Fonts)'),
      rationale: z.string().describe('Por qué estas tipografías encajan con MOA'),
    }),
    imageStyle: z.string().describe('Descripción del estilo fotográfico y visual ideal para MOA'),
  }),
  principles: z.array(
    z.object({
      category: z.string().describe('Categoría del principio, ej: "Claridad", "Confianza", "Movimiento"'),
      icon: z.string().describe('Un emoji representativo'),
      title: z.string().describe('Nombre corto del principio (3-5 palabras)'),
      description: z.string().describe('Qué significa este principio para MOA (2-3 frases)'),
      guidelines: z.array(z.string()).describe('3 reglas concretas y accionables de diseño/comunicación'),
      color: z.string().describe('Color hex de acento para este principio'),
      doExample: z.string().describe('Ejemplo concreto de cómo SÍ aplicarlo en la web'),
      dontExample: z.string().describe('Ejemplo concreto de cómo NO aplicarlo'),
    })
  ).describe('5-7 principios de diseño ordenados por importancia'),
  voiceGuidelines: z.object({
    tone: z.string().describe('Descripción del tono de voz en 2-3 frases'),
    doWords: z.array(z.string()).describe('8-10 palabras o expresiones que SÍ usar'),
    dontWords: z.array(z.string()).describe('6-8 palabras o expresiones que NO usar'),
    exampleHeadline: z.string().describe('Ejemplo de titular para la home de la web'),
    exampleCta: z.string().describe('Ejemplo de call-to-action principal'),
  }),
})

export async function POST(req: Request) {
  const { qas } = await req.json()

  const content = qas
    .map((qa: { question: string; answer: string; themeLabel: string }) =>
      `[${qa.themeLabel}] ${qa.question}\nRespuesta: ${qa.answer}`
    )
    .join('\n\n---\n\n')

  const { object } = await generateObject({
    model: 'openai/gpt-5.4',
    schema,
    system: `Eres un director de arte y diseñador UX/UI especializado en marcas de salud y bienestar.
Tu trabajo es traducir la personalidad, valores y visión de una fundadora en principios de diseño concretos y accionables.
Responde siempre en español. Sé específico, visual y práctico.`,
    prompt: `A partir de esta entrevista a Patricia Dorado, fundadora de MOA (centro de entrenamiento y salud en Martorell), genera los principios de diseño para su marca y web:

${content}

Contexto adicional:
- MOA = Movimiento, Origen, Acción
- Clientes: personas con patologías, dolor crónico o que quieren prevenir lesiones
- Valores: cercanía, profesionalidad, calma (no prisa), confianza, paso a paso
- Referencias web que le gustan: teamalbamellado.com, origopsicologia.com, mikisarzi.com, estimatpilates.es
- Competidores directos: Espai Biosfera, Viumes, Nomad Salut, Mesvida Fitness

Genera principios de diseño que reflejen fielmente la visión de Patricia y que sean aplicables directamente al diseño de la web y materiales de MOA.`,
  })

  return NextResponse.json(object)
}
