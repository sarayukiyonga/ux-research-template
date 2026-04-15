import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { fetchSavedPovFromSheets, povPairToPlainTextForHmw } from '@/lib/fetch-saved-pov'

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

export async function POST() {
  const pov = await fetchSavedPovFromSheets()

  if (!pov.ok) {
    return NextResponse.json(
      { error: `${ERR[pov.code]} Ve a /pov y guarda las dos declaraciones antes de generar HMW.` },
      { status: 400 }
    )
  }

  const textoPov = povPairToPlainTextForHmw(pov.data)

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema,
    system: `Eres un facilitador de Design Thinking para MOA (entrenadora Patri, salud y fitness en Martorell).

Tu tarea: convertir cada POV en una lista de preguntas **How Might We (HMW)** en español.

Reglas:
- Cada pregunta debe empezar exactamente por **"¿Cómo podríamos"** (tilde en "cómo"), seguida de un reto concreto de diseño (interfaz, contenidos, flujos, confianza, accesibilidad, prueba social, onboarding, etc.).
- Las preguntas del bloque "clienteActual" deben derivarse **solo** del POV de clientes actuales (continuidad, confianza ya existente, experiencia en producto digital de MOA).
- Las de "clientePotencial" **solo** del POV de potenciales (captación, dudas previas, primera impresión). Deben ser claramente distintas de las del otro bloque.
- Evita genéricos vacíos ("¿Cómo podríamos mejorar la web?"). Sé específico al dolor/necesidad/insight del POV.
- No copies el POV entero dentro de la pregunta; tradúcelo a retos de diseño.`,
    prompt: `=== POV GUARDADOS (única fuente) ===\n\n${textoPov}\n\n===\nGenera las dos listas de HMW en el JSON de salida.`,
  })

  return NextResponse.json(object)
}
