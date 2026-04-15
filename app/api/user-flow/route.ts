import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { fetchSavedUserPersonas, personaRecordToPlainText } from '@/lib/fetch-saved-user-personas'
import { fetchSavedPovFromSheets, type POVStatement } from '@/lib/fetch-saved-pov'
import {
  fetchSavedUserJourneyFromSheets,
  journeySegmentToFlowGrounding,
} from '@/lib/fetch-saved-user-journey'
import { userFlowLineSchema, normalizeUserFlowLine } from '@/lib/user-flow-tree'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function povLine(label: string, s: POVStatement): string {
  return `${label}: ${s.usuario} necesita ${s.necesidad} porque ${s.insight}.`
}

const ERR_PERSONA = 'Faltan user personas guardados. Ve a /user-persona.'
const ERR_POV = 'Faltan POV guardados. Ve a /pov.'
const ERR_JOURNEY =
  'Falta el User Journey Map guardado. Ve a /user-journey, genera el mapa para cliente actual y potencial, y guarda en Sheets antes de crear el User Flow.'

const systemBase = `Eres un diseñador UX/UI para la web de MOA (Patri, entrenamiento y salud en Martorell).

## Fuente principal del recorrido
El **User Flow** (diagrama de flujo con ramas) debe estar **basado en el User Journey Map** que recibes: mismas **etapas en orden**, mismos **momentos de dolor** y el papel de la **web frente al POV** en cada etapa. Persona y POV dan contexto, pero **no inventes un recorrido distinto** al del journey: traduce cada etapa (o bloques de etapas contiguas) en **rectángulos/pasos** del diagrama y en **clics** realistas entre pantallas.

- **deDondeEntra**: coherente con la **primera etapa** del journey (cómo llega a la web en esa fase).
- **objetivoConversion**: alineado con la etapa donde el journey marca que el **POV se resuelve** en la web (\`etapaOrdenPovResuelto\`).
- **Rombo (decisiones)**: solo donde el journey o los dolores sugieren **bifurcación** (p. ej. informarse vs reservar, WhatsApp vs formulario); las ramas deben seguir siendo plausibles respecto a las etapas siguientes del journey.

## Formato JSON — campo **raiz** (árbol)

1) **Tramos lineales** \`{ "tipo": "lineal", "pasos": [...], "clicsEntrePasos": [...], "despues": ... }\`
   - \`pasos\`: pantallas en orden; cada paso: orden, tituloBolita (muy corto), descripcion, tipo (entrada | navegacion | conversion | salida).
   - \`clicsEntrePasos\`: exactamente **pasos.length - 1** textos (CTA entre pasos consecutivos del mismo tramo).
   - \`despues\`: **null** o el siguiente **nodo** (lineal o decisión).

2) **Decisiones** \`{ "tipo": "decision", "tituloDiamante": "...", "descripcion": "...", "ramas": [...] }\`
   - **tituloDiamante**: pregunta breve para el rombo.
   - **ramas**: **2 o 3** \`{ "etiqueta": "...", "siguiente": <FlowNodo> }\`.

Reglas:
- Responde en español.
- Incluye **al menos una decisión** en el árbol.
- Como máximo **2 decisiones** en cadena por rama.
- Los **orden** de los pasos del diagrama deben poder seguir la **secuencia de orden de etapas** del journey (puedes agrupar dos etapas en un solo rectángulo si es una misma pantalla, pero indícalo en la descripción).`

export async function POST() {
  try {
    const personas = await fetchSavedUserPersonas()
    if (!personas.ok) {
      return NextResponse.json({ error: ERR_PERSONA }, { status: 400 })
    }

    const pov = await fetchSavedPovFromSheets()
    if (!pov.ok) {
      return NextResponse.json({ error: ERR_POV }, { status: 400 })
    }

    const journeySaved = await fetchSavedUserJourneyFromSheets()
    if (!journeySaved.ok) {
      return NextResponse.json({ error: ERR_JOURNEY }, { status: 400 })
    }

    const journeyActual = journeySegmentToFlowGrounding(
      journeySaved.data.clienteActual,
      'USER JOURNEY — CLIENTE ACTUAL'
    )
    const journeyPotencial = journeySegmentToFlowGrounding(
      journeySaved.data.clientePotencial,
      'USER JOURNEY — CLIENTE POTENCIAL'
    )

    const textoPersonaActual = personaRecordToPlainText(
      'USER PERSONA — CLIENTE ACTUAL',
      personas.data.clienteActual
    )
    const povActual = povLine('POV — CLIENTE ACTUAL', pov.data.clienteActual)

    const { object: actualRaw } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({ flow: userFlowLineSchema }),
      system: `${systemBase}

Segmento: **cliente actual**. El journey de este segmento es la verdad del recorrido; el diagrama es su traducción a clics y pantallas.`,
      prompt: `=== USER JOURNEY MAP (OBLIGATORIO — base del flujo) ===\n${journeyActual}\n\n=== USER PERSONA (cliente actual) ===\n${textoPersonaActual}\n\n=== POV (cliente actual) ===\n${povActual}\n\n===\nDevuelve el flujo en "flow" con **raiz**, fiel al journey anterior.`,
    })

    const textoPersonaPotencial = personaRecordToPlainText(
      'USER PERSONA — CLIENTE POTENCIAL',
      personas.data.clientePotencial
    )
    const povPotencial = povLine('POV — CLIENTE POTENCIAL', pov.data.clientePotencial)

    const { object: potencialRaw } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({ flow: userFlowLineSchema }),
      system: `${systemBase}

Segmento: **cliente potencial**. Más pasos de consideración si el journey lo refleja; ramas coherentes con dolores y etapas.`,
      prompt: `=== USER JOURNEY MAP (OBLIGATORIO — base del flujo) ===\n${journeyPotencial}\n\n=== USER PERSONA (cliente potencial) ===\n${textoPersonaPotencial}\n\n=== POV (cliente potencial) ===\n${povPotencial}\n\n===\nDevuelve el flujo en "flow" con **raiz**, fiel al journey anterior.`,
    })

    return NextResponse.json({
      clienteActual: normalizeUserFlowLine(actualRaw.flow),
      clientePotencial: normalizeUserFlowLine(potencialRaw.flow),
    })
  } catch (e) {
    console.error('[api/user-flow]', e)
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json(
      {
        error:
          'No se pudo generar el User Flow. ' +
          (msg.includes('API key') || msg.includes('401')
            ? 'Revisa OPENAI_API_KEY en el entorno.'
            : msg),
      },
      { status: 500 }
    )
  }
}
