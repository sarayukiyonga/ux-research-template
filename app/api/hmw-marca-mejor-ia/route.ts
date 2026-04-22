import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { HMW_MARCA_MOTIVO_MAX_LEN, HMW_RESPUESTAS_MAX, normalizeHmwPayload } from '@/lib/hmw-payload'
import { hmwIaContextToMarkdown, loadHmwIaContextOrFail } from '@/lib/hmw-ia-context'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'
import { CLIENT } from '@/lib/client-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

function listRespuestasForPrompt(respuestas: string[]): string {
  return respuestas
    .map((t, j) => {
      const label = t.trim() ? t.trim() : '(vacío — no elijas este índice salvo que todos estén vacíos)'
      return `  [${j}] ${label}`
    })
    .join('\n')
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON no válido.' }, { status: 400 })
  }

  const o = body as Record<string, unknown>
  const questions = normalizeHmwPayload(o.questions)
  const block = o.block
  const questionIndex = o.questionIndex

  if (!questions) {
    return NextResponse.json({ error: 'Falta "questions" con formato HMW válido.' }, { status: 400 })
  }
  if (block !== 'clienteActual' && block !== 'clientePotencial') {
    return NextResponse.json({ error: 'Falta "block": "clienteActual" o "clientePotencial".' }, { status: 400 })
  }
  if (typeof questionIndex !== 'number' || !Number.isInteger(questionIndex) || questionIndex < 0) {
    return NextResponse.json({ error: 'Falta "questionIndex" entero ≥ 0.' }, { status: 400 })
  }

  const items = questions[block]
  const item = items[questionIndex]
  if (!item) {
    return NextResponse.json({ error: 'Índice de pregunta fuera de rango.' }, { status: 400 })
  }

  const nonEmpty = item.respuestas.map((t, i) => ({ t, i })).filter((x) => x.t.trim())
  if (nonEmpty.length === 0) {
    return NextResponse.json({ error: 'No hay ninguna respuesta con texto para evaluar.' }, { status: 400 })
  }
  if (nonEmpty.length === 1) {
    return NextResponse.json({
      mejorIndice: nonEmpty[0].i,
      motivo:
        'Es la única respuesta con texto en esta pregunta; se marca como «Mejor» por defecto (no hubo alternativas que comparar).',
    })
  }

  const loaded = await loadHmwIaContextOrFail()
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.message }, { status: 400 })
  }

  const segmento =
    block === 'clienteActual'
      ? `CLIENTES ACTUALES (prioriza impacto en esa persona y viabilidad para ${CLIENT.ownerFirstName} en ese contexto).`
      : `CLIENTES POTENCIALES (prioriza impacto en el arquetipo de captación y viabilidad para ${CLIENT.ownerFirstName}).`

  const schema = z.object({
    mejorIndice: z
      .number()
      .int()
      .min(0)
      .max(HMW_RESPUESTAS_MAX - 1)
      .describe('Índice 0-based de la respuesta que más conviene marcar como "mejor" para esta pregunta HMW.'),
    motivo: z
      .string()
      .max(HMW_MARCA_MOTIVO_MAX_LEN)
      .describe(
        `2–5 frases en español: por qué esa opción equilibra mejor impacto para la usuaria del segmento y viabilidad para ${CLIENT.ownerFirstName} / ${CLIENT.name}.`
      ),
  })

  const prompt = `${hmwIaContextToMarkdown(loaded.ctx)}

---

## Tarea
Bloque: **${segmento}**

**Pregunta HMW:**
${item.pregunta}

**Respuestas ya escritas por la usuaria (índices 0…${item.respuestas.length - 1}):**
${listRespuestasForPrompt(item.respuestas)}

Elige **un solo** \`mejorIndice\`: la respuesta que mejor equilibre **impacto para la persona usuaria** del segmento y **factibilidad** (tiempo, coste, riesgo) para ${CLIENT.ownerFirstName} / ${CLIENT.name}. No elijas índices cuyo texto esté vacío salvo que todas estén vacías (en ese caso devuelve 0). Rellena \`motivo\` con la justificación para la usuaria de la herramienta: **no** digas que algo es viable por “adaptarse a una plataforma existente” ni cites stack técnico que **no** aparezca de forma explícita en el contexto de arriba.`

  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema,
      system:
        `Eres diseñador de producto en ${CLIENT.name} (${CLIENT.ownerFirstName}, ${CLIENT.location}). Devuelves solo el JSON pedido. español neutro. No inventas activos digitales (web, app, plataforma) que no consten en el contexto del usuario.` +
        MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO,
      prompt,
    })

    let idx = object.mejorIndice
    if (idx < 0 || idx >= item.respuestas.length) {
      idx = nonEmpty[0].i
    }
    if (!item.respuestas[idx]?.trim()) {
      const fi = item.respuestas.findIndex((t) => t.trim())
      idx = fi >= 0 ? fi : 0
    }

    const motivo =
      typeof object.motivo === 'string'
        ? object.motivo.trim().slice(0, HMW_MARCA_MOTIVO_MAX_LEN)
        : ''

    return NextResponse.json({ mejorIndice: idx, motivo })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: `No se pudo elegir la mejor respuesta con IA: ${msg}` }, { status: 500 })
  }
}
