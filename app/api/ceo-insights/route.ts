import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'
import { CLIENT } from '@/lib/client-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const { qas } = await req.json()

  const content = qas
    .map((qa: { question: string; answer: string; themeLabel: string }) =>
      `[${qa.themeLabel}] ${qa.question}\nRespuesta: ${qa.answer}`
    )
    .join('\n\n---\n\n')

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: `Eres un consultor estratégico de marca y negocio especializado en centros de salud y bienestar.
Analiza entrevistas a CEOs y fundadoras para extraer insights accionables.
Ceñe el modelo operativo a lo que **${CLIENT.ownerFirstName} describe en la entrevista** (no proyectes un negocio "solo digital" si habla de presencial, grupo o espacio físico).
Responde siempre en español. Sé directo, concreto y orientado a la acción.${MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO}`,
    prompt: `Analiza esta entrevista a ${CLIENT.ownerFullName}, ${CLIENT.ownerRole} de ${CLIENT.name} (${CLIENT.serviceDescription} en ${CLIENT.location}):

${content}

Genera un informe estratégico con este formato exacto:

## Síntesis ejecutiva
2-3 frases que capturen la esencia de ${CLIENT.name} y su propuesta de valor única.

## 🎯 Propuesta de valor
Describe en 3 bullets concisos qué hace único a ${CLIENT.name} frente al mercado.

## 💼 Modelo de negocio
Resumen del modelo: ingresos, servicios, equipo. 2-3 bullets.

## 🌐 Estrategia web
Qué debe hacer la web, qué funcionalidades son prioritarias. 3-4 bullets accionables.

## 🗣️ Voz de marca
Cómo debe comunicarse ${CLIENT.name}. Adjetivos clave, tono, estilo. 2-3 frases.

## ⚔️ Posicionamiento competitivo
Frente a quién compite y cuál es la diferencia real. 3 bullets.

## 🚀 Oportunidades detectadas
3 oportunidades estratégicas no mencionadas explícitamente pero que se deducen de la entrevista.

## ⚠️ Riesgos o puntos de atención
2-3 aspectos que ${CLIENT.ownerFirstName} debería vigilar o reforzar.`,
  })

  return result.toTextStreamResponse()
}
