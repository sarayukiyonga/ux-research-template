import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { fetchSavedPovFromSheets, povPairToPlainTextForHmw, type POVStatement } from '@/lib/fetch-saved-pov'
import type { HMWQuestionsPayload } from '@/lib/hmw-payload'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const hmwListSchema = z
  .array(z.string().max(220))
  .min(4)
  .max(8)
  .describe(
    'Preguntas How Might We en español; cada una empieza por "¿Cómo podríamos" (con tilde en cómo). Enfocadas a producto digital, web o experiencia MOA.'
  )

const schema = z.object({
  clienteActual: hmwListSchema.describe(
    'Solo a partir del POV de clientes actuales. Retos de diseño (web/app/comunicación) que abran soluciones; no repetir el POV literalmente.'
  ),
  clientePotencial: hmwListSchema.describe(
    'Solo a partir del POV de clientes potenciales. Distintas de las de cliente actual. Captación, confianza previa, barreras al darse de alta.'
  ),
})

const ERR: Record<string, string> = {
  no_sheet: 'No hay hoja de POV en el spreadsheet.',
  empty: 'No hay POV guardados. Genera y guarda los dos POV en la página Point of View.',
  invalid_json: 'No se pudieron leer los POV guardados.',
  invalid_shape: 'Los POV guardados no tienen el formato esperado.',
}

function povLineHmw(label: string, s: POVStatement): string {
  return `### ${label}\n${s.usuario} necesita ${s.necesidad} porque ${s.insight}.`
}

const HMW_SYSTEM_BASE = `Eres un facilitador de Design Thinking para MOA (entrenadora Patri, salud y fitness en Martorell).

Tu tarea: convertir el POV indicado en una lista de preguntas **How Might We (HMW)** en español.

Reglas:
- Cada pregunta debe empezar exactamente por **"¿Cómo podríamos"** (tilde en "cómo"), seguida de un reto concreto de diseño (interfaz, contenidos, flujos, confianza, accesibilidad, prueba social, onboarding, etc.).
- **No asumas** que existe web, app o «plataforma» salvo que el POV lo mencione de forma explícita.
- Evita genéricos vacíos ("¿Cómo podríamos mejorar la web?"). Sé específico al dolor/necesidad/insight del POV.
- No copies el POV entero dentro de la pregunta; tradúcelo a retos de diseño.${MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO}`

const toPayload = (list: string[]): HMWQuestionsPayload['clienteActual'] =>
  list.map((pregunta) => ({ pregunta, respuestas: [''] }))

export async function POST(req: Request) {
  let segmento: 'clienteActual' | 'clientePotencial' | null = null
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    if (body.segmento === 'clienteActual' || body.segmento === 'clientePotencial') {
      segmento = body.segmento
    }
  } catch {
    /* cuerpo vacío o no JSON */
  }

  const pov = await fetchSavedPovFromSheets()

  if (!pov.ok) {
    return NextResponse.json(
      { error: `${ERR[pov.code]} Ve a /pov y guarda las dos declaraciones antes de generar HMW.` },
      { status: 400 }
    )
  }

  if (segmento === 'clienteActual') {
    const texto = povLineHmw('POV — CLIENTES ACTUALES (ya con Patri / MOA)', pov.data.clienteActual)
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        clienteActual: hmwListSchema.describe(
          'Solo a partir del POV de clientes actuales. Retos de diseño (web/app/comunicación) que abran soluciones; no repetir el POV literalmente.'
        ),
      }),
      system: `${HMW_SYSTEM_BASE}

Genera **solo** el array JSON "clienteActual" (4–8 preguntas). Deben derivarse **solo** del POV de clientes actuales (continuidad, confianza ya existente con Patri/MOA).`,
      prompt: `=== POV — CLIENTES ACTUALES (única fuente para este bloque) ===\n\n${texto}\n\n===\nDevuelve solo "clienteActual" en el JSON.`,
    })
    return NextResponse.json({ clienteActual: toPayload(object.clienteActual) })
  }

  if (segmento === 'clientePotencial') {
    const texto = povLineHmw('POV — CLIENTES POTENCIALES', pov.data.clientePotencial)
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        clientePotencial: hmwListSchema.describe(
          'Solo a partir del POV de clientes potenciales. Captación, confianza previa, barreras al darse de alta; distinto en enfoque al de clientes actuales.'
        ),
      }),
      system: `${HMW_SYSTEM_BASE}

Genera **solo** el array JSON "clientePotencial" (4–8 preguntas). Deben derivarse **solo** del POV de potenciales (captación, dudas previas, primera impresión).`,
      prompt: `=== POV — CLIENTES POTENCIALES (única fuente para este bloque) ===\n\n${texto}\n\n===\nDevuelve solo "clientePotencial" en el JSON.`,
    })
    return NextResponse.json({ clientePotencial: toPayload(object.clientePotencial) })
  }

  const textoPov = povPairToPlainTextForHmw(pov.data)

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema,
    system: `${HMW_SYSTEM_BASE}

En esta petición generas **las dos** listas: "clienteActual" y "clientePotencial".
- Las de "clienteActual": continuidad, confianza ya existente con Patri/MOA.
- Las de "clientePotencial": captación, dudas previas, primera impresión; claramente distintas de las del otro bloque.`,
    prompt: `=== POV GUARDADOS (única fuente) ===\n\n${textoPov}\n\n===\nGenera las dos listas de HMW en el JSON de salida.`,
  })

  const payload: HMWQuestionsPayload = {
    clienteActual: toPayload(object.clienteActual),
    clientePotencial: toPayload(object.clientePotencial),
  }

  return NextResponse.json(payload)
}
